/**
 * Tema Metro Education Directorate (GES) - cPanel MySQL & File Storage Bridge
 * Target Subdomain: https://temametro.codecasticgh.com
 */

export interface CpanelHealthResponse {
  ok: boolean;
  database?: string;
  counts?: {
    users: number;
    submissions: number;
    schools: number;
  };
  server?: string;
  error?: string;
}

const getApiBase = (): string => {
  const envUrl = (import.meta.env.VITE_CPANEL_API_URL || '').trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  return '/api';
};

export async function checkCpanelHealth(): Promise<CpanelHealthResponse> {
  try {
    const res = await fetch(`${getApiBase()}/index.php?action=health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const text = await res.text();
    if (!text.trim().startsWith('{')) {
      return { ok: false, error: 'PHP API not active on this host (running in local/static mode)' };
    }
    return JSON.parse(text);
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unable to reach /api/index.php' };
  }
}

export async function fetchCollectionFromCpanel(
  collectionName: 'users' | 'submissions' | 'schools'
): Promise<any[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/index.php?action=list&collection=${collectionName}`);
    const text = await res.text();
    if (!text.trim().startsWith('{')) return null;
    const data = JSON.parse(text);
    return data.ok && Array.isArray(data.items) ? data.items : null;
  } catch {
    return null;
  }
}

export async function syncDocToCpanel(
  collectionName: 'users' | 'submissions' | 'schools',
  docData: Record<string, any>
): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/index.php?action=upsert&collection=${collectionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc: docData }),
    });
    const text = await res.text();
    if (!text.trim().startsWith('{')) return false;
    const json = JSON.parse(text);
    return Boolean(json.ok);
  } catch {
    return false;
  }
}

export async function syncBulkToCpanel(
  collectionName: 'users' | 'submissions' | 'schools',
  items: Record<string, any>[],
  onProgress?: (done: number, total: number) => void
): Promise<{ ok: boolean; syncedCount: number; error?: string }> {
  const chunkSize = 50;
  let syncedCount = 0;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    try {
      const res = await fetch(`${getApiBase()}/index.php?action=upsert&collection=${collectionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: chunk }),
      });
      const text = await res.text();
      if (!text.trim().startsWith('{')) {
        return {
          ok: false,
          syncedCount,
          error: 'cPanel PHP API (/api/index.php) returned non-JSON. Ensure this is running on temametro.codecasticgh.com with config.php configured.',
        };
      }
      const data = JSON.parse(text);
      if (!data.ok) {
        return { ok: false, syncedCount, error: data.error || 'Database upsert error' };
      }
      syncedCount += chunk.length;
      if (onProgress) onProgress(syncedCount, items.length);
    } catch (err: any) {
      return { ok: false, syncedCount, error: err?.message || 'Network error' };
    }
  }

  return { ok: true, syncedCount };
}

export async function deleteDocFromCpanel(
  collectionName: 'users' | 'submissions' | 'schools',
  id: string
): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/index.php?action=delete&collection=${collectionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const text = await res.text();
    if (!text.trim().startsWith('{')) return false;
    const json = JSON.parse(text);
    return Boolean(json.ok);
  } catch {
    return false;
  }
}

/**
 * Uploads a file to cPanel local storage (/api/upload.php -> /uploads/...) when running on cPanel,
 * with automatic fallback to Cloudinary if running locally or if cPanel upload is not active yet.
 */
export async function uploadFileSmart(params: {
  file: File;
  fileName: string;
  folderPath: string;
  cloudName: string;
  uploadPreset: string;
  resourceType: 'image' | 'raw';
}): Promise<string> {
  const { file, fileName, folderPath, cloudName, uploadPreset, resourceType } = params;

  // 1. Try cPanel local server upload (/api/upload.php) first
  try {
    const cpanelForm = new FormData();
    cpanelForm.append('file', file, fileName);
    cpanelForm.append('folder', folderPath);

    const cpanelRes = await fetch(`${getApiBase()}/upload.php`, {
      method: 'POST',
      body: cpanelForm,
    });
    const text = await cpanelRes.text();
    if (cpanelRes.ok && text.trim().startsWith('{')) {
      const data = JSON.parse(text);
      if (data.ok && data.secure_url) {
        return data.secure_url;
      }
    }
  } catch {
    // Fall through to Cloudinary fallback
  }

  // 2. Fallback to Cloudinary if /api/upload.php is not active (e.g., on localhost)
  if (!cloudName || !uploadPreset || cloudName === 'your_cloudinary_cloud_name') {
    throw new Error('MISSING_CLOUDINARY_CONFIG');
  }

  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folderPath);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upload failed for ${fileName}. Reason: ${errText}`);
  }

  const data = await response.json();
  return data.secure_url;
}

/**
 * Mirrors all external (Cloudinary) files referenced in `submissions` directly into
 * `/uploads/` on the cPanel subdomain via `/api/upload.php?action=mirror_url`.
 */
export async function mirrorExternalFilesToCpanel(
  submissions: any[],
  onProgress?: (msg: string) => void
): Promise<{ mirroredFiles: number; updatedSubmissions: any[] }> {
  let mirroredFiles = 0;
  const updatedSubmissions: any[] = [];

  for (let i = 0; i < submissions.length; i++) {
    const sub = { ...submissions[i] };
    let changed = false;
    const folderBase =
      sub.category === 'Education Office'
        ? `ges-tema/Education_Office/${sub.teacherName || sub.staffId || 'staff'}`
        : `ges-tema/${sub.circuit || 'general'}/${sub.school || 'school'}/${sub.teacherName || sub.staffId || 'staff'}`;

    // Mirror passport photo if hosted on external domain
    if (sub.photoUrl && sub.photoUrl.includes('cloudinary.com')) {
      try {
        if (onProgress) onProgress(`Mirroring passport photo (${i + 1}/${submissions.length}): ${sub.teacherName || sub.staffId}`);
        const res = await fetch(`${getApiBase()}/upload.php?action=mirror_url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: sub.photoUrl,
            folder: `${folderBase}/passport`,
            fileName: `${sub.staffId || 'staff'}_Passport.jpg`,
          }),
        });
        const text = await res.text();
        if (text.trim().startsWith('{')) {
          const data = JSON.parse(text);
          if (data.ok && data.secure_url) {
            sub.photoUrl = data.secure_url;
            mirroredFiles++;
            changed = true;
          }
        }
      } catch {
        // Keep existing URL if mirror fails
      }
    }

    // Mirror attached documents if hosted on external domain
    if (Array.isArray(sub.documents) && sub.documents.length > 0) {
      const nextDocs = [...sub.documents];
      for (let d = 0; d < nextDocs.length; d++) {
        const docItem = { ...nextDocs[d] };
        if (docItem.downloadURL && docItem.downloadURL.includes('cloudinary.com')) {
          try {
            if (onProgress) {
              onProgress(`Mirroring document (${i + 1}/${submissions.length}): ${docItem.fileName || docItem.documentType}`);
            }
            const res = await fetch(`${getApiBase()}/upload.php?action=mirror_url`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: docItem.downloadURL,
                folder: folderBase,
                fileName: docItem.fileName || `doc_${d + 1}.pdf`,
              }),
            });
            const text = await res.text();
            if (text.trim().startsWith('{')) {
              const data = JSON.parse(text);
              if (data.ok && data.secure_url) {
                docItem.downloadURL = data.secure_url;
                nextDocs[d] = docItem;
                mirroredFiles++;
                changed = true;
              }
            }
          } catch {
            // Keep existing URL if mirror fails
          }
        }
      }
      sub.documents = nextDocs;
    }

    if (changed) {
      updatedSubmissions.push(sub);
    }
  }

  return { mirroredFiles, updatedSubmissions };
}

/**
 * Helper to escape SQL strings safely for phpMyAdmin import
 */
function sqlEscape(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  if (typeof val === 'boolean') return val ? '1' : '0';
  const str = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/\x00/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\x1a/g, '\\Z');
  return `'${str}'`;
}

/**
 * Generates a complete, self-contained MySQL (.sql) dump file containing schema + all
 * `users`, `submissions`, and `schools` records ready for phpMyAdmin import on cPanel.
 */
export function generateFullMysqlDump(params: {
  users: any[];
  submissions: any[];
  schools: any[];
}): string {
  const { users, submissions, schools } = params;
  const nowStr = new Date().toISOString();

  const lines: string[] = [
    `-- ============================================================================`,
    `-- Tema Metro Education Directorate (GES) - Full cPanel MySQL Database Dump`,
    `-- Target Subdomain: https://temametro.codecasticgh.com`,
    `-- Generated At: ${nowStr}`,
    `-- Counts: ${users.length} Users | ${submissions.length} Submissions | ${schools.length} Schools`,
    `-- ============================================================================`,
    ``,
    `SET NAMES utf8mb4;`,
    `SET TIME_ZONE = '+00:00';`,
    `SET FOREIGN_KEY_CHECKS = 0;`,
    ``,
    `-- 1. TABLE: users`,
    `CREATE TABLE IF NOT EXISTS \`users\` (`,
    `  \`id\` VARCHAR(128) NOT NULL,`,
    `  \`email\` VARCHAR(191) DEFAULT NULL,`,
    `  \`password_hash\` VARCHAR(255) DEFAULT NULL,`,
    `  \`role\` VARCHAR(50) DEFAULT 'teacher',`,
    `  \`staffId\` VARCHAR(64) DEFAULT NULL,`,
    `  \`isOnline\` TINYINT(1) DEFAULT 0,`,
    `  \`lastActive\` VARCHAR(64) DEFAULT NULL,`,
    `  \`data_json\` LONGTEXT NOT NULL,`,
    `  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,`,
    `  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,`,
    `  PRIMARY KEY (\`id\`),`,
    `  KEY \`idx_users_email\` (\`email\`),`,
    `  KEY \`idx_users_staffId\` (\`staffId\`)`,
    `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    ``,
  ];

  users.forEach(u => {
    const id = u.id || `user_${Math.random().toString(36).slice(2, 10)}`;
    const json = JSON.stringify({ ...u, id });
    lines.push(
      `INSERT INTO \`users\` (\`id\`, \`email\`, \`role\`, \`staffId\`, \`isOnline\`, \`lastActive\`, \`data_json\`) VALUES (${sqlEscape(
        id
      )}, ${sqlEscape(u.email || null)}, ${sqlEscape(u.role || 'teacher')}, ${sqlEscape(u.staffId || null)}, ${
        u.isOnline ? 1 : 0
      }, ${sqlEscape(u.lastActive || null)}, ${sqlEscape(
        json
      )}) ON DUPLICATE KEY UPDATE \`email\`=VALUES(\`email\`), \`role\`=VALUES(\`role\`), \`staffId\`=VALUES(\`staffId\`), \`data_json\`=VALUES(\`data_json\`);`
    );
  });

  lines.push(
    ``,
    `-- 2. TABLE: submissions`,
    `CREATE TABLE IF NOT EXISTS \`submissions\` (`,
    `  \`id\` VARCHAR(128) NOT NULL,`,
    `  \`staffId\` VARCHAR(64) DEFAULT NULL,`,
    `  \`teacherName\` VARCHAR(255) DEFAULT NULL,`,
    `  \`email\` VARCHAR(191) DEFAULT NULL,`,
    `  \`category\` VARCHAR(100) DEFAULT NULL,`,
    `  \`circuit\` VARCHAR(150) DEFAULT NULL,`,
    `  \`school\` VARCHAR(255) DEFAULT NULL,`,
    `  \`currentRank\` VARCHAR(150) DEFAULT NULL,`,
    `  \`status\` VARCHAR(50) DEFAULT 'submitted',`,
    `  \`submittedBy\` VARCHAR(128) DEFAULT NULL,`,
    `  \`photoUrl\` TEXT DEFAULT NULL,`,
    `  \`data_json\` LONGTEXT NOT NULL,`,
    `  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,`,
    `  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,`,
    `  PRIMARY KEY (\`id\`),`,
    `  KEY \`idx_sub_staffId\` (\`staffId\`),`,
    `  KEY \`idx_sub_circuit\` (\`circuit\`),`,
    `  KEY \`idx_sub_school\` (\`school\`)`,
    `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    ``
  );

  submissions.forEach(s => {
    const id = s.id || `sub_${Math.random().toString(36).slice(2, 10)}`;
    const tName = s.teacherName || `${s.firstName || ''} ${s.surname || ''}`.trim();
    const json = JSON.stringify({ ...s, id });
    lines.push(
      `INSERT INTO \`submissions\` (\`id\`, \`staffId\`, \`teacherName\`, \`email\`, \`category\`, \`circuit\`, \`school\`, \`currentRank\`, \`status\`, \`submittedBy\`, \`photoUrl\`, \`data_json\`) VALUES (${sqlEscape(
        id
      )}, ${sqlEscape(s.staffId || null)}, ${sqlEscape(tName || null)}, ${sqlEscape(s.email || null)}, ${sqlEscape(
        s.category || null
      )}, ${sqlEscape(s.circuit || null)}, ${sqlEscape(s.school || null)}, ${sqlEscape(
        s.currentRank || null
      )}, ${sqlEscape(s.status || 'submitted')}, ${sqlEscape(s.submittedBy || null)}, ${sqlEscape(
        s.photoUrl || null
      )}, ${sqlEscape(
        json
      )}) ON DUPLICATE KEY UPDATE \`staffId\`=VALUES(\`staffId\`), \`teacherName\`=VALUES(\`teacherName\`), \`circuit\`=VALUES(\`circuit\`), \`school\`=VALUES(\`school\`), \`status\`=VALUES(\`status\`), \`photoUrl\`=VALUES(\`photoUrl\`), \`data_json\`=VALUES(\`data_json\`);`
    );
  });

  lines.push(
    ``,
    `-- 3. TABLE: schools`,
    `CREATE TABLE IF NOT EXISTS \`schools\` (`,
    `  \`id\` VARCHAR(128) NOT NULL,`,
    `  \`emis\` VARCHAR(64) DEFAULT NULL,`,
    `  \`name\` VARCHAR(255) DEFAULT NULL,`,
    `  \`circuit\` VARCHAR(150) DEFAULT NULL,`,
    `  \`type\` VARCHAR(64) DEFAULT 'PUBLIC',`,
    `  \`levels\` VARCHAR(128) DEFAULT NULL,`,
    `  \`head\` VARCHAR(255) DEFAULT NULL,`,
    `  \`data_json\` LONGTEXT NOT NULL,`,
    `  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,`,
    `  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,`,
    `  PRIMARY KEY (\`id\`),`,
    `  KEY \`idx_sch_emis\` (\`emis\`),`,
    `  KEY \`idx_sch_name\` (\`name\`)`,
    `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    ``
  );

  schools.forEach(sch => {
    const id = sch.id || sch.emis || `sch_${Math.random().toString(36).slice(2, 10)}`;
    const emis = sch.emis || sch.code || '';
    const name = sch.name || sch.school || '';
    const json = JSON.stringify({ ...sch, id });
    lines.push(
      `INSERT INTO \`schools\` (\`id\`, \`emis\`, \`name\`, \`circuit\`, \`type\`, \`levels\`, \`head\`, \`data_json\`) VALUES (${sqlEscape(
        id
      )}, ${sqlEscape(emis)}, ${sqlEscape(name)}, ${sqlEscape(sch.circuit || null)}, ${sqlEscape(
        sch.type || 'PUBLIC'
      )}, ${sqlEscape(sch.levels || null)}, ${sqlEscape(sch.head || null)}, ${sqlEscape(
        json
      )}) ON DUPLICATE KEY UPDATE \`emis\`=VALUES(\`emis\`), \`name\`=VALUES(\`name\`), \`circuit\`=VALUES(\`circuit\`), \`type\`=VALUES(\`type\`), \`levels\`=VALUES(\`levels\`), \`head\`=VALUES(\`head\`), \`data_json\`=VALUES(\`data_json\`);`
    );
  });

  lines.push(``, `SET FOREIGN_KEY_CHECKS = 1;`, ``);
  return lines.join('\n');
}
