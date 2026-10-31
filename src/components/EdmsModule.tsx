import React, { useMemo, useRef, useState } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  BookOpen,
  Building2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  School,
  Upload,
  Users,
  Sun,
  Moon,
  ArrowLeft,
  Download,
  Printer,
  Plus,
  CheckCircle2,
  Edit3,
  LayoutGrid,
  Table as TableIcon,
  BarChart3,
  Search,
  X,
  ChevronRight,
} from 'lucide-react';

const FAC: [string, string][] = [
  ['lab', 'Computer lab'],
  ['sci', 'Science lab'],
  ['elec', 'Electricity'],
  ['net', 'Internet'],
  ['water', 'Drinking water'],
  ['toilet', 'Toilets'],
  ['field', 'Playing field'],
  ['scr', 'Staff common room'],
];

const FAC2: [string, string][] = [
  ['work', 'Technical workshop'],
  ['canteen', 'Canteen'],
  ['tv', 'Television'],
  ['proj', 'Projector'],
  ['aid', 'First aid box'],
  ['wash', 'Handwashing water'],
  ['walled', 'Walled / fenced'],
  ['watch', 'Watchman'],
  ['lights', 'Security lights'],
];

const CL = ['KG1', 'KG2', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'JH1', 'JH2', 'JH3'];
const TB = [
  'English',
  'Maths',
  'Integrated Science',
  'Social Studies',
  'Physical Education',
  'ICT',
  'RME',
  'French',
  'Home Economics',
  'Pre-Tech',
  'Visual Art',
  'Ghanaian Language',
];
const LANG = ['Ga', 'Akwapim Twi', 'Asante Twi', 'Ewe', 'Visual Art', 'Home Economics', 'Pre-Tech'];
const COND = ['Walls', 'Doors', 'Windows', 'Floors', 'Board'];
const AGE = ['Under 30', '30-39', '40-49', '50-54', '55-59', '60+'];
const SVC = ['Under 5 yrs', '5-14 yrs', '15-24 yrs', '25+ yrs'];
const NOW = new Date().getFullYear();

const DEFAULT_CIRCUITS = [
  'ASHAMANG',
  'AWUDUM',
  'COMMUNITY 11/REDEMPTION VALLEY',
  'COMMUNITY 7/REPUBLIC ROAD',
  'COMMUNITY 8',
  'ONINKU/MANTE-DIN',
  'TWEDAASE',
];

const num = (v: any) => {
  const x = parseFloat(v);
  return isNaN(x) ? 0 : x;
};
const txt = (v: any) => String(v === undefined || v === null ? '' : v).trim();
const yes = (v: any) => {
  const s = txt(v).toUpperCase();
  return s === 'YES' || s === 'TRUE' || s === '1' || s === 'CHECKED' || s === 'OK';
};
const norm = (v: any) => txt(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
const pct = (a: number, b: number) => (b ? Math.round((a * 100) / b) : 0);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const inc = (o: Record<string, number>, k: string) => {
  o[k] = (o[k] || 0) + 1;
};
const yr = (v: any) => {
  if (!v) return 0;
  if (v instanceof Date) {
    const y = v.getFullYear();
    return isNaN(y) || y < 1900 ? 0 : y;
  }
  if (typeof v === 'number') {
    if (v >= 1900 && v <= 2100) return Math.round(v);
    const d = new Date(Math.round((v - 25569) * 86400000));
    const y = d.getFullYear();
    return isNaN(y) || y < 1900 ? 0 : y;
  }
  const s = txt(v);
  const d = new Date(s);
  const y = d.getFullYear();
  if (!isNaN(y) && y >= 1900 && y <= 2100) return y;
  const m = s.match(/\b(19\d{2}|20\d{2})\b/);
  return m ? parseInt(m[1], 10) : 0;
};

// Standardize circuit spelling variations across workbook imports and portal submissions
const canonicalCircuit = (raw: any): string => {
  const s = txt(raw).toUpperCase().replace(/\s+/g, ' ').trim();
  if (!s) return 'ASHAMANG';
  const n = s.replace(/[^A-Z0-9]/g, '');
  if (n.includes('ASHAMANG') || n.includes('ASHAIMANG')) return 'ASHAMANG';
  if (n.includes('AWUDUM')) return 'AWUDUM';
  if (n.includes('11') && n.includes('REDEMPTION')) return 'COMMUNITY 11/REDEMPTION VALLEY';
  if (n.includes('7') && n.includes('REPUBLIC')) return 'COMMUNITY 7/REPUBLIC ROAD';
  if (n === 'COMMUNITY8' || n === 'COMM8') return 'COMMUNITY 8';
  if (n.includes('ONINKU') || n.includes('MANTEDIN')) return 'ONINKU/MANTE-DIN';
  if (n.includes('TWEDAASE') || n.includes('TWEDASE')) return 'TWEDAASE';
  return s;
};

// Canonical school matching key so slight naming variations (e.g. "SCHOOL" suffix, "R/C", "ARCH BISHOP") map cleanly
const schoolMatchKey = (raw: any): string => {
  let s = txt(raw).toUpperCase();
  if (!s) return '';
  s = s
    .replace(/\bNII\s+ADJETEY\s+ANSAH\s+MEMORIAL\b/g, 'ADJETEY ANSAH')
    .replace(/\bADJETEY\s+ANSAH\s+MEMORIAL\b/g, 'ADJETEY ANSAH')
    .replace(/\bARCH\s+BISHOP\b/g, 'ARCHBISHOP')
    .replace(/\bROMAN\s+CATHOLIC\b/g, '')
    .replace(/\bR\s*\/\s*C\b/g, '')
    .replace(/\bM\s*\/\s*A\b/g, 'MA')
    .replace(/\bT\s*\/\s*M\b/g, 'TM')
    .replace(/\bPRESBYTERIAN\b/g, 'PRESBY')
    .replace(/\bMETHODIST\b/g, 'METH')
    .replace(/\bANGLICAN\b/g, 'ANG')
    .replace(/\bPRIMARY\b/g, 'PRI')
    .replace(/\bJUNIOR\s+HIGH\s+SCHOOL\b/g, 'JHS')
    .replace(/\bJUNIOR\s+HIGH\b/g, 'JHS')
    .replace(/\bSCHOOLS?\b/g, '')
    .replace(/[^A-Z0-9]/g, '');
  return s || norm(raw);
};

const pupils = (s: any) => sum(s.enr || []);
const teachers = (s: any) => sum(s.tch || []);
const ptr = (s: any) => (teachers(s) ? pupils(s) / teachers(s) : 0);
const score = (s: any) => FAC.filter(([k]) => s.fac && s.fac[k]).length;
const tqo = (s: any) =>
  s.tq || { n: 0, M: 0, F: 0, age: [0, 0, 0, 0, 0, 0], svc: [0, 0, 0, 0], rank: {}, prof: {}, sub: {} };
const missing = (s: any) =>
  s.fac ? FAC.filter(([k]) => !s.fac[k]).map(([, l]) => l).join(', ') || 'none' : 'no facility data';
const poorItems = (s: any) =>
  s.fac && s.fac.cond ? s.fac.cond.filter((c: string) => c === 'POOR').length : 0;

// Official GES 5-Sheet Census Workbook Parser (from tema-metro-edms/src/EDMS.tsx)
function parseOfficialCensusWorkbook(wb: XLSX.WorkBook) {
  const rows = (name: string, range: string): any[][] => {
    const ws = wb.Sheets[name];
    if (!ws) throw new Error('Sheet ' + name + ' not found');
    return XLSX.utils
      .sheet_to_json<any[]>(ws, { header: 1, defval: '', range })
      .filter(r => /^\d+$/.test(txt(r[0])));
  };
  const fac = new Map<string, any>();
  if (wb.Sheets['FACILITIES']) {
    rows('FACILITIES', 'A1:BM500').forEach(r => {
      fac.set(norm(r[3]), {
        ht: yes(r[4]),
        scr: yes(r[5]),
        store: yes(r[6]),
        lab: yes(r[7]),
        sci: yes(r[8]),
        work: yes(r[9]),
        canteen: yes(r[10]),
        field: yes(r[11]),
        fieldC: txt(r[12]).toUpperCase(),
        aid: yes(r[18]),
        tv: yes(r[20]),
        proj: yes(r[21]),
        net: yes(r[22]),
        prov: txt(r[23]),
        pc: num(r[25]),
        elec: yes(r[19]),
        water: yes(r[26]),
        wash: yes(r[28]),
        toilet: yes(r[35]),
        tM: num(r[37]),
        tF: num(r[38]),
        tT: num(r[39]),
        walled: yes(r[48]),
        gated: yes(r[49]),
        lights: yes(r[50]),
        watch: yes(r[51]),
        cond: [r[53], r[55], r[57], r[59], r[61]].map(c => txt(c).toUpperCase()),
      });
    });
  }

  const books = new Map<string, any>();
  const booksSheetName = wb.SheetNames.find(n => norm(n) === 'BOOKSRECORDS');
  if (booksSheetName) {
    rows(booksSheetName, 'A1:BN500').forEach(r => {
      const rec = r
        .slice(4, 40)
        .map(v => txt(v).toUpperCase())
        .filter(v => ['YES', 'NO', 'ADEQUATE', 'INADEQUATE'].includes(v));
      const lang: number[] = [];
      for (let k = 0; k < 14; k++) lang.push(yes(r[52 + k]) ? 1 : 0);
      books.set(norm(r[3]), {
        tb: TB.map((_, i) => txt(r[40 + i]).toUpperCase()),
        rec: [rec.filter(v => v === 'YES' || v === 'ADEQUATE').length, rec.length],
        lang,
      });
    });
  }

  const tmap = new Map<string, any>();
  if (wb.Sheets['TEACHING STAFF']) {
    rows('TEACHING STAFF', 'A1:AO7000')
      .filter(r => txt(r[3]))
      .forEach(r => {
        const k = norm(r[3]);
        const a = tmap.get(k) || {
          n: 0,
          M: 0,
          F: 0,
          age: [0, 0, 0, 0, 0, 0],
          svc: [0, 0, 0, 0],
          rank: {},
          prof: {},
          sub: {},
          retiringList: [] as any[],
          staffList: [] as any[],
        };
        a.n++;
        const sex = txt(r[12]).toUpperCase();
        if (sex.startsWith('M')) a.M++;
        else if (sex.startsWith('F')) a.F++;
        const by = yr(r[11]);
        const g = by ? NOW - by : 0;
        if (by) {
          a.age[g < 30 ? 0 : g < 40 ? 1 : g < 50 ? 2 : g < 55 ? 3 : g < 60 ? 4 : 5]++;
        }
        const fy = yr(r[26]);
        if (fy) {
          const v = NOW - fy;
          a.svc[v < 5 ? 0 : v < 15 ? 1 : v < 25 ? 2 : 3]++;
        }
        const rnk = txt(r[14]).toUpperCase() || 'UNSPECIFIED';
        const prf = txt(r[27]).toUpperCase() || 'UNSPECIFIED';
        const sbj = txt(r[23]).toUpperCase() || 'UNSPECIFIED';
        inc(a.rank, rnk);
        inc(a.prof, prf);
        inc(a.sub, sbj);

        // Extract individual teacher name & staffId from columns r[4]..r[10]
        const rawCols = [r[4], r[5], r[6], r[7], r[8], r[9], r[10]].map(txt).filter(Boolean);
        const nameTokens = rawCols.filter(
          c => /^[A-Za-z.\-\s']+$/.test(c) && c.length > 1 && !/^(MALE|FEMALE|M|F|YES|NO)$/i.test(c)
        );
        const staffIdToken = rawCols.find(c => /\d{3,}/.test(c)) || '';
        const teacherName = nameTokens.join(' ').replace(/\s+/g, ' ').trim().toUpperCase() || `STAFF #${a.n}`;

        const staffEntry = {
          name: teacherName,
          staffId: staffIdToken,
          sex: sex.startsWith('M') ? 'MALE' : sex.startsWith('F') ? 'FEMALE' : '-',
          age: g,
          dob: by ? String(by) : txt(r[11]),
          retireYear: by ? by + 60 : '',
          yearsLeft: g ? Math.max(0, 60 - g) : null,
          rank: rnk,
          prof: prf,
          subject: sbj,
          source: 'Census',
        };
        a.staffList.push(staffEntry);
        if (g >= 55) {
          a.retiringList.push(staffEntry);
        }
        tmap.set(k, a);
      });
  }

  const enr = new Map<string, any>();
  const pairs = [22, 25, 31, 34, 37, 40, 43, 46, 52, 55, 58];
  if (wb.Sheets['ENROLMENT']) {
    rows('ENROLMENT', 'A1:IE500').forEach(r => {
      const cl: number[] = [];
      pairs.forEach(c => {
        cl.push(num(r[c]), num(r[c + 1]));
      });
      enr.set(txt(r[3]), {
        enr: [num(r[28]), num(r[29]), num(r[49]), num(r[50]), num(r[61]), num(r[62])],
        cl,
        rc: r.slice(103, 114).map(num),
        tch: [num(r[72]), num(r[81]), num(r[90])],
        trn: [num(r[66]), num(r[75]), num(r[84])],
        nts: num(r[102]),
        rooms: sum(r.slice(103, 114).map(num)),
      });
    });
  }

  const stat = { teachers: 0, facilities: 0, books: 0 };
  const schools = rows('BASIC INFO', 'A1:AG500')
    .filter(r => txt(r[4]))
    .map(r => {
      const k = norm(r[4]);
      const e = enr.get(txt(r[3])) || {
        enr: [0, 0, 0, 0, 0, 0],
        cl: Array(22).fill(0),
        rc: Array(11).fill(0),
        tch: [0, 0, 0],
        trn: [0, 0, 0],
        nts: 0,
        rooms: 0,
      };
      const f = fac.get(k) || null;
      const b = books.get(k) || {};
      const t = tmap.get(k) || null;
      if (f) stat.facilities++;
      if (b.tb) stat.books++;
      if (t) stat.teachers++;
      return {
        emis: txt(r[3]),
        name: txt(r[4]),
        district: txt(r[1]) || 'TEMA METRO',
        circuit: txt(r[2]) || 'ASHAMANG',
        head: (txt(r[5]) + ' ' + txt(r[6])).trim(),
        levels: txt(r[8]) || 'KG, PRY & JHS',
        type: txt(r[9]) || 'PUBLIC',
        mgmt: txt(r[20]) || 'MA/DA',
        phone: txt(r[26]),
        email: txt(r[27]),
        deprived: yes(r[24]),
        ...e,
        fac: f,
        tb: b.tb || null,
        rec: b.rec || null,
        lang: b.lang || null,
        tq: t,
      };
    });
  return { schools, stat };
}

const mkS = (
  i: number,
  name: string,
  circuit: string,
  cl: number[],
  tch: number[],
  fac: any,
  tb: string[]
) => {
  const sB = (a: number, b: number) => sum(cl.slice(a, b).filter((_, k) => k % 2 === 0));
  const sG = (a: number, b: number) => sum(cl.slice(a, b).filter((_, k) => k % 2 === 1));
  const n = sum(tch);
  return {
    emis: 'TM00' + i,
    name,
    district: 'TEMA METRO',
    circuit,
    head: 'Head ' + i,
    levels: 'KG, PRY & JHS',
    type: 'PUBLIC',
    mgmt: 'MA/DA',
    phone: '',
    email: '',
    deprived: false,
    enr: [sB(0, 4), sG(0, 4), sB(4, 16), sG(4, 16), sB(16, 22), sG(16, 22)],
    cl,
    rc: [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2],
    tch,
    trn: tch.map(t => Math.max(0, t - 1)),
    nts: 3,
    rooms: 14,
    tq: {
      n,
      M: Math.floor(n / 3),
      F: n - Math.floor(n / 3),
      age: [1, 3, 4, 2, 1, 0],
      svc: [2, 4, 3, 2],
      rank: { 'ASST. DIR. I': 3, 'SUPT. I': 4 },
      prof: { DEGREE: 5, DIPLOMA: 3 },
      sub: { GENERAL: 6, MATHS: 2 },
    },
    tb,
    rec: [30, 36],
    lang: [1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
    fac: {
      ...fac,
      cond: ['GOOD', 'POOR', 'FAIR', 'POOR', 'GOOD'],
      fieldC: 'FAIR',
      prov: 'MTN',
      tM: 6,
      tF: 8,
      tT: 2,
    },
  };
};

const SAMPLE = [
  mkS(
    1,
    'Sample Basic School A',
    'ASHAMANG',
    [20, 22, 20, 21, 35, 38, 36, 34, 35, 33, 34, 36, 32, 30, 31, 33, 30, 28, 29, 30, 27, 26],
    [3, 12, 8],
    {
      lab: true,
      sci: false,
      elec: true,
      net: true,
      water: true,
      toilet: true,
      field: true,
      scr: true,
      pc: 25,
      proj: true,
      tv: true,
    },
    [
      'ADEQUATE',
      'ADEQUATE',
      'INADEQUATE',
      'ADEQUATE',
      'NOT AVAILABLE',
      'INADEQUATE',
      'ADEQUATE',
      'NOT AVAILABLE',
      'ADEQUATE',
      'ADEQUATE',
      'INADEQUATE',
      'ADEQUATE',
    ]
  ),
  mkS(
    2,
    'Sample Primary School B',
    'AWUDUM',
    [15, 14, 14, 13, 25, 28, 27, 26, 24, 25, 26, 24, 23, 22, 22, 21, 0, 0, 0, 0, 0, 0],
    [2, 6, 0],
    {
      lab: false,
      sci: false,
      elec: true,
      net: false,
      water: false,
      toilet: true,
      field: false,
      scr: true,
      pc: 0,
    },
    [
      'INADEQUATE',
      'INADEQUATE',
      'NOT AVAILABLE',
      'ADEQUATE',
      'NOT AVAILABLE',
      'NOT AVAILABLE',
      'INADEQUATE',
      'NOT AVAILABLE',
      'INADEQUATE',
      'NOT AVAILABLE',
      'NOT AVAILABLE',
      'INADEQUATE',
    ]
  ),
  mkS(
    3,
    'Sample JHS C',
    'TWEDAASE',
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40, 44, 38, 42, 42, 44],
    [0, 0, 9],
    {
      lab: true,
      sci: true,
      elec: true,
      net: true,
      water: true,
      toilet: true,
      field: false,
      scr: true,
      pc: 30,
      proj: true,
    },
    [
      'ADEQUATE',
      'ADEQUATE',
      'ADEQUATE',
      'ADEQUATE',
      'ADEQUATE',
      'ADEQUATE',
      'ADEQUATE',
      'ADEQUATE',
      'ADEQUATE',
      'INADEQUATE',
      'ADEQUATE',
      'ADEQUATE',
    ]
  ),
];

// Reusable UI Components matching tema-metro-edms
function Bar({ label, value, note, isDark }: { label: string; value: number; note?: string; isDark?: boolean }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '8px',
          fontSize: '12px',
          color: isDark ? '#cbd5e1' : '#475569',
          marginBottom: '3px',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ flexShrink: 0, fontWeight: 600 }}>{note || value + '%'}</span>
      </div>
      <div
        style={{
          height: '8px',
          borderRadius: '4px',
          backgroundColor: isDark ? '#334155' : '#e2e8f0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: '4px',
            backgroundColor: '#059669',
            width: Math.min(100, Math.max(0, value)) + '%',
            transition: 'width 0.25s ease',
          }}
        />
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  isDark,
  rightAction,
}: {
  title: string;
  children: React.ReactNode;
  isDark?: boolean;
  rightAction?: React.ReactNode;
}) {
  return (
    <section
      style={{
        borderRadius: '10px',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        padding: '16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 700,
            color: isDark ? '#f8fafc' : '#0f172a',
          }}
        >
          {title}
        </h2>
        {rightAction}
      </div>
      {children}
    </section>
  );
}

function Tbl({ cols, rows, isDark }: { cols: string[]; rows: any[][]; isDark?: boolean }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          whiteSpace: 'nowrap',
          textAlign: 'left',
          fontSize: '12.5px',
          color: isDark ? '#e2e8f0' : '#334155',
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
            {cols.map(c => (
              <th key={c} style={{ padding: '6px 12px 6px 0', fontWeight: 600 }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              style={{
                borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              }}
            >
              {r.map((v, j) => (
                <td key={j} style={{ padding: '6px 12px 6px 0' }}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dist({ title, rows, isDark }: { title: string; rows: [string, number][]; isDark?: boolean }) {
  const tot = sum(rows.map(r => r[1]));
  return (
    <Card title={title} isDark={isDark}>
      {rows.length > 0 ? (
        rows.map(([l, v]) => (
          <Bar key={l} label={l} value={pct(v, tot)} note={v + ' (' + pct(v, tot) + '%)'} isDark={isDark} />
        ))
      ) : (
        <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>No distribution records</div>
      )}
    </Card>
  );
}

interface KpisProps {
  items: [string, string][];
  isDark?: boolean;
  schools?: any[];
  validSubmissions?: any[];
  target?: number;
  onInspectSchool?: (school: any) => void;
  onEditSchool?: (school: any) => void;
}

function Kpis({
  items,
  isDark = true,
  schools = [],
  validSubmissions = [],
  target = 35,
  onInspectSchool,
  onEditSchool,
}: KpisProps) {
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'chart'>('cards');
  const [teacherSubMode, setTeacherSubMode] = useState<'schools' | 'portal'>('schools');
  const [searchQuery, setSearchQuery] = useState('');
  const [circuitFilter, setCircuitFilter] = useState('All');
  const [hoveredKey, setHoveredKey] = useState<string>('');

  const activePair = items.find(([k]) => k === selectedKey);
  const allCircuits = useMemo(
    () => Array.from(new Set(schools.map(s => s.circuit).filter(Boolean))).sort(),
    [schools]
  );

  // Filter schools by search query and circuit
  const filteredSchools = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    return schools.filter(s => {
      if (circuitFilter !== 'All' && s.circuit !== circuitFilter) return false;
      if (!qLower) return true;
      return (
        (s.name || '').toLowerCase().includes(qLower) ||
        (s.emis || '').toLowerCase().includes(qLower) ||
        (s.circuit || '').toLowerCase().includes(qLower) ||
        (s.head || '').toLowerCase().includes(qLower) ||
        (s.type || '').toLowerCase().includes(qLower)
      );
    });
  }, [schools, searchQuery, circuitFilter]);

  // Filter portal teacher submissions by search query and circuit
  const filteredSubmissions = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    return validSubmissions.filter((sub: any) => {
      const cir = sub.circuit || '';
      if (circuitFilter !== 'All' && cir !== circuitFilter) return false;
      if (!qLower) return true;
      const fullName = (sub.teacherName || `${sub.firstName || ''} ${sub.surname || ''}`).toLowerCase();
      return (
        fullName.includes(qLower) ||
        (sub.staffId || '').toLowerCase().includes(qLower) ||
        (sub.school || '').toLowerCase().includes(qLower) ||
        (sub.currentRank || '').toLowerCase().includes(qLower) ||
        (sub.subject || '').toLowerCase().includes(qLower)
      );
    });
  }, [validSubmissions, searchQuery, circuitFilter]);

  // Build comprehensive breakdown data for whichever KPI card is clicked
  const drilldown = useMemo(() => {
    if (!activePair) return null;
    const [key, val] = activePair;
    const kLower = key.toLowerCase();

    const totBoys = sum(filteredSchools.map(s => s.enr[0] + s.enr[2] + s.enr[4]));
    const totGirls = sum(filteredSchools.map(s => s.enr[1] + s.enr[3] + s.enr[5]));
    const totPupils = totBoys + totGirls;
    const totTch = sum(filteredSchools.map(teachers));
    const totTrn = sum(filteredSchools.map(s => sum(s.trn || [])));
    const totRooms = sum(filteredSchools.map(s => s.rooms || 0));

    // 1. SCHOOLS KPI
    if (kLower === 'schools') {
      const pubCount = filteredSchools.filter(s => (s.type || '').toUpperCase().includes('PUBLIC')).length;
      const privCount = filteredSchools.length - pubCount;
      const withPortal = filteredSchools.filter(s => (s.portalTeachers?.length || 0) > 0).length;

      return {
        title: 'Registered Schools Breakdown',
        subtitle: 'Complete directory of schools across circuits with enrolment, staffing, and facility scores',
        hasPortalToggle: false,
        summaryPills: [
          ['Matching Schools', String(filteredSchools.length)],
          ['Public Schools', String(pubCount)],
          ['Private / Mission', String(privCount)],
          ['Circuits Covered', String(new Set(filteredSchools.map(s => s.circuit)).size)],
          ['With Portal Staff', String(withPortal)],
        ] as [string, string][],
        tableCols: [
          'EMIS Code',
          'School Name',
          'Circuit',
          'Ownership',
          'Levels',
          'Head Teacher',
          'Phone',
          'Pupils',
          'Teachers',
          'Portal Staff',
          'Classrooms',
          'Facility Score',
        ],
        tableRows: filteredSchools.map(s => [
          s.emis || '-',
          s.name,
          s.circuit,
          s.type || 'PUBLIC',
          s.levels || '-',
          s.head || '-',
          s.phone || '-',
          pupils(s),
          teachers(s),
          s.portalTeachers?.length || 0,
          s.rooms || 0,
          s.fac ? `${score(s)}/8` : 'n/a',
        ]),
        cards: filteredSchools.map(s => ({
          id: s.id || s.emis + s.name,
          school: s,
          title: s.name,
          badge: s.type || 'PUBLIC',
          badgeColor: (s.type || '').includes('PUBLIC') ? '#059669' : '#d97706',
          meta: `${s.emis || 'No EMIS'} · ${s.circuit} · ${s.levels || 'Basic'}`,
          stats: [
            ['Total Pupils', pupils(s).toLocaleString()],
            ['Teachers (Portal)', `${teachers(s)} (${s.portalTeachers?.length || 0})`],
            ['Classrooms', String(s.rooms || 0)],
            ['Facilities', s.fac ? `${score(s)}/8` : 'n/a'],
          ] as [string, string][],
          footer: `Head: ${s.head || 'Not specified'} ${s.phone ? '· ' + s.phone : ''}`,
          progress: s.fac ? (score(s) / 8) * 100 : 0,
        })),
        charts: [
          {
            title: 'Schools by Circuit',
            items: allCircuits.map(c => {
              const cnt = filteredSchools.filter(s => s.circuit === c).length;
              return [c, pct(cnt, filteredSchools.length || 1), `${cnt} schools`] as [string, number, string];
            }),
          },
          {
            title: 'Schools by Ownership Type',
            items: Array.from(new Set(filteredSchools.map(s => s.type || 'PUBLIC'))).map(t => {
              const cnt = filteredSchools.filter(s => (s.type || 'PUBLIC') === t).length;
              return [t, pct(cnt, filteredSchools.length || 1), `${cnt} (${pct(cnt, filteredSchools.length || 1)}%)`] as [
                string,
                number,
                string
              ];
            }),
          },
        ],
      };
    }

    // 2. PUPILS / BOYS / GIRLS KPI
    if (kLower === 'pupils' || kLower === 'boys' || kLower === 'girls') {
      const kgTot = sum(filteredSchools.map(s => s.enr[0] + s.enr[1]));
      const priTot = sum(filteredSchools.map(s => s.enr[2] + s.enr[3]));
      const jhsTot = sum(filteredSchools.map(s => s.enr[4] + s.enr[5]));
      const sorted = [...filteredSchools].sort((a, b) => pupils(b) - pupils(a));
      const maxP = sorted.length ? Math.max(1, pupils(sorted[0])) : 1;

      return {
        title: `${key} Enrolment Breakdown`,
        subtitle: 'School-by-school and class-level pupil enrolment across KG, Primary, and JHS',
        hasPortalToggle: false,
        summaryPills: [
          ['Total Pupils', totPupils.toLocaleString()],
          ['Total Boys', totBoys.toLocaleString()],
          ['Total Girls', totGirls.toLocaleString()],
          ['KG Enrolment', kgTot.toLocaleString()],
          ['Primary Enrolment', priTot.toLocaleString()],
          ['JHS Enrolment', jhsTot.toLocaleString()],
        ] as [string, string][],
        tableCols: [
          'School Name',
          'Circuit',
          'KG Boys',
          'KG Girls',
          'Pri Boys',
          'Pri Girls',
          'JHS Boys',
          'JHS Girls',
          'Total Boys',
          'Total Girls',
          'Total Pupils',
        ],
        tableRows: sorted.map(s => {
          const b = s.enr[0] + s.enr[2] + s.enr[4];
          const g = s.enr[1] + s.enr[3] + s.enr[5];
          return [
            s.name,
            s.circuit,
            s.enr[0],
            s.enr[1],
            s.enr[2],
            s.enr[3],
            s.enr[4],
            s.enr[5],
            b,
            g,
            b + g,
          ];
        }),
        cards: sorted.map(s => {
          const b = s.enr[0] + s.enr[2] + s.enr[4];
          const g = s.enr[1] + s.enr[3] + s.enr[5];
          const tot = b + g;
          return {
            id: s.id || s.emis + s.name,
            school: s,
            title: s.name,
            badge: `${tot.toLocaleString()} pupils`,
            badgeColor: '#0284c7',
            meta: `${s.circuit} · ${s.type || 'PUBLIC'}`,
            stats: [
              ['Boys / Girls', `${b.toLocaleString()} B / ${g.toLocaleString()} G`],
              ['KG Total', String(s.enr[0] + s.enr[1])],
              ['Primary Total', String(s.enr[2] + s.enr[3])],
              ['JHS Total', String(s.enr[4] + s.enr[5])],
            ] as [string, string][],
            footer: `GPI: ${b ? (g / b).toFixed(2) : '-'} · Classrooms: ${s.rooms || 0}`,
            progress: pct(tot, maxP),
          };
        }),
        charts: [
          {
            title: 'Pupil Enrolment by Circuit',
            items: allCircuits.map(c => {
              const p = sum(filteredSchools.filter(s => s.circuit === c).map(pupils));
              return [c, pct(p, totPupils || 1), p.toLocaleString() + ' pupils'] as [string, number, string];
            }),
          },
          {
            title: 'Enrolment by Level (KG / Primary / JHS)',
            items: [
              ['KG (KG1 - KG2)', pct(kgTot, totPupils || 1), `${kgTot.toLocaleString()} (${pct(kgTot, totPupils || 1)}%)`],
              [
                'Primary (P1 - P6)',
                pct(priTot, totPupils || 1),
                `${priTot.toLocaleString()} (${pct(priTot, totPupils || 1)}%)`,
              ],
              ['JHS (JHS1 - JHS3)', pct(jhsTot, totPupils || 1), `${jhsTot.toLocaleString()} (${pct(jhsTot, totPupils || 1)}%)`],
            ] as [string, number, string][],
          },
        ],
      };
    }

    // 3. TEACHERS / MALE-FEMALE / STAFFING KPI
    if (
      kLower.includes('teacher') && !kLower.includes('ratio') && !kLower.includes('trained') ||
      kLower === 'male / female'
    ) {
      const totM = sum(filteredSchools.map(s => tqo(s).M));
      const totF = sum(filteredSchools.map(s => tqo(s).F));
      const sorted = [...filteredSchools].sort((a, b) => teachers(b) - teachers(a));
      const maxT = sorted.length ? Math.max(1, teachers(sorted[0])) : 1;

      const isPortalMode = teacherSubMode === 'portal';

      return {
        title: isPortalMode
          ? `Individual Portal Teacher Submissions (${filteredSubmissions.length})`
          : `Teaching Staff Breakdown by School (${filteredSchools.length} Schools)`,
        subtitle:
          'Switch between School-by-School Staffing Totals and Individual Submitted Teacher Profiles from the Portal',
        hasPortalToggle: true,
        summaryPills: [
          ['Total Teachers', totTch.toLocaleString()],
          ['Portal Submissions', filteredSubmissions.length.toLocaleString()],
          ['Male Teachers', totM.toLocaleString()],
          ['Female Teachers', totF.toLocaleString()],
          ['Trained Teachers', `${totTrn.toLocaleString()} (${pct(totTrn, totTch || 1)}%)`],
        ] as [string, string][],
        tableCols: isPortalMode
          ? [
              'Staff ID',
              'Full Name',
              'Sex',
              'School',
              'Circuit',
              'Current Rank',
              'Qualification',
              'Subject / Area',
              'Phone',
            ]
          : [
              'School Name',
              'Circuit',
              'KG Tch',
              'Primary Tch',
              'JHS Tch',
              'Total Teachers',
              'Portal Submissions',
              'Male',
              'Female',
              'Trained',
            ],
        tableRows: isPortalMode
          ? filteredSubmissions.map((sub: any) => [
              sub.staffId || '-',
              sub.teacherName || `${sub.firstName || ''} ${sub.surname || ''}`.trim() || '-',
              sub.sex || '-',
              sub.school || '-',
              sub.circuit || '-',
              sub.currentRank || '-',
              Array.isArray(sub.professional) && sub.professional[0]
                ? sub.professional[0].course || sub.professional[0].award || 'Certified'
                : sub.teachersLicence
                ? 'Licensed'
                : '-',
              sub.subject || sub.areaOfSpecialization || '-',
              sub.telephone || sub.phone || '-',
            ])
          : sorted.map(s => [
              s.name,
              s.circuit,
              s.tch?.[0] || 0,
              s.tch?.[1] || 0,
              s.tch?.[2] || 0,
              teachers(s),
              s.portalTeachers?.length || 0,
              tqo(s).M,
              tqo(s).F,
              sum(s.trn || []),
            ]),
        cards: isPortalMode
          ? filteredSubmissions.slice(0, 180).map((sub: any, idx: number) => {
              const name = sub.teacherName || `${sub.firstName || ''} ${sub.surname || ''}`.trim() || 'Teacher';
              return {
                id: sub.id || `${sub.staffId}-${idx}`,
                school: filteredSchools.find(s => norm(s.name) === norm(sub.school)),
                title: name,
                badge: sub.staffId ? `ID: ${sub.staffId}` : 'Portal Staff',
                badgeColor: '#059669',
                meta: `${sub.school || 'Unassigned'} · ${sub.circuit || '-'}`,
                stats: [
                  ['Sex / DOB', `${sub.sex || '-'} · ${sub.dob || '-'}`],
                  ['Current Rank', sub.currentRank || '-'],
                  ['Subject', sub.subject || sub.areaOfSpecialization || '-'],
                  ['Reg / Licence', sub.regNumber || sub.teachersLicence || '-'],
                ] as [string, string][],
                footer: `Phone: ${sub.telephone || sub.phone || '-'} · Email: ${sub.email || '-'}`,
                progress: 100,
              };
            })
          : sorted.map(s => {
              const tc = teachers(s);
              const pCount = s.portalTeachers?.length || 0;
              return {
                id: s.id || s.emis + s.name,
                school: s,
                title: s.name,
                badge: `${tc} teachers`,
                badgeColor: '#059669',
                meta: `${s.circuit} · ${pCount} portal submission${pCount === 1 ? '' : 's'}`,
                stats: [
                  ['Male / Female', `${tqo(s).M} M / ${tqo(s).F} F`],
                  ['Trained Staff', `${sum(s.trn || [])} (${pct(sum(s.trn || []), tc || 1)}%)`],
                  ['KG / Pri / JHS', `${s.tch?.[0] || 0} / ${s.tch?.[1] || 0} / ${s.tch?.[2] || 0}`],
                  ['Aged 55+', String((tqo(s).age?.[4] || 0) + (tqo(s).age?.[5] || 0))],
                ] as [string, string][],
                footer:
                  pCount > 0
                    ? `Portal staff: ${s.portalTeachers
                        .slice(0, 3)
                        .map((t: any) => t.teacherName || `${t.firstName || ''} ${t.surname || ''}`.trim())
                        .join(', ')}${pCount > 3 ? ` +${pCount - 3} more` : ''}`
                    : `Head: ${s.head || '-'}`,
                progress: pct(tc, maxT),
              };
            }),
        charts: [
          {
            title: 'Teachers by Circuit',
            items: allCircuits.map(c => {
              const tc = sum(filteredSchools.filter(s => s.circuit === c).map(teachers));
              return [c, pct(tc, totTch || 1), `${tc} teachers`] as [string, number, string];
            }),
          },
          {
            title: 'Gender Distribution across Selected Schools',
            items: [
              ['Female Teachers', pct(totF, totM + totF || 1), `${totF} (${pct(totF, totM + totF || 1)}%)`],
              ['Male Teachers', pct(totM, totM + totF || 1), `${totM} (${pct(totM, totM + totF || 1)}%)`],
            ] as [string, number, string][],
          },
        ],
      };
    }

    // 4. GENDER PARITY INDEX (GPI)
    if (kLower.includes('gender parity') || kLower.includes('gpi')) {
      const paritySchools = filteredSchools.filter(s => {
        const b = s.enr[0] + s.enr[2] + s.enr[4];
        const g = s.enr[1] + s.enr[3] + s.enr[5];
        if (!b) return false;
        const ratio = g / b;
        return ratio >= 0.95 && ratio <= 1.05;
      }).length;
      const highFemale = filteredSchools.filter(s => {
        const b = s.enr[0] + s.enr[2] + s.enr[4];
        const g = s.enr[1] + s.enr[3] + s.enr[5];
        return b > 0 && g / b > 1.05;
      }).length;
      const highMale = filteredSchools.filter(s => {
        const b = s.enr[0] + s.enr[2] + s.enr[4];
        const g = s.enr[1] + s.enr[3] + s.enr[5];
        return b > 0 && g / b < 0.95;
      }).length;

      return {
        title: 'Gender Parity Index (GPI) Analysis',
        subtitle: 'Ratio of female-to-male pupil enrolment across schools and classes (1.00 = exact gender balance)',
        hasPortalToggle: false,
        summaryPills: [
          ['Overall GPI', totBoys ? (totGirls / totBoys).toFixed(2) : '-'],
          ['Balanced (0.95 - 1.05)', `${paritySchools} schools`],
          ['Higher Female (> 1.05)', `${highFemale} schools`],
          ['Higher Male (< 0.95)', `${highMale} schools`],
          ['Girls Share', `${pct(totGirls, totPupils || 1)}%`],
        ] as [string, string][],
        tableCols: ['School Name', 'Circuit', 'Boys', 'Girls', 'Total Pupils', 'Female %', 'GPI (Girls/Boys)', 'Status'],
        tableRows: filteredSchools.map(s => {
          const b = s.enr[0] + s.enr[2] + s.enr[4];
          const g = s.enr[1] + s.enr[3] + s.enr[5];
          const ratio = b ? g / b : 0;
          const status = !b
            ? 'No Enrolment'
            : ratio >= 0.95 && ratio <= 1.05
            ? 'Balanced Parity'
            : ratio > 1.05
            ? 'Higher Female'
            : 'Higher Male';
          return [s.name, s.circuit, b, g, b + g, `${pct(g, b + g || 1)}%`, b ? ratio.toFixed(2) : '-', status];
        }),
        cards: filteredSchools.map(s => {
          const b = s.enr[0] + s.enr[2] + s.enr[4];
          const g = s.enr[1] + s.enr[3] + s.enr[5];
          const ratio = b ? g / b : 0;
          const femPct = pct(g, b + g || 1);
          return {
            id: s.id || s.emis + s.name,
            school: s,
            title: s.name,
            badge: `GPI: ${b ? ratio.toFixed(2) : '-'}`,
            badgeColor: ratio >= 0.95 && ratio <= 1.05 ? '#059669' : '#d97706',
            meta: `${s.circuit} · ${b + g} total pupils`,
            stats: [
              ['Boys', b.toLocaleString()],
              ['Girls', g.toLocaleString()],
              ['Female %', `${femPct}%`],
              ['Parity Status', !b ? 'N/A' : ratio >= 0.95 && ratio <= 1.05 ? 'Balanced' : ratio > 1.05 ? 'More Girls' : 'More Boys'],
            ] as [string, string][],
            footer: `KG GPI: ${s.enr[0] ? (s.enr[1] / s.enr[0]).toFixed(2) : '-'} · Pri GPI: ${
              s.enr[2] ? (s.enr[3] / s.enr[2]).toFixed(2) : '-'
            } · JHS GPI: ${s.enr[4] ? (s.enr[5] / s.enr[4]).toFixed(2) : '-'}`,
            progress: femPct,
          };
        }),
        charts: [
          {
            title: 'Gender Parity Index by Circuit',
            items: allCircuits.map(c => {
              const gSchools = filteredSchools.filter(s => s.circuit === c);
              const b = sum(gSchools.map(s => s.enr[0] + s.enr[2] + s.enr[4]));
              const g = sum(gSchools.map(s => s.enr[1] + s.enr[3] + s.enr[5]));
              const ratio = b ? g / b : 0;
              return [c, Math.min(100, Math.round(ratio * 50)), `GPI ${b ? ratio.toFixed(2) : '-'}`] as [
                string,
                number,
                string
              ];
            }),
          },
          {
            title: 'GPI by Class Level (KG1 to JHS3)',
            items: CL.map((clName, i) => {
              const b = sum(filteredSchools.map(s => (s.cl || [])[2 * i] || 0));
              const g = sum(filteredSchools.map(s => (s.cl || [])[2 * i + 1] || 0));
              const ratio = b ? g / b : 0;
              return [clName, Math.min(100, Math.round(ratio * 50)), `GPI ${b ? ratio.toFixed(2) : '-'}`] as [
                string,
                number,
                string
              ];
            }),
          },
        ],
      };
    }

    // 5. PUPIL-TEACHER RATIO (PTR)
    if (kLower.includes('pupil-teacher ratio') || kLower.includes('ptr')) {
      const highPtr = filteredSchools.filter(s => ptr(s) > target).length;
      const sorted = [...filteredSchools].sort((a, b) => ptr(b) - ptr(a));
      const maxPtr = sorted.length ? Math.max(1, ptr(sorted[0])) : 1;

      return {
        title: 'Pupil-Teacher Ratio (PTR) Breakdown',
        subtitle: `Comparison of school PTR against the target benchmark (${target}:1) and staffing surplus/deficit`,
        hasPortalToggle: false,
        summaryPills: [
          ['Overall PTR', totTch ? (totPupils / totTch).toFixed(1) : '-'],
          ['Target PTR', `${target}:1`],
          [`Above Target (> ${target})`, `${highPtr} schools`],
          [`Within Target (<= ${target})`, `${filteredSchools.length - highPtr} schools`],
        ] as [string, string][],
        tableCols: [
          'School Name',
          'Circuit',
          'Total Pupils',
          'Total Teachers',
          'Actual PTR',
          `Required (at ${target}:1)`,
          'Surplus / Deficit',
          'Status',
        ],
        tableRows: sorted.map(s => {
          const p = pupils(s);
          const t = teachers(s);
          const req = Math.ceil(p / target);
          const gap = t - req;
          const actual = ptr(s);
          return [
            s.name,
            s.circuit,
            p,
            t,
            actual ? actual.toFixed(1) : '-',
            req,
            gap > 0 ? `+${gap}` : String(gap),
            actual > target ? 'High PTR (Deficit)' : 'Optimal PTR',
          ];
        }),
        cards: sorted.map(s => {
          const p = pupils(s);
          const t = teachers(s);
          const req = Math.ceil(p / target);
          const gap = t - req;
          const actual = ptr(s);
          return {
            id: s.id || s.emis + s.name,
            school: s,
            title: s.name,
            badge: `PTR: ${actual ? actual.toFixed(1) : '-'}`,
            badgeColor: actual > target ? '#dc2626' : '#059669',
            meta: `${s.circuit} · ${s.type || 'PUBLIC'}`,
            stats: [
              ['Pupils', p.toLocaleString()],
              ['Teachers', String(t)],
              [`Required (PTR ${target})`, String(req)],
              ['Staffing Gap', gap >= 0 ? `+${gap} surplus` : `${gap} deficit`],
            ] as [string, string][],
            footer: actual > target ? `Needs ${Math.abs(gap)} additional teacher(s)` : 'Staffing meets PTR target',
            progress: pct(actual, maxPtr),
          };
        }),
        charts: [
          {
            title: 'Pupil-Teacher Ratio by Circuit',
            items: allCircuits.map(c => {
              const g = filteredSchools.filter(s => s.circuit === c);
              const p = sum(g.map(pupils));
              const t = sum(g.map(teachers));
              const r = t ? p / t : 0;
              return [c, Math.min(100, Math.round((r / 50) * 100)), `${r.toFixed(1)}:1`] as [string, number, string];
            }),
          },
          {
            title: 'Highest PTR Schools',
            items: sorted.slice(0, 10).map(s => [
              s.name,
              pct(ptr(s), maxPtr),
              `${ptr(s).toFixed(1)}:1 (${pupils(s)}p / ${teachers(s)}t)`,
            ]) as [string, number, string][],
          },
        ],
      };
    }

    // 6. PUPILS PER CLASSROOM / OVERCROWDED SCHOOLS
    if (kLower.includes('classroom') || kLower.includes('45 pupils/room')) {
      const overcrowded = filteredSchools.filter(s => s.rooms > 0 && pupils(s) / s.rooms > 45);
      const sorted = [...filteredSchools].sort((a, b) => {
        const rA = a.rooms > 0 ? pupils(a) / a.rooms : 0;
        const rB = b.rooms > 0 ? pupils(b) / b.rooms : 0;
        return rB - rA;
      });
      const maxPcr = sorted.length && sorted[0].rooms > 0 ? pupils(sorted[0]) / sorted[0].rooms : 1;

      return {
        title: 'Classroom Congestion & Pupils per Classroom Breakdown',
        subtitle: 'School-by-school classroom capacity vs. GES standard threshold (45 pupils per classroom)',
        hasPortalToggle: false,
        summaryPills: [
          ['Overall Pupils / Room', totRooms ? (totPupils / totRooms).toFixed(1) : '-'],
          ['Total Classrooms', totRooms.toLocaleString()],
          ['Overcrowded (> 45/room)', `${overcrowded.length} schools`],
          ['Within Standard (<= 45)', `${filteredSchools.length - overcrowded.length} schools`],
        ] as [string, string][],
        tableCols: [
          'School Name',
          'Circuit',
          'Total Pupils',
          'Total Classrooms',
          'Pupils / Classroom',
          'Congestion Status',
        ],
        tableRows: sorted.map(s => {
          const p = pupils(s);
          const r = s.rooms || 0;
          const ratio = r > 0 ? p / r : 0;
          return [
            s.name,
            s.circuit,
            p,
            r,
            r > 0 ? ratio.toFixed(1) : '-',
            !r ? 'No rooms recorded' : ratio > 45 ? 'Overcrowded (> 45)' : 'Adequate Space',
          ];
        }),
        cards: sorted.map(s => {
          const p = pupils(s);
          const r = s.rooms || 0;
          const ratio = r > 0 ? p / r : 0;
          return {
            id: s.id || s.emis + s.name,
            school: s,
            title: s.name,
            badge: r > 0 ? `${ratio.toFixed(1)} / room` : 'N/A',
            badgeColor: ratio > 45 ? '#dc2626' : '#059669',
            meta: `${s.circuit} · ${r} classrooms`,
            stats: [
              ['Total Pupils', p.toLocaleString()],
              ['Classrooms', String(r)],
              ['Pupils / Room', r > 0 ? ratio.toFixed(1) : '-'],
              ['Status', !r ? 'Unrecorded' : ratio > 45 ? 'Overcrowded' : 'Standard'],
            ] as [string, string][],
            footer: ratio > 45 ? `Needs ${Math.ceil(p / 45) - r} additional classroom(s) for 45/room` : 'Meets GES classroom norm',
            progress: pct(ratio, maxPcr || 1),
          };
        }),
        charts: [
          {
            title: 'Pupils per Classroom by Class Level (KG1 to JHS3)',
            items: CL.map((clName, i) => {
              const p = sum(filteredSchools.map(s => ((s.cl || [])[2 * i] || 0) + ((s.cl || [])[2 * i + 1] || 0)));
              const r = sum(filteredSchools.map(s => (s.rc || [])[i] || 0));
              const ratio = r > 0 ? p / r : 0;
              return [clName, Math.min(100, Math.round((ratio / 70) * 100)), `${r > 0 ? ratio.toFixed(1) : '-'} / room`] as [
                string,
                number,
                string
              ];
            }),
          },
          {
            title: 'Most Congested Schools (Pupils / Room)',
            items: sorted.slice(0, 10).map(s => {
              const ratio = s.rooms > 0 ? pupils(s) / s.rooms : 0;
              return [s.name, pct(ratio, maxPcr || 1), `${ratio.toFixed(1)} (${pupils(s)}p / ${s.rooms}rm)`] as [
                string,
                number,
                string
              ];
            }),
          },
        ],
      };
    }

    // 7. TRAINED TEACHERS KPI
    if (kLower.includes('trained')) {
      const fullyTrained = filteredSchools.filter(s => teachers(s) > 0 && sum(s.trn || []) >= teachers(s)).length;
      const sorted = [...filteredSchools].sort((a, b) => {
        const pA = pct(sum(a.trn || []), teachers(a) || 1);
        const pB = pct(sum(b.trn || []), teachers(b) || 1);
        return pB - pA;
      });

      const profMap: Record<string, number> = {};
      filteredSchools.forEach(s => {
        Object.entries(tqo(s).prof || {}).forEach(([k, v]) => {
          profMap[k] = (profMap[k] || 0) + Number(v);
        });
      });
      const profEntries = Object.entries(profMap).sort((a, b) => b[1] - a[1]);

      return {
        title: 'Trained Teachers & Professional Qualifications Breakdown',
        subtitle: 'Professional certification coverage across KG, Primary, and JHS teaching staff',
        hasPortalToggle: false,
        summaryPills: [
          ['Overall Trained %', `${pct(totTrn, totTch || 1)}%`],
          ['Trained Teachers', totTrn.toLocaleString()],
          ['Untrained Teachers', Math.max(0, totTch - totTrn).toLocaleString()],
          ['100% Trained Schools', `${fullyTrained} schools`],
        ] as [string, string][],
        tableCols: [
          'School Name',
          'Circuit',
          'Total Teachers',
          'Trained Teachers',
          'Untrained Teachers',
          '% Trained',
          'KG Trained',
          'Pri Trained',
          'JHS Trained',
        ],
        tableRows: sorted.map(s => {
          const tc = teachers(s);
          const tr = sum(s.trn || []);
          return [
            s.name,
            s.circuit,
            tc,
            tr,
            Math.max(0, tc - tr),
            `${pct(tr, tc || 1)}%`,
            s.trn?.[0] || 0,
            s.trn?.[1] || 0,
            s.trn?.[2] || 0,
          ];
        }),
        cards: sorted.map(s => {
          const tc = teachers(s);
          const tr = sum(s.trn || []);
          const rate = pct(tr, tc || 1);
          return {
            id: s.id || s.emis + s.name,
            school: s,
            title: s.name,
            badge: `${rate}% Trained`,
            badgeColor: rate >= 80 ? '#059669' : rate >= 50 ? '#d97706' : '#dc2626',
            meta: `${s.circuit} · ${s.type || 'PUBLIC'}`,
            stats: [
              ['Total Teachers', String(tc)],
              ['Trained', String(tr)],
              ['Untrained', String(Math.max(0, tc - tr))],
              ['Portal Verified', String(s.portalTeachers?.length || 0)],
            ] as [string, string][],
            footer: `KG: ${s.trn?.[0] || 0} · Primary: ${s.trn?.[1] || 0} · JHS: ${s.trn?.[2] || 0}`,
            progress: rate,
          };
        }),
        charts: [
          {
            title: '% Trained Teachers by Circuit',
            items: allCircuits.map(c => {
              const g = filteredSchools.filter(s => s.circuit === c);
              const tc = sum(g.map(teachers));
              const tr = sum(g.map(s => sum(s.trn || [])));
              return [c, pct(tr, tc || 1), `${pct(tr, tc || 1)}% (${tr}/${tc})`] as [string, number, string];
            }),
          },
          {
            title: 'Professional Qualifications Distribution',
            items: profEntries.slice(0, 8).map(([k, v]) => [k, pct(v, totTch || 1), `${v} teachers`]) as [
              string,
              number,
              string
            ][],
          },
        ],
      };
    }

    // 8. NON-TEACHING STAFF KPI
    if (kLower.includes('non-teaching')) {
      const totNts = sum(filteredSchools.map(s => s.nts || 0));
      const withNts = filteredSchools.filter(s => (s.nts || 0) > 0).length;
      const sorted = [...filteredSchools].sort((a, b) => (b.nts || 0) - (a.nts || 0));
      const maxNts = sorted.length ? Math.max(1, sorted[0].nts || 0) : 1;

      return {
        title: 'Non-Teaching & Administrative Staff Breakdown',
        subtitle: 'Distribution of non-teaching support personnel across schools and circuits',
        hasPortalToggle: false,
        summaryPills: [
          ['Total Non-Teaching Staff', totNts.toLocaleString()],
          ['Schools with NTS', `${withNts} schools`],
          ['Schools without NTS', `${filteredSchools.length - withNts} schools`],
          ['Total Combined Staff', (totNts + totTch).toLocaleString()],
        ] as [string, string][],
        tableCols: [
          'School Name',
          'Circuit',
          'Ownership',
          'Head Teacher',
          'Non-Teaching Staff',
          'Teaching Staff',
          'Total School Staff',
        ],
        tableRows: sorted.map(s => [
          s.name,
          s.circuit,
          s.type || 'PUBLIC',
          s.head || '-',
          s.nts || 0,
          teachers(s),
          (s.nts || 0) + teachers(s),
        ]),
        cards: sorted.map(s => ({
          id: s.id || s.emis + s.name,
          school: s,
          title: s.name,
          badge: `${s.nts || 0} Non-Teaching`,
          badgeColor: (s.nts || 0) > 0 ? '#059669' : '#64748b',
          meta: `${s.circuit} · ${s.type || 'PUBLIC'}`,
          stats: [
            ['Non-Teaching Staff', String(s.nts || 0)],
            ['Teaching Staff', String(teachers(s))],
            ['Total Staff', String((s.nts || 0) + teachers(s))],
            ['Pupils', pupils(s).toLocaleString()],
          ] as [string, string][],
          footer: `Head: ${s.head || '-'}`,
          progress: pct(s.nts || 0, maxNts),
        })),
        charts: [
          {
            title: 'Non-Teaching Staff by Circuit',
            items: allCircuits.map(c => {
              const n = sum(filteredSchools.filter(s => s.circuit === c).map(s => s.nts || 0));
              return [c, pct(n, totNts || 1), `${n} staff`] as [string, number, string];
            }),
          },
          {
            title: 'Schools with Highest Non-Teaching Staff',
            items: sorted
              .filter(s => (s.nts || 0) > 0)
              .slice(0, 10)
              .map(s => [s.name, pct(s.nts || 0, maxNts), `${s.nts || 0} staff`]) as [string, number, string][],
          },
        ],
      };
    }

    // 9. AGED 55 AND ABOVE (RETIREMENT FORECAST)
    if (kLower.includes('55')) {
      const tot55_59 = sum(filteredSchools.map(s => tqo(s).age?.[4] || 0));
      const tot60Plus = sum(filteredSchools.map(s => tqo(s).age?.[5] || 0));
      const sorted = [...filteredSchools].sort(
        (a, b) =>
          (tqo(b).age?.[4] || 0) + (tqo(b).age?.[5] || 0) - ((tqo(a).age?.[4] || 0) + (tqo(a).age?.[5] || 0))
      );

      return {
        title: 'Retirement Forecast (Teachers Aged 55 & Above)',
        subtitle:
          'Full school details alongside the names, Staff IDs, ages, and retirement years of teachers aged 55 and above',
        hasPortalToggle: false,
        summaryPills: [
          ['Total Aged 55+', String(tot55_59 + tot60Plus)],
          ['Aged 55 - 59 (Retiring in <=5 yrs)', String(tot55_59)],
          ['Aged 60+ (Due Now)', String(tot60Plus)],
          [
            'Schools Affected',
            String(filteredSchools.filter(s => (tqo(s).age?.[4] || 0) + (tqo(s).age?.[5] || 0) > 0).length),
          ],
        ] as [string, string][],
        tableCols: [
          'EMIS Code',
          'School Name',
          'Circuit',
          'Ownership',
          'Levels',
          'Head Teacher',
          'Phone',
          'Pupils',
          'Total Teachers',
          'Aged 50-54',
          'Aged 55-59',
          'Aged 60+',
          'Total 55+',
          'Names of Teachers Going on Retirement (Aged 55+)',
        ],
        tableRows: sorted.map(s => {
          const a4 = tqo(s).age?.[4] || 0;
          const a5 = tqo(s).age?.[5] || 0;
          const rList: any[] = s.retiringTeachers || [];
          const namesStr =
            rList.length > 0
              ? rList
                  .map(
                    t =>
                      `${t.name}${t.staffId ? ` (ID: ${t.staffId})` : ''}${
                        t.age ? ` - Age ${t.age}, Retires ${t.retireYear || ''}` : ''
                      }${t.rank ? ` [${t.rank}]` : ''}`
                  )
                  .join(' | ')
              : a4 + a5 > 0
              ? `${a4 + a5} teacher(s) in census count (click Edit School to enter/confirm names)`
              : 'None';
          return [
            s.emis || '-',
            s.name,
            s.circuit,
            s.type || 'PUBLIC',
            s.levels || '-',
            s.head || '-',
            s.phone || '-',
            pupils(s),
            teachers(s),
            tqo(s).age?.[3] || 0,
            a4,
            a5,
            a4 + a5,
            namesStr,
          ];
        }),
        cards: sorted.map(s => {
          const a4 = tqo(s).age?.[4] || 0;
          const a5 = tqo(s).age?.[5] || 0;
          const tot = a4 + a5;
          const rList: any[] = s.retiringTeachers || [];
          return {
            id: s.id || s.emis + s.name,
            school: s,
            title: s.name,
            badge: `${tot} Aged 55+`,
            badgeColor: tot > 0 ? '#d97706' : '#059669',
            meta: `EMIS: ${s.emis || '-'} · ${s.circuit} · ${s.type || 'PUBLIC'} · ${s.levels || 'Basic'}`,
            stats: [
              ['Head Teacher', s.head || 'Not assigned'],
              ['Phone / Contact', s.phone || s.email || '-'],
              ['Pupils & Rooms', `${pupils(s).toLocaleString()} pupils · ${s.rooms || 0} rooms`],
              ['Total Staff & PTR', `${teachers(s)} tch (${s.portalTeachers?.length || 0} portal) · PTR ${ptr(s) ? ptr(s).toFixed(1) : '-'}`],
              ['Aged 55 - 59', `${a4} (Retiring <=5 yrs)`],
              ['Aged 60+ / 50-54', `${a5} (60+) · ${tqo(s).age?.[3] || 0} (50-54)`],
            ] as [string, string][],
            retiringList: rList,
            expectedRetiringCount: tot,
            footer: tot > 0 ? `${tot} replacement teacher(s) needed within 5 years` : 'No immediate retirements due',
            progress: pct(tot, Math.max(1, teachers(s))),
          };
        }),
        charts: [
          {
            title: 'District Teacher Age Profile',
            items: AGE.map((label, i) => {
              const cnt = sum(filteredSchools.map(s => tqo(s).age?.[i] || 0));
              return [label, pct(cnt, totTch || 1), `${cnt} teachers`] as [string, number, string];
            }),
          },
        ],
      };
    }

    // 10. FACILITIES / COMPUTERS / TOILETS KPIs
    if (
      kLower.includes('facility') ||
      kLower.includes('computer') ||
      kLower.includes('toilet')
    ) {
      const wf = filteredSchools.filter(s => s.fac);
      const totPc = sum(wf.map(s => s.fac?.pc || 0));
      const totSeats = sum(wf.map(s => (s.fac?.tM || 0) + (s.fac?.tF || 0)));

      return {
        title: `${key} — Infrastructure & WASH Breakdown`,
        subtitle: 'School-by-school ICT computers, sanitation seats, and core facility availability scores',
        hasPortalToggle: false,
        summaryPills: [
          ['Schools with Facility Data', String(wf.length)],
          ['Total Computers', totPc.toLocaleString()],
          ['Pupils / Computer', totPc ? (totPupils / totPc).toFixed(1) : '-'],
          ['Total Toilet Seats', totSeats.toLocaleString()],
          ['Pupils / Toilet Seat', totSeats ? (totPupils / totSeats).toFixed(1) : '-'],
        ] as [string, string][],
        tableCols: [
          'School Name',
          'Circuit',
          'Facility Score',
          'Computer Lab',
          'Computers',
          'Pupils/PC',
          'Toilet Seats (M/F)',
          'Pupils/Seat',
          'Missing Core Facilities',
        ],
        tableRows: filteredSchools.map(s => {
          const seats = s.fac ? (s.fac.tM || 0) + (s.fac.tF || 0) : 0;
          const pcs = s.fac?.pc || 0;
          return [
            s.name,
            s.circuit,
            s.fac ? `${score(s)}/8` : 'n/a',
            s.fac ? (s.fac.lab ? 'Yes' : 'No') : 'n/a',
            pcs,
            pcs ? (pupils(s) / pcs).toFixed(1) : '-',
            seats,
            seats ? (pupils(s) / seats).toFixed(1) : '-',
            missing(s),
          ];
        }),
        cards: filteredSchools.map(s => {
          const seats = s.fac ? (s.fac.tM || 0) + (s.fac.tF || 0) : 0;
          const pcs = s.fac?.pc || 0;
          const sc = score(s);
          return {
            id: s.id || s.emis + s.name,
            school: s,
            title: s.name,
            badge: s.fac ? `Score: ${sc}/8` : 'No data',
            badgeColor: sc >= 6 ? '#059669' : sc >= 4 ? '#d97706' : '#dc2626',
            meta: `${s.circuit} · ${pupils(s)} pupils`,
            stats: [
              ['Computers', `${pcs} (${s.fac?.lab ? 'Has Lab' : 'No Lab'})`],
              ['Toilet Seats', `${seats} (M:${s.fac?.tM || 0} / F:${s.fac?.tF || 0})`],
              ['Water & Elec', `${s.fac?.water ? 'Water ✓' : 'No Water'} · ${s.fac?.elec ? 'Elec ✓' : 'No Elec'}`],
              ['Internet', s.fac?.net ? 'Connected' : 'None'],
            ] as [string, string][],
            footer: `Missing: ${missing(s)}`,
            progress: (sc / 8) * 100,
          };
        }),
        charts: [
          {
            title: 'Core Facility Coverage Across Schools (%)',
            items: FAC.map(([fk, fl]) => {
              const cnt = wf.filter(s => s.fac?.[fk]).length;
              return [fl, pct(cnt, wf.length || 1), `${cnt}/${wf.length} (${pct(cnt, wf.length || 1)}%)`] as [
                string,
                number,
                string
              ];
            }),
          },
        ],
      };
    }

    // 11. TEXTBOOKS / RECORD-KEEPING KPIs (Default fallback as well)
    const wb = filteredSchools.filter(s => s.tb);
    return {
      title: `${key} (${val}) — Detailed School Breakdown`,
      subtitle: 'School-by-school textbook availability across 10 core subjects and statutory record-keeping',
      hasPortalToggle: false,
      summaryPills: [
        ['Selected Metric', `${key}: ${val}`],
        ['Schools with Textbook Data', String(wb.length)],
        ['Total Schools Matched', String(filteredSchools.length)],
      ] as [string, string][],
      tableCols: ['School Name', 'Circuit', 'Adequate Subjects (/10)', 'Shortage Subjects', 'Records Kept'],
      tableRows: filteredSchools.map(s => {
        const adeq = s.tb ? s.tb.filter((x: string) => x === 'ADEQUATE').length : 0;
        const shortList = s.tb ? TB.filter((_, i) => s.tb?.[i] !== 'ADEQUATE').join(', ') || 'None' : 'No data';
        return [s.name, s.circuit, s.tb ? `${adeq}/10` : 'n/a', shortList, s.rec ? `${s.rec[0]}/${s.rec[1]}` : '-'];
      }),
      cards: filteredSchools.map(s => {
        const adeq = s.tb ? s.tb.filter((x: string) => x === 'ADEQUATE').length : 0;
        return {
          id: s.id || s.emis + s.name,
          school: s,
          title: s.name,
          badge: s.tb ? `${adeq}/10 Adequate` : 'No data',
          badgeColor: adeq >= 7 ? '#059669' : adeq >= 4 ? '#d97706' : '#dc2626',
          meta: `${s.circuit} · ${pupils(s)} pupils`,
          stats: [
            ['Adequate Subjects', s.tb ? `${adeq} of 10` : 'n/a'],
            ['Records Kept', s.rec ? `${s.rec[0]}/${s.rec[1]}` : '-'],
            ['Pupils', pupils(s).toLocaleString()],
            ['Teachers', String(teachers(s))],
          ] as [string, string][],
          footer: s.tb
            ? `Short in: ${TB.filter((_, i) => s.tb?.[i] !== 'ADEQUATE').join(', ') || 'None'}`
            : 'No textbook census record',
          progress: adeq * 10,
        };
      }),
      charts: [
        {
          title: 'Textbook Adequacy by Subject (%)',
          items: TB.map((subj, i) => {
            const cnt = wb.filter(s => s.tb?.[i] === 'ADEQUATE').length;
            return [subj, pct(cnt, wb.length || 1), `${cnt}/${wb.length} schools`] as [string, number, string];
          }),
        },
      ],
    };
  }, [
    activePair,
    filteredSchools,
    filteredSubmissions,
    allCircuits,
    target,
    teacherSubMode,
  ]);

  const handleExportDrilldownExcel = () => {
    if (!drilldown) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([drilldown.tableCols, ...drilldown.tableRows]);
    XLSX.utils.book_append_sheet(wb, ws, (selectedKey || 'Breakdown').slice(0, 31));
    XLSX.writeFile(
      wb,
      `Tema-Metro-${(selectedKey || 'KPI').replace(/[^a-z0-9]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Responsive Interactive KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
        }}
      >
        {items.map(([k, v]) => {
          const isSelected = selectedKey === k;
          const isHovered = hoveredKey === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSelectedKey(prev => (prev === k ? '' : k))}
              onMouseEnter={() => setHoveredKey(k)}
              onMouseLeave={() => setHoveredKey('')}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: '10px',
                border: `1.5px solid ${
                  isSelected
                    ? '#10b981'
                    : isHovered
                    ? isDark
                      ? '#10b981'
                      : '#059669'
                    : isDark
                    ? '#334155'
                    : '#e2e8f0'
                }`,
                borderLeft: `4px solid ${isSelected ? '#10b981' : '#047857'}`,
                backgroundColor: isSelected
                  ? isDark
                    ? '#064e3b'
                    : '#ecfdf5'
                  : isDark
                  ? '#1e293b'
                  : '#ffffff',
                padding: '13px 15px',
                transition: 'all 0.18s ease',
                transform: isHovered || isSelected ? 'translateY(-2px)' : 'none',
                boxShadow:
                  isHovered || isSelected
                    ? isDark
                      ? '0 8px 20px -4px rgba(0, 0, 0, 0.45)'
                      : '0 8px 20px -4px rgba(4, 120, 87, 0.15)'
                    : 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '6px',
                color: 'inherit',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isSelected
                      ? isDark
                        ? '#a7f3d0'
                        : '#065f46'
                      : isDark
                      ? '#94a3b8'
                      : '#64748b',
                  }}
                >
                  {k}
                </span>
                <ChevronRight
                  size={14}
                  style={{
                    color: isSelected ? '#10b981' : isDark ? '#64748b' : '#94a3b8',
                    transform: isSelected ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.18s ease',
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: '21px',
                  fontWeight: 800,
                  color: isDark ? '#f8fafc' : '#0f172a',
                  lineHeight: 1.2,
                  wordBreak: 'break-word',
                }}
              >
                {v}
              </div>

              <div
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: isSelected ? '#10b981' : isHovered ? '#10b981' : isDark ? '#64748b' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {isSelected ? 'Viewing details · Click to close' : 'Click to view full details →'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Multi-View KPI Drill-Down Panel */}
      {activePair && drilldown && (
        <div
          style={{
            borderRadius: '12px',
            border: `1.5px solid ${isDark ? '#10b981' : '#059669'}`,
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            padding: '18px',
            boxShadow: isDark
              ? '0 12px 32px -8px rgba(0, 0, 0, 0.6)'
              : '0 12px 32px -8px rgba(4, 120, 87, 0.15)',
          }}
        >
          {/* Top Header & View Switcher */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '12px',
              paddingBottom: '14px',
              borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '3px 8px',
                    borderRadius: '99px',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                  }}
                >
                  Interactive Breakdown
                </span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>
                  {drilldown.title}
                </h3>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: isDark ? '#94a3b8' : '#64748b' }}>
                {drilldown.subtitle}
              </p>
            </div>

            {/* View Form Switcher Buttons + Export + Close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'inline-flex',
                  borderRadius: '8px',
                  padding: '3px',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                }}
              >
                {(
                  [
                    ['cards', 'Cards View', LayoutGrid],
                    ['table', 'Table View', TableIcon],
                    ['chart', 'Chart View', BarChart3],
                  ] as const
                ).map(([mId, mLabel, Icon]) => {
                  const active = viewMode === mId;
                  return (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => setViewMode(mId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 11px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: active ? 700 : 500,
                        backgroundColor: active ? '#059669' : 'transparent',
                        color: active ? '#ffffff' : isDark ? '#cbd5e1' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      <Icon size={13.5} />
                      {mLabel}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleExportDrilldownExcel}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download size={13.5} /> Export (.xlsx)
              </button>

              <button
                type="button"
                onClick={() => setSelectedKey('')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '7px 11px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isDark ? '#334155' : '#e2e8f0',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <X size={14} /> Close
              </button>
            </div>
          </div>

          {/* Summary Mini-KPI Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '10px',
              marginTop: '14px',
            }}
          >
            {drilldown.summaryPills.map(([sLabel, sVal]) => (
              <div
                key={sLabel}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                }}
              >
                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>{sLabel}</div>
                <div style={{ fontSize: '15px', fontWeight: 800, marginTop: '2px' }}>{sVal}</div>
              </div>
            ))}
          </div>

          {/* Filter, Search & Portal Staff Toggle Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              marginTop: '14px',
              marginBottom: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b',
                  }}
                />
                <input
                  type="text"
                  placeholder="Filter breakdown by school, EMIS, circuit, head teacher or staff..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 30px',
                    borderRadius: '8px',
                    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    color: 'inherit',
                    fontSize: '12.5px',
                  }}
                />
              </div>

              <select
                value={circuitFilter}
                onChange={e => setCircuitFilter(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  color: 'inherit',
                  fontSize: '12.5px',
                }}
              >
                <option value="All">All Circuits ({allCircuits.length})</option>
                {allCircuits.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {drilldown.hasPortalToggle && (
              <div
                style={{
                  display: 'inline-flex',
                  borderRadius: '8px',
                  padding: '3px',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => setTeacherSubMode('schools')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: teacherSubMode === 'schools' ? 700 : 500,
                    backgroundColor: teacherSubMode === 'schools' ? '#0284c7' : 'transparent',
                    color: teacherSubMode === 'schools' ? '#fff' : 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  By School ({filteredSchools.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherSubMode('portal')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: teacherSubMode === 'portal' ? 700 : 500,
                    backgroundColor: teacherSubMode === 'portal' ? '#0284c7' : 'transparent',
                    color: teacherSubMode === 'portal' ? '#fff' : 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Individual Portal Staff ({filteredSubmissions.length})
                </button>
              </div>
            )}
          </div>

          {/* VIEW FORM 1: RESPONSIVE CARDS GRID VIEW */}
          {viewMode === 'cards' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '12px',
                maxHeight: '620px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {drilldown.cards.map((card: any) => (
                <div
                  key={card.id}
                  style={{
                    borderRadius: '10px',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    padding: '13px 15px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '9px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13.5px', color: isDark ? '#f8fafc' : '#0f172a' }}>
                        {card.title}
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '99px',
                          backgroundColor: card.badgeColor,
                          color: '#ffffff',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {card.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                      {card.meta}
                    </div>
                  </div>

                  {/* Stats Grid inside Card */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '6px',
                      padding: '8px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                      fontSize: '11.5px',
                    }}
                  >
                    {card.stats.map(([stK, stV]: [string, string]) => (
                      <div key={stK}>
                        <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '10.5px' }}>{stK}</div>
                        <div style={{ fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', wordBreak: 'break-word' }}>
                          {stV}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Retiring Teachers Names Section (for Retirement Forecast / Aged 55+ View) */}
                  {card.retiringList !== undefined && (
                    <div
                      style={{
                        borderRadius: '8px',
                        padding: '8px 10px',
                        backgroundColor: isDark ? 'rgba(217, 119, 6, 0.12)' : '#fffbeb',
                        border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a'}`,
                        fontSize: '11.5px',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          color: isDark ? '#fbbf24' : '#b45309',
                          marginBottom: '5px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>Teachers Going on Retirement (55+):</span>
                        <span>{card.retiringList.length} named</span>
                      </div>
                      {card.retiringList.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {card.retiringList.map((rt: any, rIdx: number) => (
                            <div
                              key={rIdx}
                              style={{
                                padding: '5px 7px',
                                borderRadius: '6px',
                                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                                border: `1px solid ${isDark ? '#334155' : '#fde68a'}`,
                              }}
                            >
                              <div style={{ fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a' }}>
                                {rIdx + 1}. {rt.name}{' '}
                                {rt.staffId && (
                                  <span style={{ color: '#10b981', fontWeight: 600 }}>· ID: {rt.staffId}</span>
                                )}
                              </div>
                              <div style={{ fontSize: '10.5px', color: isDark ? '#cbd5e1' : '#475569', marginTop: '1px' }}>
                                {rt.age ? `Age: ${rt.age} yrs` : 'Age 55+'}
                                {rt.dob ? ` (DOB: ${rt.dob})` : ''}
                                {rt.retireYear ? ` · Retires: ${rt.retireYear}` : ''}
                                {rt.rank ? ` · ${rt.rank}` : ''}
                                {rt.subject ? ` · ${rt.subject}` : ''}
                                {rt.phone ? ` · Tel: ${rt.phone}` : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : card.expectedRetiringCount > 0 ? (
                        <div style={{ color: isDark ? '#cbd5e1' : '#78350f', fontSize: '11px' }}>
                          {card.expectedRetiringCount} teacher(s) aged 55+ recorded in census count. Click{' '}
                          <b>Edit School</b> below to enter or confirm their names.
                        </div>
                      ) : (
                        <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '11px' }}>
                          No teachers currently aged 55+ at this school.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mini Progress Bar */}
                  <div
                    style={{
                      height: '5px',
                      borderRadius: '99px',
                      backgroundColor: isDark ? '#334155' : '#e2e8f0',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, card.progress || 0))}%`,
                        backgroundColor: card.badgeColor || '#10b981',
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '11px',
                      color: isDark ? '#94a3b8' : '#64748b',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {card.footer}
                    </span>
                    {card.school && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {onEditSchool && (
                          <button
                            type="button"
                            onClick={() => onEditSchool(card.school)}
                            style={{
                              background: isDark ? '#334155' : '#e2e8f0',
                              border: 'none',
                              borderRadius: '5px',
                              color: isDark ? '#f8fafc' : '#0f172a',
                              fontWeight: 600,
                              fontSize: '11px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              padding: '3px 8px',
                            }}
                          >
                            Edit School
                          </button>
                        )}
                        {onInspectSchool && (
                          <button
                            type="button"
                            onClick={() => onInspectSchool(card.school)}
                            style={{
                              background: '#059669',
                              border: 'none',
                              borderRadius: '5px',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '11px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              padding: '3px 9px',
                            }}
                          >
                            View Full Window →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VIEW FORM 2: FULL SPREADSHEET TABLE VIEW */}
          {viewMode === 'table' && (
            <div style={{ maxHeight: '540px', overflowY: 'auto' }}>
              <Tbl isDark={isDark} cols={drilldown.tableCols} rows={drilldown.tableRows} />
            </div>
          )}

          {/* VIEW FORM 3: VISUAL BAR CHART BREAKDOWN VIEW */}
          {viewMode === 'chart' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '14px',
              }}
            >
              {drilldown.charts.map(ch => (
                <Card key={ch.title} title={ch.title} isDark={isDark}>
                  {ch.items.map(([label, valPct, noteStr]) => (
                    <Bar key={label} label={label} value={valPct} note={noteStr} isDark={isDark} />
                  ))}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Build the 7 Official Directorate Reports
function buildReports(S: any[], t: number) {
  const circuits = Array.from(new Set(S.map(s => s.circuit))).sort();
  const f = (s: any, k: string) => (s.fac ? (s.fac[k] ? 'Yes' : 'No') : 'n/a');
  return [
    {
      id: 'census',
      title: 'School Census Report',
      cols: [
        'EMIS',
        'School',
        'Circuit',
        'Type',
        'Levels',
        'KG',
        'Primary',
        'JHS',
        'Boys',
        'Girls',
        'Total',
        'Teachers',
        'Trained',
        'Classrooms',
        'PTR',
        'Facility score',
      ],
      rows: S.map(s => [
        s.emis,
        s.name,
        s.circuit,
        s.type,
        s.levels,
        s.enr[0] + s.enr[1],
        s.enr[2] + s.enr[3],
        s.enr[4] + s.enr[5],
        s.enr[0] + s.enr[2] + s.enr[4],
        s.enr[1] + s.enr[3] + s.enr[5],
        pupils(s),
        teachers(s),
        sum(s.trn || []),
        s.rooms,
        ptr(s).toFixed(1),
        s.fac ? score(s) + '/8' : 'n/a',
      ]),
    },
    {
      id: 'district',
      title: 'District Statistical Report',
      cols: [
        'Circuit',
        'Schools',
        'KG',
        'Primary',
        'JHS',
        'Total',
        'GPI',
        'Teachers',
        'PTR',
        'Classrooms',
      ],
      rows: circuits.map(c => {
        const g = S.filter(s => s.circuit === c);
        const b = sum(g.map(s => s.enr[0] + s.enr[2] + s.enr[4]));
        const gl = sum(g.map(s => s.enr[1] + s.enr[3] + s.enr[5]));
        const tc = sum(g.map(teachers));
        return [
          c,
          g.length,
          sum(g.map(s => s.enr[0] + s.enr[1])),
          sum(g.map(s => s.enr[2] + s.enr[3])),
          sum(g.map(s => s.enr[4] + s.enr[5])),
          b + gl,
          b ? (gl / b).toFixed(2) : '-',
          tc,
          tc ? ((b + gl) / tc).toFixed(1) : '-',
          sum(g.map(s => s.rooms)),
        ];
      }),
    },
    {
      id: 'staffing',
      title: 'Staffing Analysis Report',
      cols: [
        'School',
        'Circuit',
        'Pupils',
        'Teachers',
        'Male',
        'Female',
        'Trained',
        'Aged 55+',
        'Required at PTR ' + t,
        'Surplus(+)/Deficit(-)',
      ],
      rows: S.map(s => [
        s.name,
        s.circuit,
        pupils(s),
        teachers(s),
        tqo(s).M,
        tqo(s).F,
        sum(s.trn || []),
        tqo(s).age[4] + tqo(s).age[5],
        Math.ceil(pupils(s) / t),
        teachers(s) - Math.ceil(pupils(s) / t),
      ]),
    },
    {
      id: 'infra',
      title: 'Infrastructure Gap Report',
      cols: [
        'School',
        'Circuit',
        'Facility score',
        'Missing facilities',
        'Toilet seats',
        'Pupils per seat',
        'Poor-condition elements',
      ],
      rows: S.map(s => {
        const seats = s.fac ? (s.fac.tM || 0) + (s.fac.tF || 0) : 0;
        return [
          s.name,
          s.circuit,
          s.fac ? score(s) + '/8' : 'n/a',
          missing(s),
          seats,
          seats ? (pupils(s) / seats).toFixed(1) : '-',
          poorItems(s),
        ];
      }),
    },
    {
      id: 'tbsubject',
      title: 'Textbook Distribution Report',
      cols: ['Subject', 'Adequate', 'Inadequate', 'Not available', 'Pupils in shortage schools'],
      rows: TB.map((n, i) => {
        const w = S.filter(s => s.tb);
        return [
          n,
          w.filter(s => s.tb[i] === 'ADEQUATE').length,
          w.filter(s => s.tb[i] === 'INADEQUATE').length,
          w.filter(s => s.tb[i] === 'NOT AVAILABLE').length,
          sum(w.filter(s => s.tb[i] === 'INADEQUATE' || s.tb[i] === 'NOT AVAILABLE').map(pupils)),
        ];
      }),
    },
    {
      id: 'tbschool',
      title: 'Textbook Status by School',
      cols: ['School', 'Circuit', ...TB],
      rows: S.filter(s => s.tb).map(s => [s.name, s.circuit, ...s.tb]),
    },
    {
      id: 'ict',
      title: 'ICT Readiness Report',
      cols: [
        'School',
        'Circuit',
        'Computer lab',
        'Computers',
        'Pupils per computer',
        'Internet',
        'Provider',
        'Electricity',
        'Projector',
        'Television',
      ],
      rows: S.map(s => [
        s.name,
        s.circuit,
        f(s, 'lab'),
        s.fac ? s.fac.pc || 0 : 'n/a',
        s.fac && s.fac.pc ? (pupils(s) / s.fac.pc).toFixed(1) : '-',
        f(s, 'net'),
        s.fac ? s.fac.prov || '-' : 'n/a',
        f(s, 'elec'),
        f(s, 'proj'),
        f(s, 'tv'),
      ]),
    },
  ];
}

interface EdmsModuleProps {
  schoolsData: any[];
  submissions: any[];
  onBackToAdmin?: () => void;
}

export default function EdmsModule({ schoolsData, submissions, onBackToAdmin }: EdmsModuleProps) {
  const [tab, setTab] = useState<
    'dashboard' | 'schools' | 'enrolment' | 'staffing' | 'facilities' | 'textbooks' | 'reports' | 'import'
  >('dashboard');
  const [isDark, setIsDark] = useState(true);
  const [target, setTarget] = useState(35);
  const [toastMsg, setToastMsg] = useState('');

  // Schools tab & Broad School Window state
  const [q, setQ] = useState('');
  const [cirFilter, setCirFilter] = useState('All');
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newOwn, setNewOwn] = useState('PUBLIC');
  const [newCir, setNewCir] = useState(DEFAULT_CIRCUITS[0]);
  const [newHead, setNewHead] = useState('');

  // Broad School Details & Edit Window Modal state
  const [detailSchoolId, setDetailSchoolId] = useState<string>('');
  const [detailModalMode, setDetailModalMode] = useState<'view' | 'edit'>('view');
  const [editDraft, setEditDraft] = useState<any>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Circuit Manager Modal state
  const [showCircuitModal, setShowCircuitModal] = useState(false);
  const [circuitRenameInputs, setCircuitRenameInputs] = useState<Record<string, string>>({});
  const [customCircuits, setCustomCircuits] = useState<string[]>([]);
  const [newCustomCirName, setNewCustomCirName] = useState('');

  // Interactive School Editor Selection (for Enrolment, Facilities, Textbooks)
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [showInteractiveEditor, setShowInteractiveEditor] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<Record<string, any>>({});

  // Reports tab state
  const [reportId, setReportId] = useState('census');

  // Import tab state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importMsg, setImportMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  const showToast = (m: string) => {
    setToastMsg(m);
    setTimeout(() => {
      setToastMsg(prev => (prev === m ? '' : prev));
    }, 3500);
  };

  // Filter out empty drafts from live portal submissions
  const validSubmissions = useMemo(() => {
    return submissions.filter((sub: any) => {
      const isDraft = sub.status === 'draft' && (!sub.documents || sub.documents.length === 0);
      return !isDraft;
    });
  }, [submissions]);

  // Group submitted portal teachers by canonical school match key (deduplicated by staffId)
  const portalTeachersBySchool = useMemo(() => {
    const map = new Map<string, any[]>();
    const seenStaff = new Map<string, Set<string>>();

    validSubmissions.forEach((sub: any) => {
      if (!sub.school || sub.category === 'Education Office') return;
      const k = schoolMatchKey(sub.school);
      if (!k) return;
      const staffKey = sub.staffId ? norm(sub.staffId) : sub.id;

      if (!map.has(k)) {
        map.set(k, []);
        seenStaff.set(k, new Set());
      }
      if (!seenStaff.get(k)!.has(staffKey)) {
        seenStaff.get(k)!.add(staffKey);
        map.get(k)!.push(sub);
      }
    });
    return map;
  }, [validSubmissions]);

  // Compute unified `schools` array combining Firestore `schools` + live portal `submissions`
  const schools = useMemo(() => {
    const schoolMap = new Map<string, any>();

    // 1. Add all Firestore `schools` documents (deduplicating by canonical schoolMatchKey)
    schoolsData.forEach((raw: any) => {
      const rawName = txt(raw.name || raw.school);
      const k = schoolMatchKey(rawName);
      if (!k) return;
      const existing = schoolMap.get(k);
      if (!existing) {
        schoolMap.set(k, raw);
      } else {
        // Prefer the record that has actual census enrolment or official numeric EMIS code
        const existingHasEnr = Array.isArray(existing.enr) && sum(existing.enr) > 0;
        const rawHasEnr = Array.isArray(raw.enr) && sum(raw.enr) > 0;
        if (rawHasEnr && !existingHasEnr) {
          schoolMap.set(k, { ...existing, ...raw });
        } else {
          schoolMap.set(k, { ...raw, ...existing });
        }
      }
    });

    // 2. Auto-discover any school referenced in teacher portal submissions that isn't already in schoolMap
    validSubmissions.forEach((sub: any) => {
      if (!sub.school || sub.category === 'Education Office') return;
      const k = schoolMatchKey(sub.school);
      if (!k) return;
      if (!schoolMap.has(k)) {
        schoolMap.set(k, {
          id: `virtual_${k}`,
          name: txt(sub.school).toUpperCase(),
          school: txt(sub.school).toUpperCase(),
          circuit: canonicalCircuit(sub.circuit || 'ASHAMANG'),
          type: 'PUBLIC',
          levels: sub.category === 'SENIOR HIGH SCHOOL' ? 'SHS' : 'KG, PRY & JHS',
        });
      }
    });

    const sortedRaw = Array.from(schoolMap.values()).sort((a, b) =>
      txt(a.name || a.school).localeCompare(txt(b.name || b.school))
    );

    return sortedRaw.map((raw, idx) => {
      const id = String(raw.id || `sch_${idx + 1}`);
      const override = localOverrides[id] || {};
      const merged = { ...raw, ...override };

      const name = txt(merged.name || merged.school || `School ${idx + 1}`).toUpperCase();
      const k = schoolMatchKey(name);
      const emis = txt(merged.emis || merged.code || `TM-${1000 + idx * 7}`);
      const circuit = override.circuit
        ? txt(override.circuit).toUpperCase()
        : canonicalCircuit(merged.circuit || 'ASHAMANG');
      const type = txt(merged.type || merged.own || 'PUBLIC').toUpperCase();

      // Build `tq`, `retiringTeachers`, and `allStaffRoster` from live portal submissions + workbook data
      const matchedSubs = portalTeachersBySchool.get(k) || [];
      const portalTq = {
        n: 0,
        M: 0,
        F: 0,
        age: [0, 0, 0, 0, 0, 0],
        svc: [0, 0, 0, 0],
        rank: {} as Record<string, number>,
        prof: {} as Record<string, number>,
        sub: {} as Record<string, number>,
      };
      let portalTrainedCount = 0;

      const portalRoster: any[] = [];
      const portalRetiring: any[] = [];
      const portalSeniorFallback: any[] = [];

      matchedSubs.forEach((sub: any) => {
        portalTq.n++;
        const sex = txt(sub.sex).toUpperCase();
        if (sex.startsWith('M')) portalTq.M++;
        else if (sex.startsWith('F')) portalTq.F++;

        const by = yr(sub.dob);
        const g = by ? NOW - by : 0;
        if (by) {
          portalTq.age[g < 30 ? 0 : g < 40 ? 1 : g < 50 ? 2 : g < 55 ? 3 : g < 60 ? 4 : 5]++;
        }

        const fy = yr(sub.firstAppointment || sub.dateFirstAppointment);
        const v = fy ? NOW - fy : 0;
        if (fy) {
          portalTq.svc[v < 5 ? 0 : v < 15 ? 1 : v < 25 ? 2 : 3]++;
        }

        const rnk = txt(sub.currentRank).toUpperCase() || 'UNSPECIFIED';
        inc(portalTq.rank, rnk);

        // Extract highest professional qualification
        let profLabel = 'UNSPECIFIED';
        if (Array.isArray(sub.professional) && sub.professional.length > 0) {
          const firstValid = sub.professional.find((p: any) => p && (p.course || p.award || p.institution));
          if (firstValid) {
            profLabel = txt(firstValid.course || firstValid.award || 'DEGREE').toUpperCase();
            portalTrainedCount++;
          }
        } else if (sub.teachersLicence || (rnk && rnk !== 'PUPIL TEACHER' && rnk !== 'UNSPECIFIED')) {
          profLabel = 'PROFESSIONAL CERT';
          portalTrainedCount++;
        }
        inc(portalTq.prof, profLabel);

        const subj = txt(sub.subject || sub.areaOfSpecialization || 'GENERAL').toUpperCase();
        inc(portalTq.sub, subj);

        const fullName =
          txt(sub.teacherName) ||
          `${txt(sub.firstName)} ${txt(sub.otherNames)} ${txt(sub.surname)}`.replace(/\s+/g, ' ').trim() ||
          'TEACHER';

        const staffObj = {
          id: sub.id,
          name: fullName.toUpperCase(),
          staffId: txt(sub.staffId || sub.regNo),
          sex: sex.startsWith('M') ? 'MALE' : sex.startsWith('F') ? 'FEMALE' : '-',
          age: g,
          dob: txt(sub.dob),
          retireYear: by ? by + 60 : '',
          yearsLeft: g ? Math.max(0, 60 - g) : null,
          serviceYears: v,
          rank: rnk,
          prof: profLabel,
          subject: subj,
          phone: txt(sub.mobile || sub.telephone || sub.phone),
          email: txt(sub.email),
          source: 'Portal',
        };
        portalRoster.push(staffObj);

        if (g >= 55) {
          portalRetiring.push(staffObj);
        } else if (!by && (v >= 25 || rnk.includes('DEPUTY DIR') || rnk.includes('ASST. DIR') || rnk.includes('ASSISTANT DIRECTOR'))) {
          portalSeniorFallback.push(staffObj);
        }
      });

      // Use imported `tq` if it has more records, otherwise use live `portalTq`
      const finalTq =
        merged.tq && merged.tq.n && merged.tq.n >= portalTq.n
          ? merged.tq
          : portalTq.n > 0
          ? portalTq
          : merged.tq || portalTq;

      // Combine retiring teachers from manual edits, census workbook `retiringList`, and portal `portalRetiring`
      const combinedRetiring: any[] = [];
      const seenRetiring = new Set<string>();
      const pushRetiring = (item: any) => {
        if (!item || !item.name) return;
        const rk = norm(item.staffId || item.name);
        if (!rk || seenRetiring.has(rk)) return;
        seenRetiring.add(rk);
        combinedRetiring.push(item);
      };

      if (Array.isArray(merged.retiringTeachers)) {
        merged.retiringTeachers.forEach(pushRetiring);
      }
      if (Array.isArray(merged.tq?.retiringList)) {
        merged.tq.retiringList.forEach(pushRetiring);
      }
      portalRetiring.forEach(pushRetiring);

      // If census `age[4] + age[5]` is still higher than named retiring teachers, include senior fallback portal teachers
      const expected55Count = (finalTq.age?.[4] || 0) + (finalTq.age?.[5] || 0);
      if (combinedRetiring.length < expected55Count && portalSeniorFallback.length > 0) {
        portalSeniorFallback.slice(0, expected55Count - combinedRetiring.length).forEach(pushRetiring);
      }

      // Combine full staff roster
      const allStaffRoster: any[] = [...portalRoster];
      const seenRoster = new Set(portalRoster.map(p => norm(p.staffId || p.name)));
      if (Array.isArray(merged.tq?.staffList)) {
        merged.tq.staffList.forEach((st: any) => {
          const sk = norm(st.staffId || st.name);
          if (sk && !seenRoster.has(sk)) {
            seenRoster.add(sk);
            allStaffRoster.push(st);
          }
        });
      }

      // Enrolment array `[kgB, kgG, priB, priG, jhsB, jhsG]`
      let enrArr: number[] = [0, 0, 0, 0, 0, 0];
      if (Array.isArray(merged.enr) && merged.enr.length === 6) {
        enrArr = merged.enr.map(num);
      } else if (merged.enr && typeof merged.enr === 'object' && !Array.isArray(merged.enr)) {
        enrArr = [
          num(merged.enr.KG?.[0]),
          num(merged.enr.KG?.[1]),
          num(merged.enr.PRI?.[0]),
          num(merged.enr.PRI?.[1]),
          num(merged.enr.JHS?.[0]),
          num(merged.enr.JHS?.[1]),
        ];
      }

      // 22-element class array `cl` (KG1 B/G, KG2 B/G, P1..P6 B/G, JH1..JH3 B/G)
      let clArr: number[] = Array(22).fill(0);
      if (Array.isArray(merged.cl) && merged.cl.length === 22) {
        clArr = merged.cl.map(num);
      } else if (sum(enrArr) > 0) {
        clArr[0] = Math.floor(enrArr[0] / 2);
        clArr[1] = Math.floor(enrArr[1] / 2);
        clArr[2] = enrArr[0] - clArr[0];
        clArr[3] = enrArr[1] - clArr[1];
        for (let p = 0; p < 6; p++) {
          clArr[4 + p * 2] = Math.floor(enrArr[2] / 6) + (p === 0 ? enrArr[2] % 6 : 0);
          clArr[5 + p * 2] = Math.floor(enrArr[3] / 6) + (p === 0 ? enrArr[3] % 6 : 0);
        }
        for (let j = 0; j < 3; j++) {
          clArr[16 + j * 2] = Math.floor(enrArr[4] / 3) + (j === 0 ? enrArr[4] % 3 : 0);
          clArr[17 + j * 2] = Math.floor(enrArr[5] / 3) + (j === 0 ? enrArr[5] % 3 : 0);
        }
      }

      const rcArr: number[] =
        Array.isArray(merged.rc) && merged.rc.length === 11
          ? merged.rc.map(num)
          : sum(enrArr) > 0
          ? [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
          : Array(11).fill(0);

      const roomsCount = num(merged.rooms) || sum(rcArr);

      // Teachers `[kgTch, priTch, jhsTch]`
      let tchArr: number[] = [0, 0, 0];
      if (Array.isArray(merged.tch) && merged.tch.length === 3 && sum(merged.tch) >= portalTq.n) {
        tchArr = merged.tch.map(num);
      } else if (Array.isArray(merged.teachers) && num(merged.teachers[0]) > portalTq.n) {
        tchArr = [0, num(merged.teachers[0]), 0];
      } else {
        tchArr = [0, portalTq.n, 0];
      }

      let trnArr: number[] = [0, 0, 0];
      if (Array.isArray(merged.trn) && merged.trn.length === 3 && sum(merged.trn) >= portalTrainedCount) {
        trnArr = merged.trn.map(num);
      } else {
        trnArr = [0, Math.max(portalTrainedCount, num(merged.teachers?.[1])), 0];
      }

      // Normalize facilities object
      let facObj: any = null;
      if (merged.fac && typeof merged.fac === 'object') {
        if ('lab' in merged.fac || 'elec' in merged.fac || 'toilet' in merged.fac) {
          facObj = merged.fac;
        } else {
          facObj = {
            lab: Boolean(merged.fac['ICT lab']),
            sci: Boolean(merged.fac['Science lab']),
            elec: Boolean(merged.fac['Electricity']),
            net: Boolean(merged.fac['Internet']),
            water: Boolean(merged.fac['Borehole / water']),
            toilet: Boolean(merged.fac['Toilets (gender-separated)']),
            field: Boolean(merged.fac['Sports field']),
            scr: Boolean(merged.fac['Library']),
            pc: num(merged.fac.pc),
            tM: num(merged.fac.tM),
            tF: num(merged.fac.tF),
            cond: merged.fac.cond || ['GOOD', 'GOOD', 'GOOD', 'GOOD', 'GOOD'],
          };
        }
      }

      // Normalize textbooks `tb` array
      let tbArr: string[] | null = null;
      if (Array.isArray(merged.tb) && merged.tb.length === TB.length) {
        tbArr = merged.tb;
      } else if (merged.books && typeof merged.books === 'object') {
        tbArr = TB.map(subj => {
          const bPair = merged.books[subj] || merged.books[subj === 'Maths' ? 'Mathematics' : subj];
          if (!Array.isArray(bPair)) return 'INADEQUATE';
          const [reqB, availB] = bPair;
          if (!availB || availB <= 0) return 'NOT AVAILABLE';
          return availB >= reqB * 0.8 ? 'ADEQUATE' : 'INADEQUATE';
        });
      }

      return {
        id,
        firestoreId: String(raw.id || '').startsWith('virtual_') ? undefined : raw.id,
        emis,
        name,
        district: txt(merged.district || 'TEMA METRO'),
        circuit,
        head: txt(merged.head || 'Not assigned'),
        levels: txt(merged.levels || 'KG, PRY & JHS'),
        type,
        mgmt: txt(merged.mgmt || 'MA/DA'),
        phone: txt(merged.phone || ''),
        email: txt(merged.email || ''),
        status: txt(merged.status || 'Verified'),
        deprived: Boolean(merged.deprived),
        enr: enrArr,
        cl: clArr,
        rc: rcArr,
        tch: tchArr,
        trn: trnArr,
        nts: num(merged.nts),
        rooms: roomsCount,
        fac: facObj,
        tb: tbArr,
        rec: merged.rec || null,
        lang: merged.lang || null,
        tq: finalTq,
        portalTeachers: matchedSubs,
        retiringTeachers: combinedRetiring,
        allStaffRoster,
      };
    });
  }, [schoolsData, validSubmissions, portalTeachersBySchool, localOverrides]);

  const activeSchool = useMemo(() => {
    if (!schools.length) return null;
    return schools.find(s => s.id === selectedSchoolId) || schools[0];
  }, [schools, selectedSchoolId]);

  const detailSchool = useMemo(() => {
    if (!detailSchoolId) return null;
    return schools.find(s => s.id === detailSchoolId) || null;
  }, [schools, detailSchoolId]);

  const allCircuits = useMemo(() => {
    const set = new Set<string>([...DEFAULT_CIRCUITS, ...customCircuits]);
    schools.forEach(s => {
      if (s.circuit) set.add(s.circuit);
    });
    return Array.from(set).sort();
  }, [schools, customCircuits]);

  // Open the Broad School Details / Edit Window
  const openSchoolWindow = (school: any, mode: 'view' | 'edit' = 'view') => {
    if (!school) return;
    setDetailSchoolId(school.id);
    setDetailModalMode(mode);
    setMergeTargetId('');
    const a4 = tqo(school).age?.[4] || 0;
    const a5 = tqo(school).age?.[5] || 0;
    setEditDraft({
      name: school.name || '',
      emis: school.emis || '',
      circuit: school.circuit || DEFAULT_CIRCUITS[0],
      type: school.type || 'PUBLIC',
      levels: school.levels || 'KG, PRY & JHS',
      mgmt: school.mgmt || 'MA/DA',
      head: school.head === 'Not assigned' ? '' : school.head || '',
      phone: school.phone || '',
      email: school.email || '',
      rooms: school.rooms || 0,
      nts: school.nts || 0,
      enr: [...(school.enr || [0, 0, 0, 0, 0, 0])],
      tch: [...(school.tch || [0, 0, 0])],
      trn: [...(school.trn || [0, 0, 0])],
      age50_54: tqo(school).age?.[3] || 0,
      age55_59: a4,
      age60Plus: a5,
      retiringTeachers: (school.retiringTeachers || []).map((rt: any) => ({
        name: rt.name || '',
        staffId: rt.staffId || '',
        age: rt.age || 56,
        dob: rt.dob || '',
        retireYear: rt.retireYear || NOW + 4,
        rank: rt.rank || '',
        subject: rt.subject || '',
        phone: rt.phone || '',
      })),
    });
  };

  // Save a patch to a single school in Firestore
  const saveSchoolPatch = async (school: any, patch: Record<string, any>) => {
    setLocalOverrides(prev => ({
      ...prev,
      [school.id]: { ...(prev[school.id] || {}), ...patch },
    }));
    try {
      const updatedName = txt(patch.name || school.name).toUpperCase();
      const updatedCircuit = txt(patch.circuit || school.circuit).toUpperCase();
      const payload = {
        ...patch,
        name: updatedName,
        school: updatedName,
        circuit: updatedCircuit,
        updatedAt: serverTimestamp(),
      };
      if (school.firestoreId) {
        await updateDoc(doc(db, 'schools', school.firestoreId), payload);
      } else {
        await addDoc(collection(db, 'schools'), {
          emis: school.emis,
          type: school.type,
          levels: school.levels,
          head: school.head,
          enr: school.enr,
          cl: school.cl,
          rc: school.rc,
          tch: school.tch,
          trn: school.trn,
          rooms: school.rooms,
          fac: school.fac,
          tb: school.tb,
          ...payload,
        });
      }
    } catch (e) {
      console.error('Error saving school patch:', e);
      showToast('Failed to sync change to cloud');
    }
  };

  // Save full edits from the Broad School Edit Window (and update matching portal submissions if school/circuit changed)
  const handleSaveFullSchoolEdit = async () => {
    if (!detailSchool || !editDraft) return;
    setSavingEdit(true);
    try {
      const cleanName = txt(editDraft.name).toUpperCase() || detailSchool.name;
      const cleanEmis = txt(editDraft.emis).toUpperCase() || detailSchool.emis;
      const cleanCircuit = txt(editDraft.circuit).toUpperCase() || detailSchool.circuit;

      const curTq = tqo(detailSchool);
      const nextAge = [...(curTq.age || [0, 0, 0, 0, 0, 0])];
      nextAge[3] = Math.max(0, num(editDraft.age50_54));
      nextAge[4] = Math.max(0, num(editDraft.age55_59));
      nextAge[5] = Math.max(0, num(editDraft.age60Plus));

      const cleanedRetiring = (editDraft.retiringTeachers || [])
        .filter((r: any) => txt(r.name))
        .map((r: any) => ({
          name: txt(r.name).toUpperCase(),
          staffId: txt(r.staffId),
          age: num(r.age) || 56,
          dob: txt(r.dob),
          retireYear: num(r.retireYear) || (num(r.age) ? NOW + Math.max(0, 60 - num(r.age)) : NOW + 3),
          rank: txt(r.rank).toUpperCase(),
          subject: txt(r.subject).toUpperCase(),
          phone: txt(r.phone),
          source: 'Verified',
        }));

      const patch = {
        name: cleanName,
        school: cleanName,
        emis: cleanEmis,
        code: cleanEmis,
        circuit: cleanCircuit,
        type: txt(editDraft.type).toUpperCase() || 'PUBLIC',
        levels: txt(editDraft.levels).toUpperCase() || 'KG, PRY & JHS',
        mgmt: txt(editDraft.mgmt).toUpperCase() || 'MA/DA',
        head: txt(editDraft.head) || 'Not assigned',
        phone: txt(editDraft.phone),
        email: txt(editDraft.email),
        rooms: Math.max(0, num(editDraft.rooms)),
        nts: Math.max(0, num(editDraft.nts)),
        enr: (editDraft.enr || [0, 0, 0, 0, 0, 0]).map((v: any) => Math.max(0, num(v))),
        tch: (editDraft.tch || [0, 0, 0]).map((v: any) => Math.max(0, num(v))),
        trn: (editDraft.trn || [0, 0, 0]).map((v: any) => Math.max(0, num(v))),
        tq: {
          ...curTq,
          age: nextAge,
          retiringList: cleanedRetiring,
        },
        retiringTeachers: cleanedRetiring,
      };

      await saveSchoolPatch(detailSchool, patch);

      // If school name or circuit changed, also update any linked portal teacher submissions in Firestore
      const linkedSubs = detailSchool.portalTeachers || [];
      if (linkedSubs.length > 0 && (cleanName !== detailSchool.name || cleanCircuit !== detailSchool.circuit)) {
        await Promise.all(
          linkedSubs.map((sub: any) =>
            sub.id
              ? updateDoc(doc(db, 'submissions', sub.id), {
                  school: cleanName,
                  circuit: cleanCircuit,
                }).catch(() => {})
              : Promise.resolve()
          )
        );
      }

      showToast(`Saved updates for ${cleanName}`);
      setDetailModalMode('view');
    } catch (e) {
      console.error('Failed to save full school edit:', e);
      showToast('Error saving school updates');
    } finally {
      setSavingEdit(false);
    }
  };

  // Merge current duplicate school into another school and remove the duplicate
  const handleMergeSchoolIntoTarget = async () => {
    if (!detailSchool || !mergeTargetId) return;
    const targetSchool = schools.find(s => s.id === mergeTargetId);
    if (!targetSchool || targetSchool.id === detailSchool.id) return;

    setSavingEdit(true);
    try {
      // Reassign any portal submissions from detailSchool to targetSchool
      const subsToMove = detailSchool.portalTeachers || [];
      await Promise.all(
        subsToMove.map((sub: any) =>
          sub.id
            ? updateDoc(doc(db, 'submissions', sub.id), {
                school: targetSchool.name,
                circuit: targetSchool.circuit,
              }).catch(() => {})
            : Promise.resolve()
        )
      );

      // Delete duplicate school document if it exists in Firestore
      if (detailSchool.firestoreId) {
        await deleteDoc(doc(db, 'schools', detailSchool.firestoreId));
      }

      showToast(`Merged ${detailSchool.name} into ${targetSchool.name}`);
      setDetailSchoolId(targetSchool.id);
      setDetailModalMode('view');
    } catch (e) {
      console.error('Error merging schools:', e);
      showToast('Failed to merge schools');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete a duplicate school record from Firestore
  const handleDeleteSchoolRecord = async (school: any) => {
    if (!school) return;
    if (!window.confirm(`Are you sure you want to delete school record "${school.name}" (${school.emis})?`)) return;
    setSavingEdit(true);
    try {
      if (school.firestoreId) {
        await deleteDoc(doc(db, 'schools', school.firestoreId));
      }
      setDetailSchoolId('');
      showToast(`Deleted school record: ${school.name}`);
    } catch (e) {
      console.error('Error deleting school:', e);
      showToast('Failed to delete school record');
    } finally {
      setSavingEdit(false);
    }
  };

  // Rename / Merge a circuit across all schools and portal teacher submissions in Firestore
  const handleRenameCircuit = async (oldCircuit: string, newCircuitRaw: string) => {
    const targetCir = txt(newCircuitRaw).toUpperCase();
    if (!targetCir || targetCir === oldCircuit) return;
    setSavingEdit(true);
    try {
      const affectedSchools = schools.filter(s => s.circuit === oldCircuit);
      for (const s of affectedSchools) {
        await saveSchoolPatch(s, { circuit: targetCir });
      }
      const affectedSubs = validSubmissions.filter(
        (sub: any) => canonicalCircuit(sub.circuit) === oldCircuit || txt(sub.circuit).toUpperCase() === oldCircuit
      );
      await Promise.all(
        affectedSubs.map((sub: any) =>
          sub.id ? updateDoc(doc(db, 'submissions', sub.id), { circuit: targetCir }).catch(() => {}) : Promise.resolve()
        )
      );
      if (cirFilter === oldCircuit) setCirFilter(targetCir);
      showToast(`Renamed circuit "${oldCircuit}" → "${targetCir}" (${affectedSchools.length} schools updated)`);
    } catch (e) {
      console.error('Error renaming circuit:', e);
      showToast('Failed to rename circuit');
    } finally {
      setSavingEdit(false);
    }
  };

  // One-click standardize all duplicate circuit spellings in Firestore (`schools` + `submissions`)
  const handleStandardizeAllCircuitsInCloud = async () => {
    setSavingEdit(true);
    try {
      let updatedCount = 0;
      for (const raw of schoolsData) {
        if (!raw.id) continue;
        const std = canonicalCircuit(raw.circuit);
        if (std && std !== txt(raw.circuit).toUpperCase()) {
          await updateDoc(doc(db, 'schools', raw.id), { circuit: std }).catch(() => {});
          updatedCount++;
        }
      }
      for (const sub of validSubmissions) {
        if (!sub.id || !sub.circuit) continue;
        const std = canonicalCircuit(sub.circuit);
        if (std && std !== txt(sub.circuit).toUpperCase()) {
          await updateDoc(doc(db, 'submissions', sub.id), { circuit: std }).catch(() => {});
          updatedCount++;
        }
      }
      showToast(`Standardized ${updatedCount} circuit records in cloud database!`);
    } catch (e) {
      console.error('Error standardizing circuits:', e);
      showToast('Failed to standardize circuits');
    } finally {
      setSavingEdit(false);
    }
  };

  // Register a new school with duplicate check
  const handleRegisterSchool = async () => {
    const n = newName.trim().toUpperCase();
    const c = newCode.trim().toUpperCase();
    if (!n || !c) {
      showToast('Enter both School Name and EMIS Code');
      return;
    }
    const dup = schools.find(s => norm(s.name) === norm(n) || norm(s.emis) === norm(c));
    if (dup) {
      showToast(`Duplicate blocked: ${dup.name} (${dup.emis}) already exists!`);
      return;
    }
    try {
      await addDoc(collection(db, 'schools'), {
        emis: c,
        code: c,
        name: n,
        school: n,
        district: 'TEMA METRO',
        circuit: newCir,
        head: newHead.trim() || 'Not assigned',
        type: newOwn,
        levels: 'KG, PRY & JHS',
        mgmt: 'MA/DA',
        enr: [0, 0, 0, 0, 0, 0],
        cl: Array(22).fill(0),
        rc: Array(11).fill(0),
        tch: [0, 0, 0],
        trn: [0, 0, 0],
        nts: 0,
        rooms: 0,
        createdAt: serverTimestamp(),
      });
      setNewName('');
      setNewCode('');
      setNewHead('');
      setShowRegisterForm(false);
      showToast('School registered successfully');
    } catch (e) {
      console.error(e);
      showToast('Error registering school');
    }
  };

  // Save bulk schools to Firestore with duplicate checking
  const saveBulkSchoolsToFirestore = async (
    incomingSchools: any[],
    mode: 'merge' | 'replace',
    onProgress?: (msg: string) => void
  ) => {
    if (mode === 'replace') {
      onProgress?.('Clearing existing school census data...');
      const delPromises = schoolsData.map((s: any) => deleteDoc(doc(db, 'schools', s.id)));
      await Promise.all(delPromises);
    }

    // Build lookup map of existing Firestore schools by normalized name and EMIS
    const existingByName = new Map<string, any>();
    const existingByEmis = new Map<string, any>();
    if (mode === 'merge') {
      schoolsData.forEach((raw: any) => {
        const k = norm(raw.name || raw.school);
        if (k) existingByName.set(k, raw);
        const eKey = norm(raw.emis || raw.code);
        if (eKey) existingByEmis.set(eKey, raw);
      });
    }

    // Deduplicate within the incoming array itself
    const dedupedMap = new Map<string, any>();
    let inFileDuplicates = 0;
    incomingSchools.forEach(s => {
      const k = norm(s.name || s.school);
      if (!k) return;
      if (dedupedMap.has(k)) {
        inFileDuplicates++;
        dedupedMap.set(k, { ...dedupedMap.get(k), ...s });
      } else {
        dedupedMap.set(k, s);
      }
    });

    const uniqueIncoming = Array.from(dedupedMap.values());
    let addedCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < uniqueIncoming.length; i += 40) {
      const chunk = uniqueIncoming.slice(i, i + 40);
      await Promise.all(
        chunk.map(s => {
          const k = norm(s.name || s.school);
          const eKey = norm(s.emis || s.code);
          const matched = mode === 'merge' ? existingByName.get(k) || (eKey ? existingByEmis.get(eKey) : null) : null;

          const payload = {
            ...s,
            name: txt(s.name || s.school).toUpperCase(),
            school: txt(s.name || s.school).toUpperCase(),
            emis: txt(s.emis || s.code),
            code: txt(s.emis || s.code),
            circuit: txt(s.circuit || 'ASHAMANG').toUpperCase(),
            updatedAt: serverTimestamp(),
          };

          if (matched && matched.id) {
            updatedCount++;
            return updateDoc(doc(db, 'schools', matched.id), payload);
          } else {
            addedCount++;
            return addDoc(collection(db, 'schools'), {
              ...payload,
              createdAt: serverTimestamp(),
            });
          }
        })
      );
      onProgress?.(`Saved ${Math.min(i + 40, uniqueIncoming.length)} of ${uniqueIncoming.length} schools...`);
    }

    return { addedCount, updatedCount, inFileDuplicates };
  };

  // Handle Workbook Import (supports Official 5-Sheet GES Census Workbook + custom Excel/CSV)
  const handleImportWorkbook = async () => {
    if (!file) return;
    setBusy(true);
    setImportMsg('Reading workbook...');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'csv') {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const rows = (parsed.data as any[]).filter(r => r.School || r.name || r['School Name']);
        const mapped = rows.map((r, i) => ({
          emis: txt(r.EMIS || r.code || `TM-${1000 + i}`),
          name: txt(r.School || r.name || r['School Name']).toUpperCase(),
          circuit: txt(r.Circuit || r.circuit || 'ASHAMANG').toUpperCase(),
          type: txt(r.Type || r.Ownership || 'PUBLIC').toUpperCase(),
          head: txt(r['Head teacher'] || r.Head || ''),
          levels: txt(r.Levels || 'KG, PRY & JHS'),
          enr: [
            num(r['KG Boys']),
            num(r['KG Girls']),
            num(r['PRI Boys']),
            num(r['PRI Girls']),
            num(r['JHS Boys']),
            num(r['JHS Girls']),
          ],
          rooms: num(r.Classrooms || 11),
        }));
        const res = await saveBulkSchoolsToFirestore(mapped, importMode, setImportMsg);
        setImportMsg(
          `Imported ${mapped.length} schools (${res.addedCount} new, ${res.updatedCount} existing updated, ${res.inFileDuplicates} duplicate rows merged).`
        );
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });

        // Check if this is the official GES 5-sheet census workbook (has BASIC INFO sheet)
        if (wb.Sheets['BASIC INFO']) {
          const { schools: parsedSchools, stat } = parseOfficialCensusWorkbook(wb);
          if (!parsedSchools.length) {
            throw new Error('No schools found in BASIC INFO sheet. Check this is the census workbook.');
          }
          const res = await saveBulkSchoolsToFirestore(parsedSchools, importMode, setImportMsg);
          setImportMsg(
            `Imported ${parsedSchools.length} schools (${res.addedCount} new, ${res.updatedCount} updated without duplication). Matched by school name: staff lists for ${stat.teachers}, facilities for ${stat.facilities}, textbooks for ${stat.books}.`
          );
        } else {
          // Fallback: flexible multi-sheet or single-sheet Excel workbook
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<any>(firstSheet, { defval: '' });
          const mapped = rows
            .filter(r => r.School || r.name || r['School Name'] || r.EMIS)
            .map((r, i) => ({
              emis: txt(r.EMIS || r.code || `TM-${1000 + i}`),
              name: txt(r.School || r.name || r['School Name']).toUpperCase(),
              circuit: txt(r.Circuit || r.circuit || 'ASHAMANG').toUpperCase(),
              type: txt(r.Type || r.Ownership || 'PUBLIC').toUpperCase(),
              head: txt(r['Head teacher'] || r.Head || ''),
              levels: txt(r.Levels || 'KG, PRY & JHS'),
              enr: [
                num(r['KG Boys'] || r.Boys),
                num(r['KG Girls'] || r.Girls),
                num(r['PRI Boys']),
                num(r['PRI Girls']),
                num(r['JHS Boys']),
                num(r['JHS Girls']),
              ],
              rooms: num(r.Classrooms || 11),
            }));
          if (!mapped.length) {
            throw new Error('No school rows found. Ensure your workbook has BASIC INFO or a School column.');
          }
          const res = await saveBulkSchoolsToFirestore(mapped, importMode, setImportMsg);
          setImportMsg(
            `Imported ${mapped.length} schools (${res.addedCount} new, ${res.updatedCount} updated, ${res.inFileDuplicates} duplicates merged).`
          );
        }
      }
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast('Workbook imported successfully');
    } catch (e: any) {
      setImportMsg('Failed: ' + (e && e.message ? e.message : 'unexpected error'));
    } finally {
      setBusy(false);
    }
  };

  const tabs: [typeof tab, string, any][] = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['schools', 'Schools', School],
    ['enrolment', 'Enrolment', GraduationCap],
    ['staffing', 'Staffing', Users],
    ['facilities', 'Facilities', Building2],
    ['textbooks', 'Textbooks', BookOpen],
    ['reports', 'Reports', FileText],
    ['import', 'Import', Upload],
  ];

  const reps = useMemo(() => buildReports(schools, target), [schools, target]);
  const activeReport = reps.find(x => x.id === reportId) || reps[0];

  const handleDownloadSingleReportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([activeReport.cols, ...activeReport.rows]),
      'Report'
    );
    XLSX.writeFile(wb, 'Tema-Metro-' + activeReport.title.replace(/\s+/g, '-') + '.xlsx');
    showToast(`Downloaded ${activeReport.title}`);
  };

  const handleDownloadAllReportsWorkbook = () => {
    const wb = XLSX.utils.book_new();
    reps.forEach(r => {
      const sheetName = r.title.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([r.cols, ...r.rows]), sheetName);
    });
    XLSX.writeFile(wb, `Tema-Metro-Complete-EDMS-Reports-${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Downloaded all 7 Directorate Reports (.xlsx)');
  };

  const handlePrintReportPdf = () => {
    const esc = (v: any) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      '<html><head><title>' +
        esc(activeReport.title) +
        '</title><style>body{font-family:Arial,sans-serif;padding:16px}h3{margin:0 0 4px;color:#065f46}p{margin:0 0 12px;font-size:12px;color:#555}table{border-collapse:collapse;width:100%;font:11px Arial}th{background:#065f46;color:#fff;text-align:left;padding:5px;border:1px solid #065f46}td{border:1px solid #999;padding:4px}</style></head><body><h3>Tema Metro Education Directorate - ' +
        esc(activeReport.title) +
        '</h3><p>Generated on ' +
        new Date().toLocaleDateString('en-GB') +
        ' · ' +
        activeReport.rows.length +
        ' records</p><table><tr>' +
        activeReport.cols.map((c: string) => '<th>' + esc(c) + '</th>').join('') +
        '</tr>' +
        activeReport.rows
          .map((row: any[]) => '<tr>' + row.map(v => '<td>' + esc(v) + '</td>').join('') + '</tr>')
          .join('') +
        '</table></body></html>'
    );
    w.document.close();
    w.print();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
        color: isDark ? '#f8fafc' : '#0f172a',
        fontFamily: '"Public Sans", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top Header matching tema-metro-edms */}
      <header
        style={{
          backgroundColor: '#065f46',
          padding: '14px 20px',
          color: '#ffffff',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div
          style={{
            maxWidth: '1150px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', opacity: 0.85 }}>
              Ghana Education Service · Tema Metro Education Directorate
            </div>
            <h1 style={{ margin: '2px 0 0', fontSize: '19px', fontWeight: 800 }}>
              Education Directorate Management System (EDMS)
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsDark(d => !d)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
            {onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#ffffff',
                  color: '#065f46',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={14} /> Back to Submissions
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Horizontal Navigation Bar matching tema-metro-edms */}
      <nav
        style={{
          overflowX: 'auto',
          borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: '1150px',
            margin: '0 auto',
            display: 'flex',
          }}
        >
          {tabs.map(([id, label, Icon]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  padding: '12px 14px',
                  fontSize: '13.5px',
                  fontWeight: active ? 700 : 500,
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '2.5px solid #059669' : '2.5px solid transparent',
                  color: active ? (isDark ? '#34d399' : '#065f46') : isDark ? '#cbd5e1' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Container */}
      <main style={{ maxWidth: '1150px', margin: '0 auto', padding: '20px 16px 48px' }}>
        {/* 1. DASHBOARD */}
        {tab === 'dashboard' && (() => {
          const sum2 = (f: (s: any) => number) => sum(schools.map(f));
          const boys = sum2(s => s.enr[0] + s.enr[2] + s.enr[4]);
          const girls = sum2(s => s.enr[1] + s.enr[3] + s.enr[5]);
          const total = boys + girls;
          const tch = sum2(teachers);
          const rooms = sum2(s => s.rooms);
          const circuits = Array.from(new Set(schools.map(s => s.circuit))).sort();

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Kpis
                isDark={isDark}
                schools={schools}
                validSubmissions={validSubmissions}
                target={target}
                onInspectSchool={s => openSchoolWindow(s, 'view')}
                onEditSchool={s => openSchoolWindow(s, 'edit')}
                items={[
                  ['Schools', String(schools.length)],
                  ['Pupils', total.toLocaleString()],
                  ['Teachers', `${tch.toLocaleString()} (${validSubmissions.length} portal)`],
                  ['Gender parity index', boys ? (girls / boys).toFixed(2) : '-'],
                  ['Pupil-teacher ratio', tch ? (total / tch).toFixed(1) : '-'],
                  ['Pupils per classroom', rooms ? (total / rooms).toFixed(1) : '-'],
                  ['Trained teachers', pct(sum2(s => sum(s.trn)), tch) + '%'],
                  ['Non-teaching staff', sum2(s => s.nts).toLocaleString()],
                ]}
              />

              <Card title="By circuit" isDark={isDark}>
                <Tbl
                  isDark={isDark}
                  cols={['Circuit', 'Schools', 'Pupils', 'Teachers', 'PTR']}
                  rows={circuits.map(c => {
                    const g = schools.filter(s => s.circuit === c);
                    const p = sum(g.map(pupils));
                    const t = sum(g.map(teachers));
                    return [c, g.length, p.toLocaleString(), t, t ? (p / t).toFixed(1) : '-'];
                  })}
                />
              </Card>
            </div>
          );
        })()}

        {/* 2. SCHOOLS */}
        {tab === 'schools' && (() => {
          const list = schools.filter(
            s =>
              (cirFilter === 'All' || s.circuit === cirFilter) &&
              (s.name + ' ' + s.emis + ' ' + s.circuit).toUpperCase().includes(q.toUpperCase())
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  style={{
                    flex: 1,
                    minWidth: '240px',
                    borderRadius: '8px',
                    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    padding: '9px 12px',
                    fontSize: '13.5px',
                  }}
                  placeholder="Search by school name, EMIS code or circuit"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                />
                <select
                  value={cirFilter}
                  onChange={e => setCirFilter(e.target.value)}
                  style={{
                    borderRadius: '8px',
                    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    padding: '9px 12px',
                    fontSize: '13.5px',
                  }}
                >
                  {['All', ...allCircuits].map(c => (
                    <option key={c} value={c}>
                      {c === 'All' ? 'All Circuits' : c}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCircuitModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    color: isDark ? '#38bdf8' : '#0369a1',
                    border: `1px solid ${isDark ? '#0284c7' : '#7dd3fc'}`,
                    borderRadius: '8px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Edit3 size={15} /> Manage / Edit Circuits ({allCircuits.length})
                </button>
                <button
                  onClick={() => setShowRegisterForm(v => !v)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#047857',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={15} /> {showRegisterForm ? 'Close Form' : 'Register School'}
                </button>
                <button
                  onClick={() => setTab('import')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: isDark ? '#334155' : '#e2e8f0',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Upload size={15} /> Import Census Workbook (.xlsx)
                </button>
              </div>

              {showRegisterForm && (
                <Card title="Register a new school (Duplicate-Checked)" isDark={isDark}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '10px',
                      marginBottom: '12px',
                    }}
                  >
                    <input
                      placeholder="School Name"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                        color: 'inherit',
                      }}
                    />
                    <input
                      placeholder="EMIS Code (e.g. TM-1500)"
                      value={newCode}
                      onChange={e => setNewCode(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                        color: 'inherit',
                      }}
                    />
                    <select
                      value={newOwn}
                      onChange={e => setNewOwn(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                        color: 'inherit',
                      }}
                    >
                      <option value="PUBLIC">PUBLIC</option>
                      <option value="PRIVATE">PRIVATE</option>
                      <option value="MISSION">MISSION</option>
                    </select>
                    <select
                      value={newCir}
                      onChange={e => setNewCir(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                        color: 'inherit',
                      }}
                    >
                      {allCircuits.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Head teacher name"
                      value={newHead}
                      onChange={e => setNewHead(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                        color: 'inherit',
                      }}
                    />
                  </div>
                  <button
                    onClick={handleRegisterSchool}
                    style={{
                      backgroundColor: '#047857',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Save School
                  </button>
                </Card>
              )}

              <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                Showing {list.length} schools (click <b>View details</b> to open the full broad window or <b>Edit School</b> to correct circuit, school name, enrolment & retiring teachers)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {list.slice(0, 150).map(s => {
                  const key = s.emis + s.name;
                  const retCount = (tqo(s).age?.[4] || 0) + (tqo(s).age?.[5] || 0);
                  return (
                    <div
                      key={s.id || key}
                      style={{
                        borderRadius: '10px',
                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        padding: '12px 16px',
                        fontSize: '13.5px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{ flex: 1, minWidth: '240px', cursor: 'pointer' }}
                        onClick={() => openSchoolWindow(s, 'view')}
                      >
                        <div style={{ fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>{s.name}</span>
                          {retCount > 0 && (
                            <span
                              style={{
                                fontSize: '10.5px',
                                padding: '1px 7px',
                                borderRadius: '99px',
                                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
                                color: isDark ? '#fbbf24' : '#b45309',
                                fontWeight: 700,
                              }}
                            >
                              {retCount} Retiring (55+)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                          {s.emis} · {s.circuit} · {s.type} · {pupils(s)} pupils · {teachers(s)} teachers (
                          {s.portalTeachers?.length || 0} portal submissions) · facilities {score(s)}/8
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openSchoolWindow(s, 'edit')}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '12px',
                            padding: '6px 12px',
                            borderRadius: '99px',
                            border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                            color: isDark ? '#38bdf8' : '#0369a1',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Edit3 size={12} /> Edit School
                        </button>
                        <button
                          type="button"
                          onClick={() => openSchoolWindow(s, 'view')}
                          style={{
                            fontSize: '12px',
                            padding: '6px 14px',
                            borderRadius: '99px',
                            border: 'none',
                            backgroundColor: '#047857',
                            color: '#ffffff',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          View details ↗
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 3. ENROLMENT */}
        {tab === 'enrolment' && (() => {
          const cls = CL.map((c, i) => {
            const b = sum(schools.map(s => (s.cl || [])[2 * i] || 0));
            const g = sum(schools.map(s => (s.cl || [])[2 * i + 1] || 0));
            const r = sum(schools.map(s => (s.rc || [])[i] || 0));
            return { c, b, g, r };
          });
          const types = Array.from(new Set(schools.map(s => s.type || 'UNSPECIFIED'))).sort();
          const top = [...schools].sort((a, b) => pupils(b) - pupils(a)).slice(0, 10);
          const maxP = top.length ? pupils(top[0]) : 1;
          const crowded = schools.filter(s => s.rooms > 0 && pupils(s) / s.rooms > 45).length;
          const totB = sum(cls.map(x => x.b)) || sum(schools.map(s => s.enr[0] + s.enr[2] + s.enr[4]));
          const totG = sum(cls.map(x => x.g)) || sum(schools.map(s => s.enr[1] + s.enr[3] + s.enr[5]));

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Kpis
                isDark={isDark}
                schools={schools}
                validSubmissions={validSubmissions}
                target={target}
                onInspectSchool={s => openSchoolWindow(s, 'view')}
                onEditSchool={s => openSchoolWindow(s, 'edit')}
                items={[
                  ['Boys', totB.toLocaleString()],
                  ['Girls', totG.toLocaleString()],
                  ['Overall GPI', totB ? (totG / totB).toFixed(2) : '-'],
                  ['Schools over 45 pupils/room', String(crowded)],
                ]}
              />

              <Card
                title="Enrolment by class"
                isDark={isDark}
                rightAction={
                  <button
                    onClick={() => setShowInteractiveEditor(v => !v)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#047857',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    <Edit3 size={13} /> {showInteractiveEditor ? 'Hide School Enrolment Editor' : 'Edit School Enrolment'}
                  </button>
                }
              >
                {showInteractiveEditor && activeSchool && (
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                      border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '13px' }}>Edit Enrolment for School:</strong>
                      <select
                        value={activeSchool.id}
                        onChange={e => setSelectedSchoolId(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: isDark ? '#1e293b' : '#fff',
                          color: 'inherit',
                          border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                        }}
                      >
                        {schools.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.circuit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '12.5px' }}>
                      {(['KG', 'Primary', 'JHS'] as const).map((lvLabel, lvIdx) => {
                        const bVal = activeSchool.enr[lvIdx * 2] || 0;
                        const gVal = activeSchool.enr[lvIdx * 2 + 1] || 0;
                        return (
                          <div key={lvLabel} style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                            <div style={{ fontWeight: 700, marginBottom: '6px' }}>{lvLabel}</div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <label>
                                Boys:{' '}
                                <input
                                  type="number"
                                  min={0}
                                  value={bVal}
                                  onChange={e => {
                                    const nextEnr = [...activeSchool.enr];
                                    nextEnr[lvIdx * 2] = Math.max(0, num(e.target.value));
                                    saveSchoolPatch(activeSchool, { enr: nextEnr });
                                  }}
                                  style={{ width: '70px', padding: '4px', borderRadius: '4px', backgroundColor: isDark ? '#1e293b' : '#fff', color: 'inherit', border: '1px solid #64748b' }}
                                />
                              </label>
                              <label>
                                Girls:{' '}
                                <input
                                  type="number"
                                  min={0}
                                  value={gVal}
                                  onChange={e => {
                                    const nextEnr = [...activeSchool.enr];
                                    nextEnr[lvIdx * 2 + 1] = Math.max(0, num(e.target.value));
                                    saveSchoolPatch(activeSchool, { enr: nextEnr });
                                  }}
                                  style={{ width: '70px', padding: '4px', borderRadius: '4px', backgroundColor: isDark ? '#1e293b' : '#fff', color: 'inherit', border: '1px solid #64748b' }}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Tbl
                  isDark={isDark}
                  cols={['Class', 'Boys', 'Girls', 'Total', 'GPI', 'Classrooms', 'Pupils/room']}
                  rows={cls.map(x => [
                    x.c,
                    x.b,
                    x.g,
                    x.b + x.g,
                    x.b ? (x.g / x.b).toFixed(2) : '-',
                    x.r,
                    x.r ? ((x.b + x.g) / x.r).toFixed(1) : '-',
                  ])}
                />
              </Card>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                <Card title="By school type" isDark={isDark}>
                  <Tbl
                    isDark={isDark}
                    cols={['Type', 'Schools', 'Pupils', 'GPI']}
                    rows={types.map(t => {
                      const g = schools.filter(s => (s.type || 'UNSPECIFIED') === t);
                      const b = sum(g.map(s => s.enr[0] + s.enr[2] + s.enr[4]));
                      const gl = sum(g.map(s => s.enr[1] + s.enr[3] + s.enr[5]));
                      return [t, g.length, b + gl, b ? (gl / b).toFixed(2) : '-'];
                    })}
                  />
                </Card>

                <Card title="Ten largest schools" isDark={isDark}>
                  {top.map(s => (
                    <Bar
                      key={s.id || s.emis + s.name}
                      label={s.name}
                      value={pct(pupils(s), maxP)}
                      note={String(pupils(s))}
                      isDark={isDark}
                    />
                  ))}
                </Card>
              </div>
            </div>
          );
        })()}

        {/* 4. STAFFING */}
        {tab === 'staffing' && (() => {
          const T = (f: (s: any) => number) => sum(schools.map(f));
          const dist = (k: string): [string, number][] => {
            const m: Record<string, number> = {};
            schools.forEach(s =>
              Object.entries(tqo(s)[k] || {}).forEach(([a, b]) => {
                m[a] = (m[a] || 0) + (b as number);
              })
            );
            return Object.entries(m)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8);
          };
          const gaps = schools.map(s => ({ s, g: teachers(s) - Math.ceil(pupils(s) / target) }));
          const deficit = -sum(gaps.filter(x => x.g < 0).map(x => x.g));
          const surplus = sum(gaps.filter(x => x.g > 0).map(x => x.g));
          const worst = [...gaps].sort((a, b) => a.g - b.g).slice(0, 12);
          const M = T(s => tqo(s).M);
          const F = T(s => tqo(s).F);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Kpis
                isDark={isDark}
                schools={schools}
                validSubmissions={validSubmissions}
                target={target}
                onInspectSchool={s => openSchoolWindow(s, 'view')}
                onEditSchool={s => openSchoolWindow(s, 'edit')}
                items={[
                  ['Teachers (staff list / portal)', String(T(s => tqo(s).n))],
                  ['Male / Female', M + ' / ' + F],
                  ['Aged 55 and above', String(T(s => tqo(s).age[4] + tqo(s).age[5]))],
                  ['Trained (census / portal)', pct(T(s => sum(s.trn || [])), T(teachers)) + '%'],
                ]}
              />

              <Card title="Teacher deficit / surplus" isDark={isDark}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '12.5px',
                    color: isDark ? '#cbd5e1' : '#475569',
                  }}
                >
                  Target pupil-teacher ratio{' '}
                  <input
                    type="number"
                    min={10}
                    max={80}
                    value={target}
                    onChange={e => setTarget(Math.max(10, num(e.target.value) || 35))}
                    style={{
                      width: '68px',
                      borderRadius: '6px',
                      border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                      padding: '4px 8px',
                      backgroundColor: isDark ? '#0f172a' : '#fff',
                      color: 'inherit',
                      marginLeft: '6px',
                    }}
                  />
                </label>
                <p style={{ margin: '0 0 12px', fontSize: '13.5px' }}>
                  Deficit: <b>{deficit}</b> teachers · Surplus: <b>{surplus}</b> teachers (required = pupils / target,
                  rounded up per school)
                </p>
                <Tbl
                  isDark={isDark}
                  cols={['School', 'Circuit', 'Pupils', 'Teachers', 'Required', 'Gap']}
                  rows={worst.map(x => [
                    x.s.name,
                    x.s.circuit,
                    pupils(x.s),
                    teachers(x.s),
                    Math.ceil(pupils(x.s) / target),
                    x.g,
                  ])}
                />
              </Card>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                <Dist
                  title="Age profile (retirement forecast)"
                  rows={AGE.map((l, i) => [l, T(s => tqo(s).age[i])] as [string, number])}
                  isDark={isDark}
                />
                <Dist
                  title="Years of service"
                  rows={SVC.map((l, i) => [l, T(s => tqo(s).svc[i])] as [string, number])}
                  isDark={isDark}
                />
                <Dist title="Professional qualification" rows={dist('prof')} isDark={isDark} />
                <Dist title="Current rank" rows={dist('rank')} isDark={isDark} />
                <Dist title="First subject taught" rows={dist('sub')} isDark={isDark} />
              </div>
            </div>
          );
        })()}

        {/* 5. FACILITIES */}
        {tab === 'facilities' && (() => {
          const wf = schools.filter(s => s.fac);
          const cov = (k: string) => pct(wf.filter(s => s.fac[k]).length, wf.length);
          const pc = sum(wf.map(s => s.fac.pc || 0));
          const pw = sum(wf.map(pupils));
          const seats = sum(wf.map(s => (s.fac.tM || 0) + (s.fac.tF || 0)));
          const poor = COND.map((c, i) => {
            const v = wf.map(s => (s.fac.cond || [])[i]).filter(x => x && x !== 'N/A');
            return [c, pct(v.filter(x => x === 'POOR').length, v.length)] as [string, number];
          });
          const low = [...wf].sort((a, b) => score(a) - score(b)).slice(0, 10);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Kpis
                isDark={isDark}
                schools={schools}
                validSubmissions={validSubmissions}
                target={target}
                onInspectSchool={s => openSchoolWindow(s, 'view')}
                onEditSchool={s => openSchoolWindow(s, 'edit')}
                items={[
                  ['Schools with facility data', String(wf.length)],
                  ['Computers', String(pc)],
                  ['Pupils per computer', pc ? (pw / pc).toFixed(1) : '-'],
                  ['Pupils per toilet seat', seats ? (pw / seats).toFixed(1) : '-'],
                ]}
              />

              <Card
                title="Interactive school facility checklist & condition updater"
                isDark={isDark}
                rightAction={
                  <button
                    onClick={() => setShowInteractiveEditor(v => !v)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#047857',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle2 size={13} />{' '}
                    {showInteractiveEditor ? 'Hide Checklist Editor' : 'Tick / Update School Facilities'}
                  </button>
                }
              >
                {showInteractiveEditor && activeSchool ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '13px' }}>Select School:</strong>
                      <select
                        value={activeSchool.id}
                        onChange={e => setSelectedSchoolId(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: isDark ? '#0f172a' : '#fff',
                          color: 'inherit',
                          border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                        }}
                      >
                        {schools.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.circuit})
                          </option>
                        ))}
                      </select>
                      <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>
                        Core Score: {score(activeSchool)}/8
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
                        gap: '8px',
                        fontSize: '12.5px',
                      }}
                    >
                      {[...FAC, ...FAC2].map(([k, l]) => {
                        const checked = Boolean(activeSchool.fac && activeSchool.fac[k]);
                        return (
                          <label
                            key={k}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                const nextFac = { ...(activeSchool.fac || {}), [k]: e.target.checked };
                                saveSchoolPatch(activeSchool, { fac: nextFac });
                              }}
                            />
                            {l}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12.5px', color: isDark ? '#94a3b8' : '#64748b' }}>
                    Click "Tick / Update School Facilities" to interactively update any school's facilities in real time.
                  </div>
                )}
              </Card>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                <Card title="Core facilities coverage" isDark={isDark}>
                  {FAC.map(([k, l]) => (
                    <Bar key={k} label={l} value={cov(k)} isDark={isDark} />
                  ))}
                </Card>
                <Card title="Other facilities coverage" isDark={isDark}>
                  {FAC2.map(([k, l]) => (
                    <Bar key={k} label={l} value={cov(k)} isDark={isDark} />
                  ))}
                </Card>
                <Card title="Classroom elements in poor condition" isDark={isDark}>
                  {poor.map(([l, v]) => (
                    <Bar key={l} label={l} value={v} isDark={isDark} />
                  ))}
                </Card>
                <Card title="Weakest facility scores (out of 8)" isDark={isDark}>
                  {low.map(s => (
                    <Bar
                      key={s.id || s.emis + s.name}
                      label={s.name}
                      value={(score(s) / 8) * 100}
                      note={score(s) + '/8'}
                      isDark={isDark}
                    />
                  ))}
                </Card>
              </div>

              <Card title="Schools without sanitation or water" isDark={isDark}>
                <p style={{ margin: 0, fontSize: '13.5px' }}>
                  No toilets: <b>{wf.filter(s => !s.fac.toilet).length}</b> · No drinking water:{' '}
                  <b>{wf.filter(s => !s.fac.water).length}</b> · No electricity:{' '}
                  <b>{wf.filter(s => !s.fac.elec).length}</b>
                </p>
              </Card>
            </div>
          );
        })()}

        {/* 6. TEXTBOOKS */}
        {tab === 'textbooks' && (() => {
          const wb = schools.filter(s => s.tb);
          const rows = TB.map((t, i) => {
            const c = (st: string) => wb.filter(s => s.tb?.[i] === st).length;
            const short = wb.filter(s => s.tb?.[i] === 'INADEQUATE' || s.tb?.[i] === 'NOT AVAILABLE');
            return [
              t,
              c('ADEQUATE'),
              c('INADEQUATE'),
              c('NOT AVAILABLE'),
              pct(c('ADEQUATE'), wb.length) + '%',
              sum(short.map(pupils)).toLocaleString(),
            ];
          });
          const wr = schools.filter(s => s.rec && s.rec[1]);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Kpis
                isDark={isDark}
                schools={schools}
                validSubmissions={validSubmissions}
                target={target}
                onInspectSchool={s => openSchoolWindow(s, 'view')}
                onEditSchool={s => openSchoolWindow(s, 'edit')}
                items={[
                  ['Schools with textbook data', String(wb.length)],
                  [
                    'Record-keeping compliance',
                    pct(sum(wr.map(s => s.rec[0])), sum(wr.map(s => s.rec[1]))) + '%',
                  ],
                ]}
              />

              <Card title="Textbook availability by subject" isDark={isDark}>
                <Tbl
                  isDark={isDark}
                  cols={[
                    'Subject',
                    'Adequate',
                    'Inadequate',
                    'Not available',
                    '% adequate',
                    'Pupils in shortage schools',
                  ]}
                  rows={rows}
                />
              </Card>

              <Card title="Ghanaian language and creative subjects" isDark={isDark}>
                <Tbl
                  isDark={isDark}
                  cols={['Subject', 'Schools teaching', 'Teacher available']}
                  rows={LANG.map((l, i) => [
                    l,
                    sum(schools.map(s => (s.lang || [])[2 * i] || 0)),
                    sum(schools.map(s => (s.lang || [])[2 * i + 1] || 0)),
                  ])}
                />
              </Card>
            </div>
          );
        })()}

        {/* 7. REPORTS (7 Official Directorate Reports + Excel & PDF Export) */}
        {tab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {reps.map(x => {
                const active = x.id === activeReport.id;
                return (
                  <button
                    key={x.id}
                    onClick={() => setReportId(x.id)}
                    style={{
                      borderRadius: '6px',
                      border: `1px solid ${active ? '#047857' : isDark ? '#475569' : '#cbd5e1'}`,
                      backgroundColor: active ? '#047857' : 'transparent',
                      color: active ? '#ffffff' : isDark ? '#e2e8f0' : '#334155',
                      padding: '6px 12px',
                      fontSize: '12.5px',
                      fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {x.title}
                  </button>
                );
              })}
            </div>

            <Card title={`${activeReport.title} (${activeReport.rows.length} rows)`} isDark={isDark}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                <button
                  onClick={handleDownloadSingleReportExcel}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '6px',
                    backgroundColor: '#047857',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Download size={14} /> Download Excel ({activeReport.title})
                </button>
                <button
                  onClick={handleDownloadAllReportsWorkbook}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '6px',
                    backgroundColor: '#0f766e',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Download size={14} /> Download All 7 Reports (.xlsx)
                </button>
                <button
                  onClick={handlePrintReportPdf}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '6px',
                    border: `1px solid ${isDark ? '#475569' : '#94a3b8'}`,
                    backgroundColor: 'transparent',
                    color: isDark ? '#e2e8f0' : '#334155',
                    padding: '7px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Printer size={14} /> Print / Save as PDF
                </button>
              </div>

              <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
                <Tbl isDark={isDark} cols={activeReport.cols} rows={activeReport.rows.slice(0, 200)} />
              </div>
              {activeReport.rows.length > 200 && (
                <p style={{ marginTop: '8px', fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                  Preview shows 200 rows; downloads include all {activeReport.rows.length} rows.
                </p>
              )}
            </Card>
          </div>
        )}

        {/* 8. IMPORT (Matches uploaded screenshot + Duplicate Prevention) */}
        {tab === 'import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Card title="Import census workbook (.xlsx)" isDark={isDark}>
              <p
                style={{
                  margin: '0 0 12px',
                  fontSize: '12.5px',
                  color: isDark ? '#94a3b8' : '#64748b',
                }}
              >
                Reads Basic Info, Enrolment, Teaching Staff, Facilities and Books Records. Includes automatic duplicate
                checking by School Name and EMIS code to avoid data redundancy.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                  style={{ fontSize: '13.5px', color: isDark ? '#e2e8f0' : '#1e293b' }}
                />

                <label style={{ fontSize: '12.5px', color: isDark ? '#cbd5e1' : '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Import mode:
                  <select
                    value={importMode}
                    onChange={e => setImportMode(e.target.value as 'merge' | 'replace')}
                    style={{
                      padding: '5px 8px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? '#0f172a' : '#fff',
                      color: 'inherit',
                      border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                    }}
                  >
                    <option value="merge">Smart Merge & Skip Duplicates (Recommended)</option>
                    <option value="replace">Replace All Existing Census Data</option>
                  </select>
                </label>
              </div>

              <button
                disabled={!file || busy}
                onClick={handleImportWorkbook}
                style={{
                  borderRadius: '6px',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 16px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: !file || busy ? 'not-allowed' : 'pointer',
                  opacity: !file || busy ? 0.45 : 1,
                }}
              >
                {busy ? 'Importing workbook...' : 'Import workbook'}
              </button>
            </Card>

            <Card title="Other data actions" isDark={isDark}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const res = await saveBulkSchoolsToFirestore(SAMPLE, 'merge', setImportMsg);
                      setImportMsg(
                        `Sample schools loaded (${res.addedCount} added, ${res.updatedCount} updated without duplicates).`
                      );
                    } catch (e: any) {
                      setImportMsg('Failed: ' + (e?.message || 'error'));
                    }
                    setBusy(false);
                  }}
                  style={{
                    borderRadius: '6px',
                    border: `1px solid ${isDark ? '#475569' : '#94a3b8'}`,
                    backgroundColor: 'transparent',
                    color: isDark ? '#e2e8f0' : '#334155',
                    padding: '8px 14px',
                    fontSize: '13.5px',
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  Load sample data
                </button>

                {!confirmClear ? (
                  <button
                    disabled={busy}
                    onClick={() => setConfirmClear(true)}
                    style={{
                      borderRadius: '6px',
                      border: '1px solid #ef4444',
                      backgroundColor: 'transparent',
                      color: '#ef4444',
                      padding: '8px 14px',
                      fontSize: '13.5px',
                      cursor: busy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Clear all census school data
                  </button>
                ) : (
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setConfirmClear(false);
                      setBusy(true);
                      try {
                        await Promise.all(schoolsData.map((s: any) => deleteDoc(doc(db, 'schools', s.id))));
                        setImportMsg('All school census records cleared.');
                      } catch (e: any) {
                        setImportMsg('Failed: ' + (e?.message || 'error'));
                      }
                      setBusy(false);
                    }}
                    style={{
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      padding: '8px 14px',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      cursor: busy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Confirm clear all
                  </button>
                )}
              </div>
            </Card>

            {importMsg && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                  fontSize: '13.5px',
                }}
              >
                {importMsg}
              </div>
            )}
          </div>
        )}
      </main>

      {/* BROAD SCHOOL DETAILS & FULL EDIT WINDOW MODAL */}
      {detailSchool && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9990,
            backgroundColor: 'rgba(2, 6, 23, 0.76)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setDetailSchoolId('');
          }}
        >
          <div
            style={{
              width: '96vw',
              maxWidth: '1140px',
              maxHeight: '92vh',
              borderRadius: '14px',
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.55)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              color: isDark ? '#f8fafc' : '#0f172a',
            }}
          >
            {/* Broad Window Header */}
            <div
              style={{
                padding: '16px 22px',
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '14px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '99px',
                      backgroundColor: '#047857',
                      color: '#ffffff',
                    }}
                  >
                    {detailSchool.emis}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '99px',
                      backgroundColor: isDark ? '#334155' : '#e2e8f0',
                      color: isDark ? '#38bdf8' : '#0369a1',
                    }}
                  >
                    Circuit: {detailSchool.circuit}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '99px',
                      backgroundColor: isDark ? '#334155' : '#f1f5f9',
                      color: isDark ? '#cbd5e1' : '#475569',
                    }}
                  >
                    {detailSchool.type} · {detailSchool.levels}
                  </span>
                </div>
                <h2 style={{ margin: '6px 0 2px', fontSize: '20px', fontWeight: 800 }}>
                  {detailSchool.name}
                </h2>
                <div style={{ fontSize: '12.5px', color: isDark ? '#94a3b8' : '#64748b' }}>
                  Head Teacher: <b>{detailSchool.head || 'Not assigned'}</b> · Phone: <b>{detailSchool.phone || '-'}</b> ·
                  Email: <b>{detailSchool.email || '-'}</b> · Mgmt Unit: <b>{detailSchool.mgmt || 'MA/DA'}</b>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setDetailModalMode('view')}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${detailModalMode === 'view' ? '#047857' : isDark ? '#475569' : '#cbd5e1'}`,
                    backgroundColor: detailModalMode === 'view' ? '#047857' : 'transparent',
                    color: detailModalMode === 'view' ? '#fff' : isDark ? '#e2e8f0' : '#334155',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Full School & Staff Dossier
                </button>
                <button
                  type="button"
                  onClick={() => openSchoolWindow(detailSchool, 'edit')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${detailModalMode === 'edit' ? '#0284c7' : isDark ? '#475569' : '#cbd5e1'}`,
                    backgroundColor: detailModalMode === 'edit' ? '#0284c7' : 'transparent',
                    color: detailModalMode === 'edit' ? '#fff' : isDark ? '#38bdf8' : '#0369a1',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Edit3 size={13} /> Edit School, Circuit & Retiring Staff
                </button>
                <button
                  type="button"
                  onClick={() => setDetailSchoolId('')}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                    backgroundColor: isDark ? '#0f172a' : '#fff',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Close ✕
                </button>
              </div>
            </div>

            {/* Broad Window Body */}
            <div style={{ padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {detailModalMode === 'view' ? (
                <>
                  {/* Top Summary Metrics Row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {[
                      ['Total Pupils', pupils(detailSchool).toLocaleString(), `B: ${detailSchool.enr[0] + detailSchool.enr[2] + detailSchool.enr[4]} / G: ${detailSchool.enr[1] + detailSchool.enr[3] + detailSchool.enr[5]}`],
                      ['Teaching Staff', String(teachers(detailSchool)), `M: ${tqo(detailSchool).M} / F: ${tqo(detailSchool).F} (${detailSchool.portalTeachers?.length || 0} portal)`],
                      ['Trained Teachers', `${sum(detailSchool.trn || [])} (${pct(sum(detailSchool.trn || []), teachers(detailSchool))}%)`, `Non-teaching: ${detailSchool.nts || 0}`],
                      ['Pupil-Teacher Ratio', ptr(detailSchool) ? ptr(detailSchool).toFixed(1) + ':1' : '-', `Target PTR: ${target}:1`],
                      ['Classrooms', String(detailSchool.rooms || 0), detailSchool.rooms ? `${(pupils(detailSchool) / detailSchool.rooms).toFixed(1)} pupils/room` : '-'],
                      ['Retiring (Aged 55+)', String((tqo(detailSchool).age?.[4] || 0) + (tqo(detailSchool).age?.[5] || 0)), `55-59: ${tqo(detailSchool).age?.[4] || 0} · 60+: ${tqo(detailSchool).age?.[5] || 0}`],
                      ['Facilities Score', `${score(detailSchool)} / 8`, missing(detailSchool) === 'none' ? 'All core present' : `Missing: ${missing(detailSchool)}`],
                    ].map(([lbl, val, sub], idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        }}
                      >
                        <div style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b' }}>{lbl}</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, margin: '3px 0' }}>{val}</div>
                        <div style={{ fontSize: '11px', color: isDark ? '#cbd5e1' : '#475569' }}>{sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Highlighted Retiring Teachers Section (Aged 55 & Above) */}
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb',
                      border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: isDark ? '#fbbf24' : '#b45309' }}>
                          Teachers Going on Retirement (Aged 55 & Above) — {detailSchool.name}
                        </h3>
                        <div style={{ fontSize: '12px', color: isDark ? '#cbd5e1' : '#78350f', marginTop: '2px' }}>
                          Aged 55–59: <b>{tqo(detailSchool).age?.[4] || 0}</b> · Aged 60+: <b>{tqo(detailSchool).age?.[5] || 0}</b> · Near-retirement (50–54): <b>{tqo(detailSchool).age?.[3] || 0}</b>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openSchoolWindow(detailSchool, 'edit')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${isDark ? '#f59e0b' : '#d97706'}`,
                          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                          color: isDark ? '#fbbf24' : '#92400e',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        + Add / Edit Retiring Teacher Names
                      </button>
                    </div>

                    {detailSchool.retiringTeachers && detailSchool.retiringTeachers.length > 0 ? (
                      <Tbl
                        isDark={isDark}
                        cols={['Full Name', 'Staff ID', 'Sex', 'Age', 'DOB', 'Retirement Year', 'Rank', 'Subject / Qualification', 'Phone']}
                        rows={detailSchool.retiringTeachers.map((rt: any) => [
                          rt.name || '-',
                          rt.staffId || '-',
                          rt.sex || '-',
                          rt.age ? `${rt.age} yrs` : '55+ yrs',
                          rt.dob || '-',
                          rt.retireYear || '-',
                          rt.rank || '-',
                          rt.subject || rt.prof || '-',
                          rt.phone || '-',
                        ])}
                      />
                    ) : (
                      <div style={{ fontSize: '12.5px', color: isDark ? '#cbd5e1' : '#78350f' }}>
                        {(tqo(detailSchool).age?.[4] || 0) + (tqo(detailSchool).age?.[5] || 0) > 0
                          ? `This school has ${(tqo(detailSchool).age?.[4] || 0) + (tqo(detailSchool).age?.[5] || 0)} teacher(s) aged 55+ recorded in the census count. Click "+ Add / Edit Retiring Teacher Names" above to attach or verify their individual names.`
                          : 'No teachers aged 55 and above currently recorded for this school.'}
                      </div>
                    )}
                  </div>

                  {/* Enrolment & Staffing Breakdown by Level (KG / Primary / JHS) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '14px' }}>
                    <Card title="Enrolment & Teachers by Level" isDark={isDark}>
                      <Tbl
                        isDark={isDark}
                        cols={['Level', 'Boys', 'Girls', 'Total Pupils', 'Teachers', 'Trained']}
                        rows={[
                          [
                            'Kindergarten (KG)',
                            detailSchool.enr[0] || 0,
                            detailSchool.enr[1] || 0,
                            (detailSchool.enr[0] || 0) + (detailSchool.enr[1] || 0),
                            detailSchool.tch?.[0] || 0,
                            detailSchool.trn?.[0] || 0,
                          ],
                          [
                            'Primary (P1–P6)',
                            detailSchool.enr[2] || 0,
                            detailSchool.enr[3] || 0,
                            (detailSchool.enr[2] || 0) + (detailSchool.enr[3] || 0),
                            detailSchool.tch?.[1] || 0,
                            detailSchool.trn?.[1] || 0,
                          ],
                          [
                            'JHS (JHS1–JHS3)',
                            detailSchool.enr[4] || 0,
                            detailSchool.enr[5] || 0,
                            (detailSchool.enr[4] || 0) + (detailSchool.enr[5] || 0),
                            detailSchool.tch?.[2] || 0,
                            detailSchool.trn?.[2] || 0,
                          ],
                        ]}
                      />
                    </Card>

                    <Card title="Facilities & Textbooks Status" isDark={isDark}>
                      <div style={{ fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <b>Present Core Facilities ({score(detailSchool)}/8):</b>{' '}
                          {detailSchool.fac
                            ? FAC.filter(([k]) => detailSchool.fac[k]).map(([, l]) => l).join(', ') || 'None'
                            : 'No facility record'}
                        </div>
                        <div>
                          <b>Missing Core Facilities:</b> {missing(detailSchool)}
                        </div>
                        <div>
                          <b>Computers:</b> {detailSchool.fac?.pc || 0} · <b>Boys Toilet Seats:</b> {detailSchool.fac?.tM || 0} ·{' '}
                          <b>Girls Toilet Seats:</b> {detailSchool.fac?.tF || 0}
                        </div>
                        <div>
                          <b>Textbooks Status:</b>{' '}
                          {detailSchool.tb
                            ? TB.map((subj, idx) => `${subj}: ${detailSchool.tb?.[idx] || '-'}`).join(' · ')
                            : 'No textbook record'}
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Full Staff Roster (Portal Submissions + Census Staff Sheet) */}
                  <Card
                    title={`Complete School Staff Roster (${detailSchool.allStaffRoster?.length || 0} named teachers)`}
                    isDark={isDark}
                  >
                    {detailSchool.allStaffRoster && detailSchool.allStaffRoster.length > 0 ? (
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <Tbl
                          isDark={isDark}
                          cols={['Name', 'Staff ID', 'Sex', 'Age', 'Retire Yr', 'Rank', 'Qualification', 'Subject', 'Phone', 'Source']}
                          rows={detailSchool.allStaffRoster.map((st: any) => [
                            st.name || '-',
                            st.staffId || '-',
                            st.sex || '-',
                            st.age || '-',
                            st.retireYear || '-',
                            st.rank || '-',
                            st.prof || '-',
                            st.subject || '-',
                            st.phone || '-',
                            st.source || 'Census',
                          ])}
                        />
                      </div>
                    ) : (
                      <div style={{ fontSize: '12.5px', color: isDark ? '#94a3b8' : '#64748b' }}>
                        No individual teacher names mapped yet. Import the Teaching Staff sheet or click "Edit School, Circuit & Retiring Staff" to add staff details.
                      </div>
                    )}
                  </Card>
                </>
              ) : (
                /* EDIT SCHOOL, CIRCUIT, ENROLMENT, RETIRING STAFF & MERGE FORM */
                editDraft && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {/* 1. Core School & Circuit Information */}
                    <Card title="1. Correct School Name, EMIS Code, Circuit & Administration Details" isDark={isDark}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: '12px',
                          fontSize: '12.5px',
                        }}
                      >
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <b>School Name</b>
                          <input
                            value={editDraft.name}
                            onChange={e => setEditDraft({ ...editDraft, name: e.target.value })}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              color: 'inherit',
                            }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <b>EMIS Code</b>
                          <input
                            value={editDraft.emis}
                            onChange={e => setEditDraft({ ...editDraft, emis: e.target.value })}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              color: 'inherit',
                            }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <b>Circuit (Select or Type Custom below)</b>
                          <select
                            value={editDraft.circuit}
                            onChange={e => setEditDraft({ ...editDraft, circuit: e.target.value })}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              color: 'inherit',
                            }}
                          >
                            {allCircuits.map(c => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <b>Or Enter Custom / Corrected Circuit Name</b>
                          <input
                            value={editDraft.circuit}
                            onChange={e => setEditDraft({ ...editDraft, circuit: e.target.value.toUpperCase() })}
                            placeholder="e.g. ASHAMANG"
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              color: 'inherit',
                            }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <b>Ownership Type</b>
                          <select
                            value={editDraft.type}
                            onChange={e => setEditDraft({ ...editDraft, type: e.target.value })}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              color: 'inherit',
                            }}
                          >
                            <option value="PUBLIC">PUBLIC</option>
                            <option value="PRIVATE">PRIVATE</option>
                            <option value="MISSION">MISSION</option>
                          </select>
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <b>School Levels</b>
                          <input
                            value={editDraft.levels}
                            onChange={e => setEditDraft({ ...editDraft, levels: e.target.value })}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              color: 'inherit',
                            }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <b>Management Unit</b>
                          <input
                            value={editDraft.mgmt}
                            onChange={e => setEditDraft({ ...editDraft, mgmt: e.target.value })}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              color: 'inherit',
                            }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <b>Head Teacher Name</b>
                          <input
                            value={editDraft.head}
                            onChange={e => setEditDraft({ ...editDraft, head: e.target.value })}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              color: 'inherit',
                            }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <b>Phone Number</b>
                          <input
                            value={editDraft.phone}
                            onChange={e => setEditDraft({ ...editDraft, phone: e.target.value })}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              color: 'inherit',
                            }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <b>Email Address</b>
                          <input
                            value={editDraft.email}
                            onChange={e => setEditDraft({ ...editDraft, email: e.target.value })}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              color: 'inherit',
                            }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <b>Total Classrooms</b>
                          <input
                            type="number"
                            min={0}
                            value={editDraft.rooms}
                            onChange={e => setEditDraft({ ...editDraft, rooms: num(e.target.value) })}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              color: 'inherit',
                            }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <b>Non-Teaching Staff</b>
                          <input
                            type="number"
                            min={0}
                            value={editDraft.nts}
                            onChange={e => setEditDraft({ ...editDraft, nts: num(e.target.value) })}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              color: 'inherit',
                            }}
                          />
                        </label>
                      </div>
                    </Card>

                    {/* 2. Enrolment & Staffing Numbers */}
                    <Card title="2. Enrolment, Teachers & Retirement Age Counts" isDark={isDark}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', fontSize: '12.5px' }}>
                        {(['KG', 'Primary', 'JHS'] as const).map((lv, idx) => (
                          <div
                            key={lv}
                            style={{
                              padding: '10px',
                              borderRadius: '8px',
                              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            }}
                          >
                            <div style={{ fontWeight: 800, marginBottom: '8px', color: '#10b981' }}>{lv} Level</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <label>
                                Boys
                                <input
                                  type="number"
                                  min={0}
                                  value={editDraft.enr[idx * 2] || 0}
                                  onChange={e => {
                                    const next = [...editDraft.enr];
                                    next[idx * 2] = num(e.target.value);
                                    setEditDraft({ ...editDraft, enr: next });
                                  }}
                                  style={{ width: '100%', padding: '5px', borderRadius: '4px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b' }}
                                />
                              </label>
                              <label>
                                Girls
                                <input
                                  type="number"
                                  min={0}
                                  value={editDraft.enr[idx * 2 + 1] || 0}
                                  onChange={e => {
                                    const next = [...editDraft.enr];
                                    next[idx * 2 + 1] = num(e.target.value);
                                    setEditDraft({ ...editDraft, enr: next });
                                  }}
                                  style={{ width: '100%', padding: '5px', borderRadius: '4px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b' }}
                                />
                              </label>
                              <label>
                                Total Teachers
                                <input
                                  type="number"
                                  min={0}
                                  value={editDraft.tch[idx] || 0}
                                  onChange={e => {
                                    const next = [...editDraft.tch];
                                    next[idx] = num(e.target.value);
                                    setEditDraft({ ...editDraft, tch: next });
                                  }}
                                  style={{ width: '100%', padding: '5px', borderRadius: '4px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b' }}
                                />
                              </label>
                              <label>
                                Trained Teachers
                                <input
                                  type="number"
                                  min={0}
                                  value={editDraft.trn[idx] || 0}
                                  onChange={e => {
                                    const next = [...editDraft.trn];
                                    next[idx] = num(e.target.value);
                                    setEditDraft({ ...editDraft, trn: next });
                                  }}
                                  style={{ width: '100%', padding: '5px', borderRadius: '4px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b' }}
                                />
                              </label>
                            </div>
                          </div>
                        ))}

                        <div
                          style={{
                            padding: '10px',
                            borderRadius: '8px',
                            border: `1px solid ${isDark ? '#f59e0b' : '#fde68a'}`,
                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.06)' : '#fffbeb',
                          }}
                        >
                          <div style={{ fontWeight: 800, marginBottom: '8px', color: isDark ? '#fbbf24' : '#b45309' }}>
                            Retirement Cohort Counts
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            <label>
                              Aged 50–54
                              <input
                                type="number"
                                min={0}
                                value={editDraft.age50_54}
                                onChange={e => setEditDraft({ ...editDraft, age50_54: num(e.target.value) })}
                                style={{ width: '100%', padding: '5px', borderRadius: '4px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b' }}
                              />
                            </label>
                            <label>
                              Aged 55–59
                              <input
                                type="number"
                                min={0}
                                value={editDraft.age55_59}
                                onChange={e => setEditDraft({ ...editDraft, age55_59: num(e.target.value) })}
                                style={{ width: '100%', padding: '5px', borderRadius: '4px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b' }}
                              />
                            </label>
                            <label>
                              Aged 60+
                              <input
                                type="number"
                                min={0}
                                value={editDraft.age60Plus}
                                onChange={e => setEditDraft({ ...editDraft, age60Plus: num(e.target.value) })}
                                style={{ width: '100%', padding: '5px', borderRadius: '4px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b' }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </Card>

                    {/* 3. Retiring Teachers (55+) Individual Names Editor */}
                    <Card
                      title="3. Names & Details of Teachers Going on Retirement (Aged 55+)"
                      isDark={isDark}
                      rightAction={
                        <button
                          type="button"
                          onClick={() =>
                            setEditDraft({
                              ...editDraft,
                              retiringTeachers: [
                                ...(editDraft.retiringTeachers || []),
                                {
                                  name: '',
                                  staffId: '',
                                  age: 57,
                                  dob: '',
                                  retireYear: NOW + 3,
                                  rank: 'PRINCIPAL SUPT.',
                                  subject: '',
                                  phone: '',
                                },
                              ],
                            })
                          }
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#d97706',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          + Add Retiring Teacher
                        </button>
                      }
                    >
                      {(editDraft.retiringTeachers || []).length === 0 ? (
                        <div style={{ fontSize: '12.5px', color: isDark ? '#94a3b8' : '#64748b' }}>
                          Click "+ Add Retiring Teacher" to record the full name, Staff ID, age, retirement year, rank, and phone of any teacher retiring from this school.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {(editDraft.retiringTeachers || []).map((rt: any, rIdx: number) => (
                            <div
                              key={rIdx}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1.1fr 0.7fr 1.1fr 0.9fr 1.3fr 1.2fr auto',
                                gap: '6px',
                                alignItems: 'center',
                              }}
                            >
                              <input
                                placeholder="Full Name"
                                value={rt.name}
                                onChange={e => {
                                  const next = [...editDraft.retiringTeachers];
                                  next[rIdx] = { ...next[rIdx], name: e.target.value };
                                  setEditDraft({ ...editDraft, retiringTeachers: next });
                                }}
                                style={{ padding: '6px 8px', borderRadius: '5px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b', fontSize: '12px' }}
                              />
                              <input
                                placeholder="Staff ID"
                                value={rt.staffId}
                                onChange={e => {
                                  const next = [...editDraft.retiringTeachers];
                                  next[rIdx] = { ...next[rIdx], staffId: e.target.value };
                                  setEditDraft({ ...editDraft, retiringTeachers: next });
                                }}
                                style={{ padding: '6px 8px', borderRadius: '5px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b', fontSize: '12px' }}
                              />
                              <input
                                type="number"
                                placeholder="Age"
                                value={rt.age}
                                onChange={e => {
                                  const next = [...editDraft.retiringTeachers];
                                  const aVal = num(e.target.value);
                                  next[rIdx] = { ...next[rIdx], age: aVal, retireYear: aVal ? NOW + Math.max(0, 60 - aVal) : rt.retireYear };
                                  setEditDraft({ ...editDraft, retiringTeachers: next });
                                }}
                                style={{ padding: '6px 8px', borderRadius: '5px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b', fontSize: '12px', width: '100%' }}
                              />
                              <input
                                placeholder="DOB (DD/MM/YYYY)"
                                value={rt.dob}
                                onChange={e => {
                                  const next = [...editDraft.retiringTeachers];
                                  next[rIdx] = { ...next[rIdx], dob: e.target.value };
                                  setEditDraft({ ...editDraft, retiringTeachers: next });
                                }}
                                style={{ padding: '6px 8px', borderRadius: '5px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b', fontSize: '12px' }}
                              />
                              <input
                                type="number"
                                placeholder="Retire Yr"
                                value={rt.retireYear}
                                onChange={e => {
                                  const next = [...editDraft.retiringTeachers];
                                  next[rIdx] = { ...next[rIdx], retireYear: num(e.target.value) };
                                  setEditDraft({ ...editDraft, retiringTeachers: next });
                                }}
                                style={{ padding: '6px 8px', borderRadius: '5px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b', fontSize: '12px', width: '100%' }}
                              />
                              <input
                                placeholder="Rank"
                                value={rt.rank}
                                onChange={e => {
                                  const next = [...editDraft.retiringTeachers];
                                  next[rIdx] = { ...next[rIdx], rank: e.target.value };
                                  setEditDraft({ ...editDraft, retiringTeachers: next });
                                }}
                                style={{ padding: '6px 8px', borderRadius: '5px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b', fontSize: '12px' }}
                              />
                              <input
                                placeholder="Subject / Phone"
                                value={rt.subject || rt.phone}
                                onChange={e => {
                                  const next = [...editDraft.retiringTeachers];
                                  next[rIdx] = { ...next[rIdx], subject: e.target.value };
                                  setEditDraft({ ...editDraft, retiringTeachers: next });
                                }}
                                style={{ padding: '6px 8px', borderRadius: '5px', backgroundColor: isDark ? '#0f172a' : '#fff', color: 'inherit', border: '1px solid #64748b', fontSize: '12px' }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const next = editDraft.retiringTeachers.filter((_: any, i: number) => i !== rIdx);
                                  setEditDraft({ ...editDraft, retiringTeachers: next });
                                }}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '5px',
                                  border: '1px solid #ef4444',
                                  backgroundColor: 'transparent',
                                  color: '#ef4444',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    {/* 4. Merge Duplicate School or Delete Record */}
                    <Card title="4. Merge Duplicate School or Remove Record" isDark={isDark}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', flex: 1 }}>
                          <span style={{ fontSize: '12.5px' }}>Merge this school & its portal teachers into:</span>
                          <select
                            value={mergeTargetId}
                            onChange={e => setMergeTargetId(e.target.value)}
                            style={{
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              color: 'inherit',
                              fontSize: '12.5px',
                              minWidth: '260px',
                            }}
                          >
                            <option value="">-- Select target school to merge into --</option>
                            {schools
                              .filter(x => x.id !== detailSchool.id)
                              .map(x => (
                                <option key={x.id} value={x.id}>
                                  {x.name} ({x.emis} · {x.circuit})
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            disabled={!mergeTargetId || savingEdit}
                            onClick={handleMergeSchoolIntoTarget}
                            style={{
                              padding: '7px 14px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: '#0284c7',
                              color: '#fff',
                              fontSize: '12.5px',
                              fontWeight: 700,
                              cursor: !mergeTargetId || savingEdit ? 'not-allowed' : 'pointer',
                              opacity: !mergeTargetId || savingEdit ? 0.5 : 1,
                            }}
                          >
                            Merge Into Selected School
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={savingEdit}
                          onClick={() => handleDeleteSchoolRecord(detailSchool)}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '6px',
                            border: '1px solid #ef4444',
                            backgroundColor: 'transparent',
                            color: '#ef4444',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Delete School Record
                        </button>
                      </div>
                    </Card>

                    {/* Save / Cancel Footer */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setDetailModalMode('view')}
                        style={{
                          padding: '9px 18px',
                          borderRadius: '8px',
                          border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                          backgroundColor: 'transparent',
                          color: isDark ? '#e2e8f0' : '#334155',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={handleSaveFullSchoolEdit}
                        style={{
                          padding: '9px 22px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#047857',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          fontWeight: 700,
                          cursor: savingEdit ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {savingEdit ? 'Saving Changes...' : 'Save All School & Staff Changes'}
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* MANAGE & EDIT CIRCUITS MODAL */}
      {showCircuitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9992,
            backgroundColor: 'rgba(2, 6, 23, 0.76)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setShowCircuitModal(false);
          }}
        >
          <div
            style={{
              width: '94vw',
              maxWidth: '860px',
              maxHeight: '88vh',
              borderRadius: '14px',
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.55)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              color: isDark ? '#f8fafc' : '#0f172a',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                  Manage, Correct & Merge Circuits
                </h2>
                <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                  Rename any circuit or merge duplicate circuit spellings across all schools and portal teacher submissions
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={handleStandardizeAllCircuitsInCloud}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#047857',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: savingEdit ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingEdit ? 'Standardizing...' : 'Auto-Standardize Duplicate Circuits in Cloud'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCircuitModal(false)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                    backgroundColor: 'transparent',
                    color: 'inherit',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Close ✕
                </button>
              </div>
            </div>

            <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Add New Circuit */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  placeholder="Add a new circuit name (e.g. TEMA NEW TOWN EAST)"
                  value={newCustomCirName}
                  onChange={e => setNewCustomCirName(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '240px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                    backgroundColor: isDark ? '#1e293b' : '#fff',
                    color: 'inherit',
                    fontSize: '13px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const c = txt(newCustomCirName).toUpperCase();
                    if (!c) return;
                    setCustomCircuits(prev => (prev.includes(c) ? prev : [...prev, c]));
                    setNewCustomCirName('');
                    showToast(`Added circuit "${c}"`);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Add Circuit
                </button>
              </div>

              {/* Existing Circuits List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allCircuits.map(c => {
                  const cirSchools = schools.filter(s => s.circuit === c);
                  const cirPupils = sum(cirSchools.map(pupils));
                  const cirTeachers = sum(cirSchools.map(teachers));
                  const draftVal = circuitRenameInputs[c] !== undefined ? circuitRenameInputs[c] : c;

                  return (
                    <div
                      key={c}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ minWidth: '220px' }}>
                        <div style={{ fontWeight: 800, fontSize: '13.5px' }}>{c}</div>
                        <div style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b' }}>
                          {cirSchools.length} schools · {cirPupils.toLocaleString()} pupils · {cirTeachers.toLocaleString()} teachers
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          value={draftVal}
                          onChange={e =>
                            setCircuitRenameInputs(prev => ({
                              ...prev,
                              [c]: e.target.value.toUpperCase(),
                            }))
                          }
                          style={{
                            width: '260px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                            backgroundColor: isDark ? '#0f172a' : '#fff',
                            color: 'inherit',
                            fontSize: '12.5px',
                          }}
                        />
                        <button
                          type="button"
                          disabled={savingEdit || !txt(draftVal) || txt(draftVal).toUpperCase() === c}
                          onClick={() => handleRenameCircuit(c, draftVal)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#047857',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor:
                              savingEdit || !txt(draftVal) || txt(draftVal).toUpperCase() === c
                                ? 'not-allowed'
                                : 'pointer',
                            opacity:
                              savingEdit || !txt(draftVal) || txt(draftVal).toUpperCase() === c ? 0.45 : 1,
                          }}
                        >
                          Rename / Merge Circuit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#047857',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            zIndex: 9999,
          }}
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
