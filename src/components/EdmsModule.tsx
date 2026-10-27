import React, { useState, useMemo, useRef } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const LV: [string, string, number][] = [
  ['KG', 'Kindergarten', 2],
  ['PRI', 'Primary', 6],
  ['JHS', 'Junior High', 3],
];

const FAC = [
  'Library',
  'ICT lab',
  'Science lab',
  'Toilets (gender-separated)',
  'Borehole / water',
  'Electricity',
  'Internet',
  'Adequate furniture',
  'Sports field',
  'Accessibility ramp',
];

const SUBJ = [
  'English',
  'Mathematics',
  'Science',
  'Social Studies',
  'Ghanaian Language',
];

const DEFAULT_CIRCUITS = [
  'ASHAMANG',
  'AWUDUM',
  'COMMUNITY 11/REDEMPTION VALLEY',
  'COMMUNITY 7/REPUBLIC ROAD',
  'COMMUNITY 8',
  'ONINKU/MANTE-DIN',
  'TWEDAASE',
];

export interface EdmsSchool {
  id: string;
  firestoreId?: string;
  name: string;
  code: string;
  cat: string;
  own: string;
  circuit: string;
  head: string;
  status: string;
  enr: Record<string, [number, number]>;
  teachers: [number, number]; // [have, professionallyQualified]
  portalTeachersCount: number;
  portalQualifiedCount: number;
  fac: Record<string, boolean>;
  books: Record<string, [number, number]>; // [required, available]
  gps?: string;
}

interface EdmsModuleProps {
  schoolsData: any[];
  submissions: any[];
  onBackToAdmin?: () => void;
}

const normalizeKey = (str: string) =>
  String(str || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

export default function EdmsModule({ schoolsData, submissions, onBackToAdmin }: EdmsModuleProps) {
  const [page, setPage] = useState<'dash' | 'schools' | 'enrol' | 'staff' | 'fac' | 'books' | 'rep'>('dash');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [q, setQ] = useState('');
  const [cir, setCir] = useState('All');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [toastMsg, setToastMsg] = useState('');
  const [expandedSchoolStaff, setExpandedSchoolStaff] = useState<string | null>(null);

  // Registration form states
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newOwn, setNewOwn] = useState('Public');
  const [newCir, setNewCir] = useState(DEFAULT_CIRCUITS[0]);
  const [newHead, setNewHead] = useState('');

  // Optimistic local overrides so typing in number inputs or checkboxes is instant
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<EdmsSchool>>>({});

  // Import Workbook States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importSummary, setImportSummary] = useState<{
    schoolsAdded: number;
    schoolsUpdated: number;
    DuplicatesSkippedOrMerged: number;
    teachersAdded: number;
    teachersUpdated: number;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(prev => (prev === msg ? '' : prev));
    }, 2600);
  };

  // Filter out empty drafts from submissions
  const validSubmissions = useMemo(() => {
    return submissions.filter((sub: any) => {
      const isDraft = sub.status === 'draft' && (!sub.documents || sub.documents.length === 0);
      return !isDraft;
    });
  }, [submissions]);

  // Group submitted teachers by normalized school name
  const teachersBySchool = useMemo(() => {
    const map: Record<string, any[]> = {};
    // Build a Set of seen staffIds per school to prevent duplicate submissions from inflating counts
    const seenStaffBySchool: Record<string, Set<string>> = {};

    validSubmissions.forEach((sub: any) => {
      if (!sub.school || sub.category === 'Education Office') return;
      const sKey = normalizeKey(sub.school);
      const staffKey = sub.staffId ? normalizeKey(sub.staffId) : sub.id;

      if (!map[sKey]) {
        map[sKey] = [];
        seenStaffBySchool[sKey] = new Set();
      }

      if (!seenStaffBySchool[sKey].has(staffKey)) {
        seenStaffBySchool[sKey].add(staffKey);
        map[sKey].push(sub);
      }
    });
    return map;
  }, [validSubmissions]);

  // Combine Firestore schoolsData + any schools referenced in submissions (deduplicated)
  const S: EdmsSchool[] = useMemo(() => {
    const schoolMap = new Map<string, any>();

    // 1. Add all Firestore schools (deduplicating by normalized school name or EMIS code)
    schoolsData.forEach((raw: any) => {
      const nameKey = normalizeKey(raw.school || raw.name || '');
      if (!nameKey) return;
      const existing = schoolMap.get(nameKey);
      if (!existing || (raw.enr && !existing.enr)) {
        schoolMap.set(nameKey, raw);
      }
    });

    // 2. Discover any school present in valid teacher submissions that isn't in `schools` collection yet
    validSubmissions.forEach((sub: any) => {
      if (!sub.school || sub.category === 'Education Office') return;
      const nameKey = normalizeKey(sub.school);
      if (!schoolMap.has(nameKey)) {
        schoolMap.set(nameKey, {
          id: `virtual_${nameKey}`,
          school: sub.school,
          circuit: sub.circuit || 'UNASSIGNED',
          cat: sub.category === 'SENIOR HIGH SCHOOL' ? 'Senior High' : 'Basic',
        });
      }
    });

    const list = Array.from(schoolMap.values()).sort((a, b) =>
      String(a.school || a.name || '').localeCompare(String(b.school || b.name || ''))
    );

    return list.map((raw, idx) => {
      const name = String(raw.school || raw.name || `School ${idx + 1}`);
      const nameKey = normalizeKey(name);
      const id = String(raw.id || `sch_${idx + 1}`);
      const override = localOverrides[id] || {};

      const matchedTeachers = teachersBySchool[nameKey] || [];
      const portalTeachersCount = matchedTeachers.length;
      const portalQualifiedCount = matchedTeachers.filter((t: any) => {
        const hasProfArray =
          Array.isArray(t.professional) &&
          t.professional.some((p: any) => p && (p.course || p.institution || p.award));
        const hasLicense = Boolean(t.teachersLicence && String(t.teachersLicence).trim() !== '');
        const isRankedTeacher = Boolean(t.currentRank && t.currentRank !== 'Pupil Teacher');
        return hasProfArray || hasLicense || isRankedTeacher;
      }).length;

      // Default enrolment structure
      const defaultEnr: Record<string, [number, number]> = {};
      LV.forEach(([k]) => {
        const savedLevel = raw.enr?.[k];
        defaultEnr[k] = Array.isArray(savedLevel)
          ? [Number(savedLevel[0]) || 0, Number(savedLevel[1]) || 0]
          : [0, 0];
      });
      const enr = override.enr || defaultEnr;

      const totalLearners = Object.values(enr)
        .flat()
        .reduce((a, b) => a + b, 0);

      // Default facilities
      const defaultFac: Record<string, boolean> = {};
      FAC.forEach(f => {
        defaultFac[f] = Boolean(raw.fac?.[f]);
      });
      const fac = override.fac || defaultFac;

      // Default books
      const defaultBooks: Record<string, [number, number]> = {};
      SUBJ.forEach(s => {
        const savedBook = raw.books?.[s];
        const autoReq = Math.round(totalLearners * 0.9);
        if (Array.isArray(savedBook)) {
          const reqVal = Number(savedBook[0]) > 0 ? Number(savedBook[0]) : autoReq;
          defaultBooks[s] = [reqVal, Number(savedBook[1]) || 0];
        } else {
          defaultBooks[s] = [autoReq, 0];
        }
      });
      const books = override.books || defaultBooks;

      // Teachers: combine portal submitted teachers or imported/manual establishment count if higher
      const savedHave = Array.isArray(raw.teachers) ? Number(raw.teachers[0]) || 0 : 0;
      const savedQual = Array.isArray(raw.teachers) ? Number(raw.teachers[1]) || 0 : 0;

      const finalHave =
        override.teachers?.[0] !== undefined
          ? override.teachers[0]
          : Math.max(portalTeachersCount, savedHave);
      const finalQual =
        override.teachers?.[1] !== undefined
          ? override.teachers[1]
          : Math.max(portalQualifiedCount, savedQual);

      return {
        id,
        firestoreId: String(raw.id || '').startsWith('virtual_') ? undefined : raw.id,
        name,
        code: override.code ?? raw.code ?? `TM-${String(1000 + idx * 7)}`,
        cat: raw.cat || 'Basic',
        own: override.own ?? raw.own ?? (name.includes('PRESBY') || name.includes('METHODIST') || name.includes('CATHOLIC') || name.includes('ISLAMIC') || name.includes('ANGLICAN') ? 'Mission' : 'Public'),
        circuit: override.circuit ?? raw.circuit ?? 'ASHAMANG',
        head: override.head ?? raw.head ?? 'Assigned Head',
        status: override.status ?? raw.status ?? 'Verified',
        enr,
        teachers: [finalHave, Math.min(finalHave, finalQual)],
        portalTeachersCount,
        portalQualifiedCount,
        fac,
        books,
        gps: raw.gps || '',
      };
    });
  }, [schoolsData, validSubmissions, teachersBySchool, localOverrides]);

  // All circuits dynamically
  const CIR = useMemo(() => {
    const set = new Set<string>(DEFAULT_CIRCUITS);
    S.forEach(s => {
      if (s.circuit) set.add(s.circuit);
    });
    return Array.from(set).sort();
  }, [S]);

  const activeSchool = useMemo(() => {
    if (!S.length) return null;
    return S.find(x => x.id === selectedSchoolId) || S[0];
  }, [S, selectedSchoolId]);

  // Helper calculations matching the EDMS script
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const boys = (s: EdmsSchool) => sum(Object.values(s.enr).map(v => v[0]));
  const girls = (s: EdmsSchool) => sum(Object.values(s.enr).map(v => v[1]));
  const tot = (s: EdmsSchool) => boys(s) + girls(s);
  const req = (s: EdmsSchool) => Math.max(1, Math.ceil(tot(s) / 35));
  const gap = (s: EdmsSchool) => req(s) - s.teachers[0];
  const fscore = (s: EdmsSchool) => Math.round((FAC.filter(f => s.fac[f]).length / FAC.length) * 100);
  const bratio = (s: EdmsSchool) => {
    const r = sum(SUBJ.map(k => s.books[k][0]));
    if (!r) return 0;
    const a = sum(SUBJ.map(k => Math.min(s.books[k][1], s.books[k][0])));
    return a / r;
  };
  const f1 = (n: number) => Number(n || 0).toLocaleString('en-GB');

  // Persist updates to Firestore `schools` document (or create if virtual)
  const saveSchoolPatch = async (school: EdmsSchool, patch: Partial<EdmsSchool>) => {
    setLocalOverrides(prev => ({
      ...prev,
      [school.id]: { ...(prev[school.id] || {}), ...patch },
    }));

    try {
      const firestorePayload: Record<string, any> = {
        ...patch,
        school: school.name,
        circuit: patch.circuit || school.circuit,
        updatedAt: serverTimestamp(),
      };
      if (school.firestoreId) {
        await updateDoc(doc(db, 'schools', school.firestoreId), firestorePayload);
      } else {
        await addDoc(collection(db, 'schools'), {
          school: school.name,
          circuit: school.circuit,
          code: school.code,
          own: school.own,
          head: school.head,
          status: school.status,
          enr: school.enr,
          teachers: school.teachers,
          fac: school.fac,
          books: school.books,
          ...firestorePayload,
        });
      }
    } catch (err) {
      console.error('Error saving EDMS school patch:', err);
      showToast('Failed to sync change to cloud');
    }
  };

  // Register a new school with Duplicate Check
  const handleAddSchool = async () => {
    const n = newName.trim().toUpperCase();
    const c = newCode.trim().toUpperCase();
    if (!n || !c) {
      showToast('Enter a school name and EMIS code');
      return;
    }

    // Duplicate check by school name or EMIS code
    const duplicate = S.find(
      s => normalizeKey(s.name) === normalizeKey(n) || normalizeKey(s.code) === normalizeKey(c)
    );
    if (duplicate) {
      showToast(`Duplicate blocked: "${duplicate.name}" (${duplicate.code}) already exists!`);
      return;
    }

    const enr: Record<string, [number, number]> = {};
    LV.forEach(([k]) => (enr[k] = [0, 0]));
    const fac: Record<string, boolean> = {};
    FAC.forEach(f => (fac[f] = false));
    const books: Record<string, [number, number]> = {};
    SUBJ.forEach(s => (books[s] = [0, 0]));

    try {
      await addDoc(collection(db, 'schools'), {
        school: n,
        code: c,
        cat: 'Basic',
        own: newOwn,
        circuit: newCir,
        head: newHead.trim() || 'Not assigned',
        status: 'Pending verification',
        enr,
        teachers: [0, 0],
        fac,
        books,
        createdAt: serverTimestamp(),
      });
      setNewName('');
      setNewCode('');
      setNewHead('');
      showToast('School registered');
    } catch (e) {
      console.error(e);
      showToast('Error registering school');
    }
  };

  const handleVerify = (school: EdmsSchool) => {
    saveSchoolPatch(school, { status: 'Verified' });
    showToast('School verified');
  };

  const handleSetEnrol = (school: EdmsSchool, levelKey: string, genderIdx: 0 | 1, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    const nextEnr: Record<string, [number, number]> = { ...school.enr };
    const pair: [number, number] = [...(nextEnr[levelKey] || [0, 0])] as [number, number];
    pair[genderIdx] = num;
    nextEnr[levelKey] = pair;

    // Also update required books based on new learner total if required was 0
    const newTotal = Object.values(nextEnr)
      .flat()
      .reduce((a, b) => a + b, 0);
    const nextBooks: Record<string, [number, number]> = { ...school.books };
    SUBJ.forEach(sub => {
      nextBooks[sub] = [Math.round(newTotal * 0.9), nextBooks[sub]?.[1] || 0];
    });

    saveSchoolPatch(school, { enr: nextEnr, books: nextBooks });
  };

  const handleSetFacility = (school: EdmsSchool, facName: string, checked: boolean) => {
    const nextFac = { ...school.fac, [facName]: checked };
    saveSchoolPatch(school, { fac: nextFac });
  };

  const handleSetBooks = (school: EdmsSchool, subjName: string, typeIdx: 0 | 1, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    const nextBooks = { ...school.books };
    const pair: [number, number] = [...(nextBooks[subjName] || [0, 0])] as [number, number];
    pair[typeIdx] = num;
    nextBooks[subjName] = pair;
    saveSchoolPatch(school, { books: nextBooks });
  };

  // Export Census as CSV or Multi-sheet Excel Workbook (.xlsx)
  const buildCsvString = () => {
    const h = [
      'School',
      'EMIS',
      'Circuit',
      'Ownership',
      'Head teacher',
      'Status',
      'KG Boys',
      'KG Girls',
      'PRI Boys',
      'PRI Girls',
      'JHS Boys',
      'JHS Girls',
      'Boys',
      'Girls',
      'Teachers',
      'Qualified teachers',
      'Required teachers',
      'Facility score %',
      'Textbook coverage %',
    ];
    const rows = S.map(s => [
      s.name,
      s.code,
      s.circuit,
      s.own,
      s.head,
      s.status,
      s.enr.KG?.[0] || 0,
      s.enr.KG?.[1] || 0,
      s.enr.PRI?.[0] || 0,
      s.enr.PRI?.[1] || 0,
      s.enr.JHS?.[0] || 0,
      s.enr.JHS?.[1] || 0,
      boys(s),
      girls(s),
      s.teachers[0],
      s.teachers[1],
      req(s),
      fscore(s),
      Math.round(bratio(s) * 100),
    ]);
    return [h, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  };

  const handleCopyCsv = () => {
    try {
      navigator.clipboard.writeText(buildCsvString()).then(
        () => showToast('Census copied as CSV'),
        () => showToast('Copy blocked. Use Download Workbook instead.')
      );
    } catch {
      showToast('Copy blocked. Use Download Workbook instead.');
    }
  };

  const handleExportWorkbook = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Basic Info
    const basicRows = S.map(s => ({
      School: s.name,
      EMIS: s.code,
      Circuit: s.circuit,
      Ownership: s.own,
      Category: s.cat,
      'Head teacher': s.head,
      Status: s.status,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(basicRows), 'Basic Info');

    // Sheet 2: Enrolment
    const enrolRows = S.map(s => ({
      School: s.name,
      EMIS: s.code,
      'KG Boys': s.enr.KG?.[0] || 0,
      'KG Girls': s.enr.KG?.[1] || 0,
      'PRI Boys': s.enr.PRI?.[0] || 0,
      'PRI Girls': s.enr.PRI?.[1] || 0,
      'JHS Boys': s.enr.JHS?.[0] || 0,
      'JHS Girls': s.enr.JHS?.[1] || 0,
      'Total Boys': boys(s),
      'Total Girls': girls(s),
      Total: tot(s),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(enrolRows), 'Enrolment');

    // Sheet 3: Teaching Staff
    const staffRows = S.map(s => ({
      School: s.name,
      EMIS: s.code,
      Teachers: s.teachers[0],
      'Professionally qualified': s.teachers[1],
      'Portal Submitted Teachers': s.portalTeachersCount,
      Required: req(s),
      Gap: gap(s),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staffRows), 'Teaching Staff');

    // Sheet 4: Facilities
    const facRows = S.map(s => {
      const row: Record<string, any> = { School: s.name, EMIS: s.code };
      FAC.forEach(f => {
        row[f] = s.fac[f] ? 'Yes' : 'No';
      });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(facRows), 'Facilities');

    // Sheet 5: Books Records
    const bookRows = S.map(s => {
      const row: Record<string, any> = { School: s.name, EMIS: s.code };
      SUBJ.forEach(sub => {
        row[`${sub} Required`] = s.books[sub]?.[0] || 0;
        row[`${sub} Available`] = s.books[sub]?.[1] || 0;
      });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bookRows), 'Books Records');

    XLSX.writeFile(wb, `Tema_Metro_EDMS_Census_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Census workbook (.xlsx) downloaded');
  };

  // ── IMPORT WORKBOOK (.xlsx / .csv) WITH DUPLICATE CHECK & SMART MERGE ──
  const handleImportWorkbook = async () => {
    if (!selectedFile) {
      showToast('Please choose an .xlsx or .csv file first');
      return;
    }

    setImporting(true);
    setImportSummary(null);

    try {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      let sheetsData: Record<string, any[]> = {};

      if (ext === 'csv') {
        const text = await selectedFile.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        sheetsData['SingleSheet'] = parsed.data as any[];
      } else {
        const buffer = await selectedFile.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        wb.SheetNames.forEach(name => {
          sheetsData[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
        });
      }

      // Build lookup maps for existing Firestore schools (by normalized Name and by normalized EMIS code)
      const existingByName = new Map<string, EdmsSchool>();
      const existingByCode = new Map<string, EdmsSchool>();
      S.forEach(s => {
        existingByName.set(normalizeKey(s.name), s);
        if (s.code) existingByCode.set(normalizeKey(s.code), s);
      });

      // Accumulate merged school records keyed by normalized school name
      const stagedSchools = new Map<
        string,
        {
          existing?: EdmsSchool;
          school: string;
          code?: string;
          circuit?: string;
          own?: string;
          cat?: string;
          head?: string;
          status?: string;
          enr?: Record<string, [number, number]>;
          teachers?: [number, number];
          fac?: Record<string, boolean>;
          books?: Record<string, [number, number]>;
        }
      >();

      // Also support importing external Teacher rows if the sheet contains Staff ID / Teacher Name
      const stagedTeachers: any[] = [];
      let duplicatesMergedCount = 0;

      const getOrInitStage = (rawName: string, rawCode?: string) => {
        const normName = normalizeKey(rawName);
        const normCode = rawCode ? normalizeKey(rawCode) : '';

        // Check if already staged in this import file (deduplicates within the uploaded file itself!)
        if (stagedSchools.has(normName)) {
          duplicatesMergedCount++;
          return stagedSchools.get(normName)!;
        }

        const matchedExisting =
          existingByName.get(normName) || (normCode ? existingByCode.get(normCode) : undefined);

        const canonicalKey = matchedExisting ? normalizeKey(matchedExisting.name) : normName;
        if (stagedSchools.has(canonicalKey)) {
          duplicatesMergedCount++;
          return stagedSchools.get(canonicalKey)!;
        }

        const item = {
          existing: matchedExisting,
          school: matchedExisting ? matchedExisting.name : rawName.trim().toUpperCase(),
          code: rawCode ? String(rawCode).trim().toUpperCase() : matchedExisting?.code,
          circuit: matchedExisting?.circuit || 'ASHAMANG',
          own: matchedExisting?.own || 'Public',
          cat: matchedExisting?.cat || 'Basic',
          head: matchedExisting?.head || 'Assigned Head',
          status: matchedExisting?.status || 'Verified',
          enr: matchedExisting ? { ...matchedExisting.enr } : undefined,
          teachers: matchedExisting ? ([...matchedExisting.teachers] as [number, number]) : undefined,
          fac: matchedExisting ? { ...matchedExisting.fac } : undefined,
          books: matchedExisting ? { ...matchedExisting.books } : undefined,
        };
        stagedSchools.set(canonicalKey, item);
        return item;
      };

      // Helper to read case-insensitive keys from a row
      const getVal = (row: any, candidates: string[]) => {
        const keys = Object.keys(row);
        for (const cand of candidates) {
          const found = keys.find(k => normalizeKey(k) === normalizeKey(cand));
          if (found !== undefined && row[found] !== '' && row[found] !== null && row[found] !== undefined) {
            return row[found];
          }
        }
        return undefined;
      };

      // Process every sheet in the workbook
      for (const [sheetName, rows] of Object.entries(sheetsData)) {
        const normSheet = normalizeKey(sheetName);

        for (const row of rows) {
          // Check if this is a Teacher submission record row
          const staffIdVal = getVal(row, ['Staff ID', 'staffId', 'Staff_ID', 'Employee ID']);
          const teacherNameVal = getVal(row, ['Teacher Name', 'teacherName', 'Full Name', 'Name of Teacher']);
          if (staffIdVal && teacherNameVal) {
            stagedTeachers.push(row);
            continue;
          }

          const schoolName = getVal(row, ['School', 'School Name', 'school', 'name', 'Institution']);
          const emisCode = getVal(row, ['EMIS', 'EMIS Code', 'code', 'School Code']);
          if (!schoolName && !emisCode) continue;

          const stage = getOrInitStage(String(schoolName || emisCode), emisCode ? String(emisCode) : undefined);

          // 1. Basic Info fields
          const cirVal = getVal(row, ['Circuit', 'Circuit Name']);
          if (cirVal) stage.circuit = String(cirVal).trim().toUpperCase();

          const ownVal = getVal(row, ['Ownership', 'own', 'Type']);
          if (ownVal) stage.own = String(ownVal).trim();

          const headVal = getVal(row, ['Head teacher', 'Headteacher', 'head', 'Head']);
          if (headVal) stage.head = String(headVal).trim();

          const statusVal = getVal(row, ['Status', 'Verification']);
          if (statusVal) stage.status = String(statusVal).trim();

          if (emisCode) stage.code = String(emisCode).trim().toUpperCase();

          // 2. Enrolment fields (supports both wide columns & level-row format)
          const levelRowName = getVal(row, ['Level', 'Stage']);
          if (levelRowName) {
            const normLv = normalizeKey(String(levelRowName));
            const lvCode =
              normLv.includes('KG') || normLv.includes('KINDER')
                ? 'KG'
                : normLv.includes('PRI')
                ? 'PRI'
                : normLv.includes('JHS') || normLv.includes('JUNIOR')
                ? 'JHS'
                : '';
            if (lvCode) {
              if (!stage.enr) stage.enr = { KG: [0, 0], PRI: [0, 0], JHS: [0, 0] };
              const b = parseInt(String(getVal(row, ['Boys', 'Male']) || 0), 10) || 0;
              const g = parseInt(String(getVal(row, ['Girls', 'Female']) || 0), 10) || 0;
              stage.enr[lvCode] = [b, g];
            }
          } else {
            const kgB = getVal(row, ['KG Boys', 'KG_Boys', 'Kindergarten Boys']);
            const kgG = getVal(row, ['KG Girls', 'KG_Girls', 'Kindergarten Girls']);
            const priB = getVal(row, ['PRI Boys', 'Primary Boys', 'PRI_Boys']);
            const priG = getVal(row, ['PRI Girls', 'Primary Girls', 'PRI_Girls']);
            const jhsB = getVal(row, ['JHS Boys', 'Junior High Boys', 'JHS_Boys']);
            const jhsG = getVal(row, ['JHS Girls', 'Junior High Girls', 'JHS_Girls']);
            const totB = getVal(row, ['Boys', 'Total Boys']);
            const totG = getVal(row, ['Girls', 'Total Girls']);

            if (
              kgB !== undefined ||
              kgG !== undefined ||
              priB !== undefined ||
              priG !== undefined ||
              jhsB !== undefined ||
              jhsG !== undefined
            ) {
              if (!stage.enr) stage.enr = { KG: [0, 0], PRI: [0, 0], JHS: [0, 0] };
              if (kgB !== undefined || kgG !== undefined)
                stage.enr.KG = [parseInt(String(kgB || 0), 10) || 0, parseInt(String(kgG || 0), 10) || 0];
              if (priB !== undefined || priG !== undefined)
                stage.enr.PRI = [parseInt(String(priB || 0), 10) || 0, parseInt(String(priG || 0), 10) || 0];
              if (jhsB !== undefined || jhsG !== undefined)
                stage.enr.JHS = [parseInt(String(jhsB || 0), 10) || 0, parseInt(String(jhsG || 0), 10) || 0];
            } else if (totB !== undefined || totG !== undefined) {
              const b = parseInt(String(totB || 0), 10) || 0;
              const g = parseInt(String(totG || 0), 10) || 0;
              if (!stage.enr) stage.enr = { KG: [0, 0], PRI: [0, 0], JHS: [0, 0] };
              stage.enr.KG = [Math.round(b * 0.2), Math.round(g * 0.2)];
              stage.enr.PRI = [Math.round(b * 0.55), Math.round(g * 0.55)];
              stage.enr.JHS = [b - Math.round(b * 0.75), g - Math.round(g * 0.75)];
            }
          }

          // 3. Teaching Staff fields
          const tHave = getVal(row, ['Teachers', 'Have', 'Total Teachers', 'Teaching Staff']);
          const tQual = getVal(row, ['Qualified teachers', 'Professionally qualified', 'Qualified']);
          if (tHave !== undefined || tQual !== undefined) {
            const curH = stage.teachers?.[0] || 0;
            const curQ = stage.teachers?.[1] || 0;
            const newH = tHave !== undefined ? parseInt(String(tHave), 10) || 0 : curH;
            const newQ = tQual !== undefined ? parseInt(String(tQual), 10) || 0 : Math.min(newH, curQ || newH);
            stage.teachers = [newH, Math.min(newH, newQ)];
          }

          // 4. Facilities fields
          FAC.forEach(f => {
            const fVal = getVal(row, [f]);
            if (fVal !== undefined) {
              if (!stage.fac) {
                stage.fac = {};
                FAC.forEach(k => (stage.fac![k] = false));
              }
              const sVal = String(fVal).trim().toLowerCase();
              stage.fac[f] = sVal === 'yes' || sVal === 'true' || sVal === '1' || sVal === 'checked' || sVal === 'ok';
            }
          });

          // 5. Books Records fields
          const subjCol = getVal(row, ['Subject']);
          if (subjCol && normSheet.includes('BOOK')) {
            const matchedSubj = SUBJ.find(s => normalizeKey(s) === normalizeKey(String(subjCol)));
            if (matchedSubj) {
              if (!stage.books) {
                stage.books = {};
                SUBJ.forEach(k => (stage.books![k] = [0, 0]));
              }
              const reqB = parseInt(String(getVal(row, ['Required']) || 0), 10) || 0;
              const availB = parseInt(String(getVal(row, ['Available']) || 0), 10) || 0;
              stage.books[matchedSubj] = [reqB, availB];
            }
          } else {
            SUBJ.forEach(sub => {
              const reqB = getVal(row, [`${sub} Required`, `${sub}_Required`]);
              const availB = getVal(row, [`${sub} Available`, `${sub}_Available`, sub]);
              if (reqB !== undefined || availB !== undefined) {
                if (!stage.books) {
                  stage.books = {};
                  SUBJ.forEach(k => (stage.books![k] = [0, 0]));
                }
                const curR = stage.books[sub]?.[0] || 0;
                const curA = stage.books[sub]?.[1] || 0;
                stage.books[sub] = [
                  reqB !== undefined ? parseInt(String(reqB), 10) || 0 : curR,
                  availB !== undefined ? parseInt(String(availB), 10) || 0 : curA,
                ];
              }
            });
          }
        }
      }

      // If replace mode is selected, delete existing schools that are NOT in the imported workbook
      if (importMode === 'replace' && stagedSchools.size > 0) {
        const importedKeys = new Set(stagedSchools.keys());
        const deletePromises = schoolsData
          .filter((raw: any) => !importedKeys.has(normalizeKey(raw.school || raw.name || '')))
          .map((raw: any) => deleteDoc(doc(db, 'schools', raw.id)));
        await Promise.all(deletePromises);
      }

      // Commit staged schools to Firestore with strict duplicate prevention
      let schoolsAdded = 0;
      let schoolsUpdated = 0;

      const writePromises: Promise<any>[] = [];
      for (const item of stagedSchools.values()) {
        const payload: Record<string, any> = {
          school: item.school,
          circuit: item.circuit || 'ASHAMANG',
          code: item.code || `TM-${Math.floor(1000 + Math.random() * 9000)}`,
          own: item.own || 'Public',
          cat: item.cat || 'Basic',
          head: item.head || 'Assigned Head',
          status: item.status || 'Verified',
          updatedAt: serverTimestamp(),
        };
        if (item.enr) payload.enr = item.enr;
        if (item.teachers) payload.teachers = item.teachers;
        if (item.fac) payload.fac = item.fac;
        if (item.books) payload.books = item.books;

        if (item.existing?.firestoreId) {
          schoolsUpdated++;
          writePromises.push(updateDoc(doc(db, 'schools', item.existing.firestoreId), payload));
        } else {
          schoolsAdded++;
          writePromises.push(
            addDoc(collection(db, 'schools'), {
              ...payload,
              createdAt: serverTimestamp(),
            })
          );
        }
      }

      // Commit any external teacher rows with Staff ID duplicate check
      let teachersAdded = 0;
      let teachersUpdated = 0;
      if (stagedTeachers.length > 0) {
        const existingSubByStaffId = new Map<string, any>();
        submissions.forEach((sub: any) => {
          if (sub.staffId) {
            existingSubByStaffId.set(normalizeKey(sub.staffId), sub);
          }
        });

        const seenStaffIdsInFile = new Set<string>();

        for (const tRow of stagedTeachers) {
          const rawStaffId = String(getVal(tRow, ['Staff ID', 'staffId', 'Staff_ID', 'Employee ID']) || '').trim();
          const normStaffId = normalizeKey(rawStaffId);
          if (!normStaffId) continue;

          if (seenStaffIdsInFile.has(normStaffId)) {
            duplicatesMergedCount++;
            continue;
          }
          seenStaffIdsInFile.add(normStaffId);

          const teacherName = String(
            getVal(tRow, ['Teacher Name', 'teacherName', 'Full Name', 'Name of Teacher']) || ''
          )
            .trim()
            .toUpperCase();
          const school = String(getVal(tRow, ['School', 'School Name', 'school']) || '')
            .trim()
            .toUpperCase();
          const circuit = String(getVal(tRow, ['Circuit', 'circuit']) || '')
            .trim()
            .toUpperCase();
          const category = String(getVal(tRow, ['Category', 'category']) || 'BASIC SCHOOL')
            .trim()
            .toUpperCase();
          const currentRank = String(getVal(tRow, ['Current Rank', 'Rank', 'currentRank']) || '').trim();
          const regNo = String(getVal(tRow, ['Reg. No.', 'Reg No', 'regNo']) || '').trim();
          const mobile = String(getVal(tRow, ['Mobile', 'Mobile No.', 'Phone']) || '').trim();
          const email = String(getVal(tRow, ['Email', 'email']) || '').trim();

          const existingSub = existingSubByStaffId.get(normStaffId);
          if (existingSub) {
            teachersUpdated++;
            duplicatesMergedCount++;
            writePromises.push(
              updateDoc(doc(db, 'submissions', existingSub.id), {
                teacherName: teacherName || existingSub.teacherName,
                school: school || existingSub.school,
                circuit: circuit || existingSub.circuit,
                category: category || existingSub.category,
                currentRank: currentRank || existingSub.currentRank,
                regNo: regNo || existingSub.regNo,
                mobile: mobile || existingSub.mobile,
                email: email || existingSub.email,
                status: 'submitted',
                updatedAt: serverTimestamp(),
              })
            );
          } else {
            teachersAdded++;
            writePromises.push(
              addDoc(collection(db, 'submissions'), {
                staffId: rawStaffId,
                teacherName,
                school,
                circuit,
                category,
                currentRank,
                regNo,
                mobile,
                email,
                status: 'submitted',
                submittedAt: serverTimestamp(),
              })
            );
          }
        }
      }

      await Promise.all(writePromises);

      setImportSummary({
        schoolsAdded,
        schoolsUpdated,
        DuplicatesSkippedOrMerged: duplicatesMergedCount,
        teachersAdded,
        teachersUpdated,
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast(
        `Workbook imported: ${schoolsAdded} new, ${schoolsUpdated} updated (${duplicatesMergedCount} duplicates merged)`
      );
    } catch (err: any) {
      console.error('Import workbook error:', err);
      showToast(`Import failed: ${err?.message || 'Check file format'}`);
    } finally {
      setImporting(false);
    }
  };

  // Filtered school list for Schools page
  const filteredSchools = useMemo(() => {
    return S.filter(
      s =>
        (cir === 'All' || s.circuit === cir) &&
        (s.name + ' ' + s.code + ' ' + s.head).toLowerCase().includes(q.toLowerCase())
    );
  }, [S, cir, q]);

  const PAGES: [typeof page, string][] = [
    ['dash', 'Dashboard'],
    ['schools', 'Schools'],
    ['enrol', 'Enrolment'],
    ['staff', 'Teaching staff'],
    ['fac', 'Facilities'],
    ['books', 'Textbooks'],
    ['rep', 'Reports'],
  ];

  // School Picker Dropdown used across Enrolment, Facilities, Textbooks
  const renderPicker = () => (
    <div className="edms-row">
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
        School{' '}
        <select
          value={activeSchool?.id || ''}
          onChange={e => setSelectedSchoolId(e.target.value)}
        >
          {S.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.circuit})
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  // SVG Bar chart for Enrolment by level
  const renderBars = (data: { k: string; v: [number, number] }[], h = 170) => {
    const mx = Math.max(1, ...data.map(d => d.v[0] + d.v[1]));
    return (
      <>
        <svg viewBox={`0 0 300 ${h + 30}`} width="100%" role="img" aria-label="Enrolment by level">
          {data.map((d, i) => {
            const x = i * (300 / data.length) + 20;
            const bw = 300 / data.length - 40;
            const hb = (d.v[0] / mx) * h;
            const hg = (d.v[1] / mx) * h;
            return (
              <g key={d.k}>
                <rect x={x} y={h - hb} width={bw / 2} height={hb} fill="var(--pr)" />
                <rect x={x + bw / 2} y={h - hg} width={bw / 2} height={hg} fill="var(--ac)" />
                <text x={x + bw / 2} y={h + 16} textAnchor="middle" fontSize="11" fill="var(--mu)">
                  {d.k}
                </text>
                <text
                  x={x + bw / 2}
                  y={h - Math.max(hb, hg) - 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--tx)"
                >
                  {f1(d.v[0] + d.v[1])}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="edms-note">
          <span style={{ color: 'var(--pr)' }}>■</span> Boys &nbsp;
          <span style={{ color: 'var(--ac)' }}>■</span> Girls
        </div>
      </>
    );
  };

  return (
    <div className="edms-scope" data-theme={theme}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=Public+Sans:wght@400;500;600&display=swap');
        .edms-scope {
          --bg: #f3f5f1;
          --sf: #fff;
          --tx: #17231d;
          --mu: #5c6b62;
          --ln: #d9dfd8;
          --pr: #14503a;
          --pt: #fff;
          --ac: #c58a12;
          --bad: #b4442c;
          --ok: #2f7d4f;
          --nav: #12372a;
          --navt: #d6e5dc;
          box-sizing: border-box;
          color-scheme: light;
          background: var(--bg);
          color: var(--tx);
          font: 15px/1.5 "Public Sans", system-ui, sans-serif;
          min-height: 100vh;
        }
        .edms-scope[data-theme="dark"] {
          --bg: #0f1713;
          --sf: #17221c;
          --tx: #e6eee9;
          --mu: #9bb0a4;
          --ln: #2a3a31;
          --pr: #5bbf8f;
          --pt: #0b1a12;
          --ac: #e0a93a;
          --bad: #e5836b;
          --ok: #6cc890;
          --nav: #0a110e;
          --navt: #b8cfc2;
          color-scheme: dark;
        }
        .edms-scope * { box-sizing: border-box; }
        .edms-scope h1, .edms-scope h2, .edms-scope h3 {
          font-family: "Bricolage Grotesque", "Public Sans", sans-serif;
          margin: 0;
          letter-spacing: -.01em;
        }
        .edms-app {
          display: grid;
          grid-template-columns: 220px 1fr;
          min-height: 100vh;
        }
        .edms-nav {
          background: var(--nav);
          color: var(--navt);
          padding: 20px 12px;
          position: sticky;
          top: 0;
          height: 100vh;
          align-self: start;
          display: flex;
          flex-direction: column;
        }
        .edms-nav .brand {
          font: 700 20px "Bricolage Grotesque", sans-serif;
          color: #fff;
          padding: 0 10px 4px;
        }
        .edms-nav small {
          display: block;
          padding: 0 10px 18px;
          opacity: .7;
          font-size: 12px;
        }
        .edms-nav button {
          display: block;
          width: 100%;
          text-align: left;
          background: none;
          border: 0;
          color: inherit;
          font: inherit;
          padding: 9px 10px;
          border-radius: 6px;
          cursor: pointer;
        }
        .edms-nav button:hover { background: rgba(255,255,255,.08); }
        .edms-nav button[aria-current="page"] {
          background: var(--ac);
          color: #201603;
          font-weight: 600;
        }
        .edms-nav .th {
          margin-top: 18px;
          border-top: 1px solid rgba(255,255,255,.15);
          padding-top: 12px;
          font-size: 13px;
        }
        .edms-main {
          padding: 24px clamp(14px, 3vw, 36px);
          min-width: 0;
        }
        .edms-top {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .edms-top p { margin: 2px 0 0; color: var(--mu); }
        .edms-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }
        .edms-kpi {
          background: var(--sf);
          border: 1px solid var(--ln);
          border-left: 4px solid var(--pr);
          padding: 12px 14px;
          border-radius: 4px;
        }
        .edms-kpi b {
          display: block;
          font: 700 26px "Bricolage Grotesque", sans-serif;
        }
        .edms-kpi span { color: var(--mu); font-size: 13px; }
        .edms-kpi.w { border-left-color: var(--bad); }
        .edms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 14px;
        }
        .edms-card {
          background: var(--sf);
          border: 1px solid var(--ln);
          border-radius: 6px;
          padding: 16px;
          min-width: 0;
        }
        .edms-card h3 { font-size: 17px; margin-bottom: 10px; }
        .edms-tw { overflow-x: auto; }
        .edms-scope table {
          border-collapse: collapse;
          width: 100%;
          font-size: 14px;
        }
        .edms-scope th, .edms-scope td {
          text-align: left;
          padding: 8px 10px;
          border-bottom: 1px solid var(--ln);
          white-space: nowrap;
        }
        .edms-scope th {
          font-weight: 600;
          color: var(--mu);
          font-size: 13px;
        }
        .edms-scope td.n, .edms-scope th.n {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .edms-scope input:not([type="file"]):not([type="checkbox"]), .edms-scope select {
          font: inherit;
          color: var(--tx);
          background: var(--bg);
          border: 1px solid var(--ln);
          border-radius: 4px;
          padding: 7px 9px;
          min-width: 0;
        }
        .edms-scope input[type="number"] { width: 84px; text-align: right; }
        .edms-scope button.b {
          background: var(--pr);
          color: var(--pt);
          border: 0;
          border-radius: 4px;
          padding: 8px 14px;
          font: 600 14px "Public Sans", sans-serif;
          cursor: pointer;
        }
        .edms-scope button.b:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .edms-scope button.g {
          background: none;
          border: 1px solid var(--ln);
          color: var(--tx);
          border-radius: 4px;
          padding: 6px 10px;
          cursor: pointer;
          font: inherit;
        }
        .edms-tag {
          display: inline-block;
          padding: 1px 8px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
        }
        .edms-tag.ok {
          background: color-mix(in srgb, var(--ok) 18%, transparent);
          color: var(--ok);
        }
        .edms-tag.bad {
          background: color-mix(in srgb, var(--bad) 18%, transparent);
          color: var(--bad);
        }
        .edms-tag.am {
          background: color-mix(in srgb, var(--ac) 22%, transparent);
          color: var(--ac);
        }
        .edms-bar {
          height: 8px;
          background: var(--ln);
          border-radius: 4px;
          overflow: hidden;
          min-width: 70px;
        }
        .edms-bar i {
          display: block;
          height: 100%;
          background: var(--pr);
        }
        .edms-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: 12px;
        }
        .edms-fg {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }
        .edms-fg label {
          display: flex;
          flex-direction: column;
          font-size: 13px;
          color: var(--mu);
          gap: 3px;
        }
        .edms-chk {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 6px;
        }
        .edms-chk label {
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 6px 8px;
          border: 1px solid var(--ln);
          border-radius: 4px;
          cursor: pointer;
        }
        .edms-note { color: var(--mu); font-size: 13px; }
        .edms-toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: var(--tx);
          color: var(--bg);
          padding: 10px 16px;
          border-radius: 6px;
          z-index: 9999;
          font-weight: 600;
          box-shadow: 0 10px 25px rgba(0,0,0,0.25);
        }
        @media (max-width: 760px) {
          .edms-app { grid-template-columns: 1fr; }
          .edms-nav {
            position: static;
            height: auto;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 4px;
            padding: 12px;
          }
          .edms-nav .brand, .edms-nav small { width: 100%; }
          .edms-nav button { width: auto; }
          .edms-nav .th { margin: 0; border: 0; padding: 0; }
        }
      `}</style>

      <div className="edms-app">
        <nav className="edms-nav">
          <div className="brand">EDMS</div>
          <small>Tema Metro Education Directorate</small>
          {PAGES.map(([k, n]) => (
            <button
              key={k}
              aria-current={page === k ? 'page' : undefined}
              onClick={() => setPage(k)}
            >
              {n}
            </button>
          ))}
          <div className="th">
            <button onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
              Switch light / dark
            </button>
            {onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                style={{ marginTop: '6px', opacity: 0.85 }}
              >
                ← Admin Records Panel
              </button>
            )}
          </div>
        </nav>

        <main className="edms-main">
          {/* 1. DASHBOARD */}
          {page === 'dash' && (() => {
            const T = sum(S.map(tot));
            const Tt = sum(S.map(s => s.teachers[0]));
            const B = sum(S.map(boys));
            const G = sum(S.map(girls));
            const lv = LV.map(([k, n]) => ({
              k: n,
              v: [
                sum(S.map(s => s.enr[k]?.[0] || 0)),
                sum(S.map(s => s.enr[k]?.[1] || 0)),
              ] as [number, number],
            }));
            const def = S.filter(s => gap(s) > 0)
              .sort((a, b) => gap(b) - gap(a))
              .slice(0, 5);
            const low = [...S].sort((a, b) => fscore(a) - fscore(b)).slice(0, 5);
            const cls = Math.max(1, sum(S.map(() => LV.reduce((a, l) => a + l[2], 0))));
            const avgBratio = S.length ? sum(S.map(bratio)) / S.length : 0;
            const ptr = Tt ? T / Tt : 0;

            return (
              <>
                <div className="edms-top">
                  <div>
                    <h1>Municipal overview</h1>
                    <p>
                      Academic year 2025/26 · {S.length} schools in the directorate ·{' '}
                      {validSubmissions.length} submitted staff records mapped
                    </p>
                  </div>
                </div>

                <div className="edms-kpis">
                  <div className="edms-kpi">
                    <b>{S.length}</b>
                    <span>Schools</span>
                  </div>
                  <div className="edms-kpi">
                    <b>{f1(T)}</b>
                    <span>Learners</span>
                  </div>
                  <div className="edms-kpi">
                    <b>{f1(Tt)}</b>
                    <span>Teachers ({validSubmissions.length} portal records)</span>
                  </div>
                  <div className="edms-kpi">
                    <b>{B ? (G / B).toFixed(2) : '1.00'}</b>
                    <span>Gender parity index</span>
                  </div>
                  <div className={`edms-kpi ${ptr > 35 ? 'w' : ''}`}>
                    <b>{Tt ? `${ptr.toFixed(1)}:1` : '–'}</b>
                    <span>Pupil–teacher ratio</span>
                  </div>
                  <div className="edms-kpi">
                    <b>{(T / cls).toFixed(0)}</b>
                    <span>Learners per classroom</span>
                  </div>
                  <div className={`edms-kpi ${avgBratio < 0.8 ? 'w' : ''}`}>
                    <b>{(avgBratio * 100).toFixed(0)}%</b>
                    <span>Textbook coverage</span>
                  </div>
                </div>

                <div className="edms-grid">
                  <div className="edms-card">
                    <h3>Enrolment by level</h3>
                    {renderBars(lv)}
                  </div>

                  <div className="edms-card">
                    <h3>Largest teacher deficits</h3>
                    <div className="edms-tw">
                      <table>
                        <thead>
                          <tr>
                            <th>School</th>
                            <th className="n">Have</th>
                            <th className="n">Need</th>
                            <th className="n">Gap</th>
                          </tr>
                        </thead>
                        <tbody>
                          {def.length > 0 ? (
                            def.map(s => (
                              <tr key={s.id}>
                                <td>{s.name}</td>
                                <td className="n">{s.teachers[0]}</td>
                                <td className="n">{req(s)}</td>
                                <td className="n">
                                  <span className="edms-tag bad">−{gap(s)}</span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4}>No deficits</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <p className="edms-note">
                      Need = learners ÷ 35 (Have is automatically mapped from submitted teacher records).
                    </p>
                  </div>

                  <div className="edms-card">
                    <h3>Weakest infrastructure</h3>
                    <div className="edms-tw">
                      <table>
                        <tbody>
                          {low.map(s => (
                            <tr key={s.id}>
                              <td>{s.name}</td>
                              <td style={{ width: '40%' }}>
                                <div className="edms-bar">
                                  <i style={{ width: `${fscore(s)}%`, background: 'var(--bad)' }} />
                                </div>
                              </td>
                              <td className="n">{fscore(s)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {/* 2. SCHOOLS (With Register + Import Workbook + Duplicate Check) */}
          {page === 'schools' && (
            <>
              <div className="edms-top">
                <div>
                  <h1>Schools</h1>
                  <p>Register, import, search and verify school profiles</p>
                </div>
              </div>

              {/* Import census workbook (.xlsx) Card matching user screenshot */}
              <div className="edms-card" style={{ marginBottom: '14px' }}>
                <h3>Import census workbook (.xlsx)</h3>
                <p className="edms-note" style={{ margin: '4px 0 12px' }}>
                  Reads Basic Info, Enrolment, Teaching Staff, Facilities and Books Records (or external Teacher lists).
                  Includes automatic duplicate check by EMIS code, School Name, and Staff ID to avoid data redundancy.
                </p>
                <div className="edms-row" style={{ marginBottom: '10px' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                    style={{ fontSize: '14px', color: 'var(--tx)' }}
                  />
                  <label style={{ fontSize: '13px', color: 'var(--mu)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    Duplicate handling:
                    <select
                      value={importMode}
                      onChange={e => setImportMode(e.target.value as 'merge' | 'replace')}
                    >
                      <option value="merge">Smart Merge & Skip Redundant Duplicates (Recommended)</option>
                      <option value="replace">Replace Existing Census Data</option>
                    </select>
                  </label>
                </div>
                <div className="edms-row" style={{ marginBottom: 0 }}>
                  <button
                    className="b"
                    onClick={handleImportWorkbook}
                    disabled={!selectedFile || importing}
                    style={{ background: '#14503a', color: '#fff' }}
                  >
                    {importing ? 'Importing workbook...' : 'Import workbook'}
                  </button>
                  <button className="g" onClick={handleExportWorkbook}>
                    Download template / current workbook (.xlsx)
                  </button>
                </div>

                {importSummary && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 12px',
                      borderRadius: '4px',
                      border: '1px solid var(--ln)',
                      background: 'var(--bg)',
                      fontSize: '13px',
                    }}
                  >
                    <strong style={{ color: 'var(--ok)' }}>Import Complete (Zero Redundancy):</strong>{' '}
                    {importSummary.schoolsAdded} new schools added, {importSummary.schoolsUpdated} existing schools updated,{' '}
                    {importSummary.DuplicatesSkippedOrMerged} duplicate rows merged
                    {(importSummary.teachersAdded > 0 || importSummary.teachersUpdated > 0) &&
                      `, ${importSummary.teachersAdded} new teachers imported, ${importSummary.teachersUpdated} existing teachers updated`}
                    .
                  </div>
                )}
              </div>

              {/* Register a school */}
              <div className="edms-card" style={{ marginBottom: '14px' }}>
                <h3>Register a school</h3>
                <div className="edms-fg">
                  <label>
                    School name
                    <input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="e.g. TEMA REGULAR BAPTIST BASIC"
                    />
                  </label>
                  <label>
                    EMIS code
                    <input
                      value={newCode}
                      onChange={e => setNewCode(e.target.value)}
                      placeholder="TM-1500"
                    />
                  </label>
                  <label>
                    Ownership
                    <select value={newOwn} onChange={e => setNewOwn(e.target.value)}>
                      <option>Public</option>
                      <option>Private</option>
                      <option>Mission</option>
                    </select>
                  </label>
                  <label>
                    Circuit
                    <select value={newCir} onChange={e => setNewCir(e.target.value)}>
                      {CIR.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Head teacher
                    <input
                      value={newHead}
                      onChange={e => setNewHead(e.target.value)}
                      placeholder="Head teacher name"
                    />
                  </label>
                </div>
                <button className="b" onClick={handleAddSchool}>
                  Register school
                </button>
              </div>

              {/* Filter row */}
              <div className="edms-row">
                <input
                  placeholder="Search name or EMIS code"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                />
                <select value={cir} onChange={e => setCir(e.target.value)}>
                  {['All', ...CIR].map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="edms-card edms-tw">
                <table>
                  <thead>
                    <tr>
                      <th>School</th>
                      <th>EMIS</th>
                      <th>Ownership</th>
                      <th>Circuit</th>
                      <th>Head teacher</th>
                      <th className="n">Learners</th>
                      <th className="n">Portal Staff</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSchools.length > 0 ? (
                      filteredSchools.map(s => (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>{s.code}</td>
                          <td>{s.own}</td>
                          <td>{s.circuit}</td>
                          <td>{s.head}</td>
                          <td className="n">{f1(tot(s))}</td>
                          <td className="n">{s.portalTeachersCount}</td>
                          <td>
                            <span className={`edms-tag ${s.status === 'Verified' ? 'ok' : 'am'}`}>
                              {s.status}
                            </span>
                          </td>
                          <td>
                            {s.status !== 'Verified' && (
                              <button className="g" onClick={() => handleVerify(s)}>
                                Verify
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9}>No schools match. Clear the search or change the circuit.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 3. ENROLMENT */}
          {page === 'enrol' && activeSchool && (
            <>
              <div className="edms-top">
                <div>
                  <h1>Enrolment</h1>
                  <p>Totals and checks update as you type and sync automatically</p>
                </div>
              </div>
              {renderPicker()}
              <div className="edms-card edms-tw">
                <table>
                  <thead>
                    <tr>
                      <th>Level</th>
                      <th className="n">Boys</th>
                      <th className="n">Girls</th>
                      <th className="n">Total</th>
                      <th className="n">Classes</th>
                      <th className="n">Avg class size</th>
                      <th>Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LV.map(([k, n, c]) => {
                      const [b, g] = activeSchool.enr[k] || [0, 0];
                      const t = b + g;
                      const av = t / c;
                      const w =
                        t && (g / (b || 1) < 0.6 || g / (b || 1) > 1.6)
                          ? 'Gender ratio looks unusual'
                          : av > 45
                          ? 'Class size above 45'
                          : '';
                      return (
                        <tr key={k}>
                          <td>{n}</td>
                          <td className="n">
                            <input
                              type="number"
                              min={0}
                              value={b}
                              onChange={e => handleSetEnrol(activeSchool, k, 0, e.target.value)}
                            />
                          </td>
                          <td className="n">
                            <input
                              type="number"
                              min={0}
                              value={g}
                              onChange={e => handleSetEnrol(activeSchool, k, 1, e.target.value)}
                            />
                          </td>
                          <td className="n">{t}</td>
                          <td className="n">{c}</td>
                          <td className="n">{av.toFixed(1)}</td>
                          <td>
                            {w ? (
                              <span className="edms-tag bad">{w}</span>
                            ) : (
                              <span className="edms-tag ok">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <th>All levels</th>
                      <th className="n">{boys(activeSchool)}</th>
                      <th className="n">{girls(activeSchool)}</th>
                      <th className="n">{tot(activeSchool)}</th>
                      <th></th>
                      <th></th>
                      <th>
                        GPI {(girls(activeSchool) / (boys(activeSchool) || 1)).toFixed(2)}
                      </th>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 4. TEACHING STAFF (Mapped to Submitted Teacher Records) */}
          {page === 'staff' && (
            <>
              <div className="edms-top">
                <div>
                  <h1>Teaching staff</h1>
                  <p>
                    Establishment, deficit or surplus, and qualification mix mapped directly from submitted records
                  </p>
                </div>
              </div>
              <div className="edms-card edms-tw">
                <table>
                  <thead>
                    <tr>
                      <th>School</th>
                      <th>Circuit</th>
                      <th className="n">Learners</th>
                      <th className="n">Teachers (Portal)</th>
                      <th className="n">Required</th>
                      <th>Position</th>
                      <th className="n">PTR</th>
                      <th className="n">Professionally qualified</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {S.map(s => {
                      const g = gap(s);
                      const qPct = s.teachers[0] ? Math.round((s.teachers[1] / s.teachers[0]) * 100) : 0;
                      const schoolSubmittedTeachers = teachersBySchool[normalizeKey(s.name)] || [];
                      const isExpanded = expandedSchoolStaff === s.id;

                      return (
                        <React.Fragment key={s.id}>
                          <tr>
                            <td>{s.name}</td>
                            <td>{s.circuit}</td>
                            <td className="n">{f1(tot(s))}</td>
                            <td className="n">
                              <b>{s.teachers[0]}</b>{' '}
                              <span className="edms-note">({s.portalTeachersCount} submitted)</span>
                            </td>
                            <td className="n">{req(s)}</td>
                            <td>
                              <span className={`edms-tag ${g > 0 ? 'bad' : g < 0 ? 'am' : 'ok'}`}>
                                {g > 0 ? `Deficit ${g}` : g < 0 ? `Surplus ${-g}` : 'Balanced'}
                              </span>
                            </td>
                            <td className="n">
                              {s.teachers[0] ? (tot(s) / s.teachers[0]).toFixed(1) : '–'}
                            </td>
                            <td className="n">{qPct}%</td>
                            <td>
                              {schoolSubmittedTeachers.length > 0 && (
                                <button
                                  className="g"
                                  onClick={() =>
                                    setExpandedSchoolStaff(isExpanded ? null : s.id)
                                  }
                                >
                                  {isExpanded ? 'Hide staff' : `View ${schoolSubmittedTeachers.length} staff`}
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={9} style={{ background: 'var(--bg)', padding: '12px 16px' }}>
                                <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '13px' }}>
                                  Submitted Teachers at {s.name} ({schoolSubmittedTeachers.length})
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {schoolSubmittedTeachers.map((t: any) => (
                                    <span
                                      key={t.id}
                                      className="edms-tag ok"
                                      style={{ padding: '4px 10px' }}
                                    >
                                      {t.teacherName || `${t.firstName || ''} ${t.surname || ''}`} · ID:{' '}
                                      {t.staffId} · {t.currentRank || 'Teacher'}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 5. FACILITIES */}
          {page === 'fac' && activeSchool && (() => {
            const miss = FAC.filter(f => !activeSchool.fac[f]);
            return (
              <>
                <div className="edms-top">
                  <div>
                    <h1>Facilities</h1>
                    <p>Tick what the school has; the score and gap list follow</p>
                  </div>
                </div>
                {renderPicker()}
                <div className="edms-grid">
                  <div className="edms-card">
                    <h3>Checklist · {fscore(activeSchool)}% complete</h3>
                    <div className="edms-chk">
                      {FAC.map(f => (
                        <label key={f}>
                          <input
                            type="checkbox"
                            checked={Boolean(activeSchool.fac[f])}
                            onChange={e => handleSetFacility(activeSchool, f, e.target.checked)}
                          />
                          {f}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="edms-card">
                    <h3>Gap analysis</h3>
                    {miss.length ? (
                      <>
                        <p className="edms-note">
                          {miss.length} items missing. Include in the improvement plan:
                        </p>
                        <ul>
                          {miss.map(f => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p>No gaps recorded for this school.</p>
                    )}
                    <h3 style={{ marginTop: '14px' }}>ICT readiness</h3>
                    <p style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {['ICT lab', 'Electricity', 'Internet'].map(f => (
                        <span
                          key={f}
                          className={`edms-tag ${activeSchool.fac[f] ? 'ok' : 'bad'}`}
                        >
                          {f}
                        </span>
                      ))}
                    </p>
                  </div>
                </div>
              </>
            );
          })()}

          {/* 6. TEXTBOOKS */}
          {page === 'books' && activeSchool && (
            <>
              <div className="edms-top">
                <div>
                  <h1>Textbooks</h1>
                  <p>Required against available, with the shortage to procure</p>
                </div>
              </div>
              {renderPicker()}
              <div className="edms-card edms-tw">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th className="n">Required</th>
                      <th className="n">Available</th>
                      <th className="n">Shortage</th>
                      <th>Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SUBJ.map(k => {
                      const [r, a] = activeSchool.books[k] || [0, 0];
                      const sh = Math.max(0, r - a);
                      const p = Math.min(100, Math.round((a / (r || 1)) * 100));
                      return (
                        <tr key={k}>
                          <td>{k}</td>
                          <td className="n">
                            <input
                              type="number"
                              min={0}
                              value={r}
                              onChange={e => handleSetBooks(activeSchool, k, 0, e.target.value)}
                            />
                          </td>
                          <td className="n">
                            <input
                              type="number"
                              min={0}
                              value={a}
                              onChange={e => handleSetBooks(activeSchool, k, 1, e.target.value)}
                            />
                          </td>
                          <td className="n">
                            {sh ? <span className="edms-tag bad">{sh}</span> : '0'}
                          </td>
                          <td style={{ width: '30%' }}>
                            <div className="edms-bar">
                              <i style={{ width: `${p}%` }} />
                            </div>{' '}
                            {p}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 7. REPORTS */}
          {page === 'rep' && (() => {
            const tb = S.map(s => ({
              s,
              short: SUBJ.reduce(
                (a, k) => a + Math.max(0, (s.books[k]?.[0] || 0) - (s.books[k]?.[1] || 0)),
                0
              ),
            }));
            return (
              <>
                <div className="edms-top">
                  <div>
                    <h1>Reports</h1>
                    <p>School census summary, ready to paste into Excel or download as .xlsx</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="b" onClick={handleCopyCsv}>
                      Copy census as CSV
                    </button>
                    <button className="g" onClick={handleExportWorkbook}>
                      Export .xlsx workbook
                    </button>
                  </div>
                </div>

                <div className="edms-grid">
                  <div className="edms-card" style={{ gridColumn: '1 / -1' }}>
                    <h3>School census report</h3>
                    <div className="edms-tw">
                      <table>
                        <thead>
                          <tr>
                            <th>School</th>
                            <th>Circuit</th>
                            <th className="n">Boys</th>
                            <th className="n">Girls</th>
                            <th className="n">Teachers</th>
                            <th className="n">Facilities</th>
                            <th className="n">Books</th>
                          </tr>
                        </thead>
                        <tbody>
                          {S.map(s => (
                            <tr key={s.id}>
                              <td>{s.name}</td>
                              <td>{s.circuit}</td>
                              <td className="n">{boys(s)}</td>
                              <td className="n">{girls(s)}</td>
                              <td className="n">{s.teachers[0]}</td>
                              <td className="n">{fscore(s)}%</td>
                              <td className="n">{Math.round(bratio(s) * 100)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="edms-card">
                    <h3>Procurement: textbook shortages</h3>
                    <p className="edms-note">
                      Total copies to buy: <b>{f1(sum(tb.map(x => x.short)))}</b>
                    </p>
                  </div>

                  <div className="edms-card">
                    <h3>Staffing</h3>
                    <p className="edms-note">
                      Teachers needed to meet the 35:1 norm:{' '}
                      <b>{sum(S.map(s => Math.max(0, gap(s))))}</b>. Surplus posts:{' '}
                      <b>{sum(S.map(s => Math.max(0, -gap(s))))}</b>.
                    </p>
                  </div>
                </div>
              </>
            );
          })()}

          {toastMsg && (
            <div className="edms-toast" role="status">
              {toastMsg}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
