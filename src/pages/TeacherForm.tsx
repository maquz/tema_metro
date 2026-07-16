import { useState, useRef, useEffect } from 'react';
import { CheckCircle, User, FileText, Upload, X, LogOut, ShieldAlert } from 'lucide-react';
import imageCompression from 'browser-image-compression';

import { collection, addDoc, updateDoc, getDocs, doc, serverTimestamp, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import ImageCropperModal from '../components/ImageCropperModal';
import Footer from '../components/Footer';

// ── Types ──────────────────────────────────────────────────
interface AcadRow { level: string; subjects: string; year: string; [key: string]: string; }
interface ProfRow { course: string; institution: string; from: string; to: string; award: string; [key: string]: string; }
interface PromoRow { kind: string; effectiveDate: string; salary: string; point: string; [key: string]: string; }
interface EmployRow { particulars: string; from: string; to: string; remarks: string; [key: string]: string; }
interface NameRow { former: string; dateChange: string; authority: string; [key: string]: string; }
interface Child { name: string; dob: string; }

const SUBJECTS = [
  'English', 'Mathematics', 'Science', 'Social Studies', 'ICT', 'French',
  'RME', 'Creative Arts', 'Ghanaian Language', 'Physical Education', 'Administration'
];

const DOCUMENTS = [
  'Letter of Appointment',
  'Completed and signed Personal Record Form',
  'Certified true copies of Academic and Professional Certificates',
  'Copies of all Promotion Letters',
  'Any other relevant personnel documents relating to your career progression and status within the Service',
];

interface FormState {
  status: 'draft' | 'submitted';
  // Original Routing Data
  category: string; circuit: string; school: string;
  // Personal
  firstName: string; otherNames: string; surname: string;
  teacherName: string; // The combined name to keep admin dashboard working
  currentRank: string;
  designation: string; sex: string; regNo: string; staffId: string;
  dob: string; nationality: string; hometown: string;
  address: string; mobile: string; email: string; ssfNo: string;
  niaNo: string; drivingLicence: string; teachersLicence: string;
  firstAppointment: string; dateConfirmed: string;
  nextOfKin: string; nokTel: string; nokRelationship: string;
  maritalStatus: string; spouseName: string; spouseTel: string;
  lang1: string; lang2: string; lang3: string;
  subject: string;
  children: Child[];
  photoUrl: string;
  // Academic
  academic: AcadRow[];
  // Professional
  professional: ProfRow[];
  // Promotions
  promotions: PromoRow[];
  // Present station
  presentStation: string;
  salaryLevel: string; salaryStep: string;
  // Name change
  nameChanges: NameRow[];
  // Employment
  employment: EmployRow[];
  // Certification Date
  certificationDate: string;
}

const initForm = (): FormState => ({
  status: 'draft',
  category: '', circuit: '', school: '',
  firstName: '', otherNames: '', surname: '', teacherName: '', currentRank: '',
  designation: '', sex: '', regNo: '', staffId: '',
  dob: '', nationality: '', hometown: '',
  address: '', mobile: '', email: '', ssfNo: '',
  niaNo: '', drivingLicence: '', teachersLicence: '',
  firstAppointment: '', dateConfirmed: '',
  nextOfKin: '', nokTel: '', nokRelationship: '',
  maritalStatus: '', spouseName: '', spouseTel: '',
  lang1: '', lang2: '', lang3: '',
  subject: 'English',
  children: [{ name: '', dob: '' }],
  photoUrl: '',
  academic: [{ level: '', subjects: '', year: '' }],
  professional: [{ course: '', institution: '', from: '', to: '', award: '' }],
  promotions: [{ kind: '', effectiveDate: '', salary: '', point: '' }],
  presentStation: '', salaryLevel: '', salaryStep: '',
  nameChanges: [{ former: '', dateChange: '', authority: '' }],
  employment: [{ particulars: '', from: '', to: '', remarks: '' }],
  certificationDate: '',
});

const SECTIONS = [
  'Personal Information',
  'Family & Languages',
  'Qualifications & Promotions',
  'Employment / Posting History',
  'Name Change & Signature',
  'Document Scans',
  'Preview Record',
];

interface ExistingFile {
  isExisting: true;
  downloadURL: string;
  fileName: string;
  documentType: string;
}

type UploadFile = File | ExistingFile;

// ── Input helpers ──────────────────────────────────────────
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="field-label">{label}{required && <span className="required">*</span>}</div>
      {children}
      {error && <p style={{ color: '#CE1126', fontSize: '12px', marginTop: '4px', marginBottom: '-4px' }}>{error}</p>}
    </div>
  );
}
function Inp({ value, onChange, placeholder, type = 'text', disabled = false }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  return <input className="field-input" type={type} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''} style={disabled ? { backgroundColor: '#F9FAFB', cursor: 'not-allowed' } : {}} />;
}
function Sel({ value, onChange, options, disabled = false }: { value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean }) {
  return (
    <select className="field-input" disabled={disabled} value={value?.toUpperCase() || ''} onChange={e => onChange(e.target.value)} style={disabled ? { backgroundColor: '#F9FAFB', cursor: 'not-allowed' } : {}}>
      <option value="">Select…</option>
      {options.map(o => <option key={o} value={o.toUpperCase()}>{o.toUpperCase()}</option>)}
    </select>
  );
}

// ── Section Components ─────────────────────────────────────
function SectionPersonal({ f, setF, dynamicCircuits, getSchoolsForCircuit, errors, onPhotoSelect }: any) {
  const photoRef = useRef<HTMLInputElement>(null);
  
  const upd = (key: keyof FormState) => (v: string) => {
    setF((p: FormState) => {
      const upperValue = (key === 'email' || key === 'photoUrl') ? v : v.toUpperCase();
      const next = { ...p, [key]: upperValue };
      if (key === 'firstName' || key === 'otherNames' || key === 'surname') {
        next.teacherName = `${next.firstName || ''} ${next.otherNames || ''} ${next.surname || ''}`.trim();
      }
      if (key === 'circuit') next.school = '';
      if (key === 'category') { next.circuit = ''; next.school = ''; }
      return next;
    });
  };

  const isSchool = f.category === 'BASIC SCHOOL' || f.category === 'SENIOR HIGH SCHOOL';

  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="form-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
          <User size={16} color="#002147" />
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Registration / Posting</span>
        </div>
        
        <div className="form-row cols-2" style={{ marginBottom: '16px' }}>
          <div>
            <Field label="Category" required>
              <Sel 
                value={f.category} 
                onChange={upd('category')} 
                options={['BASIC SCHOOL', 'SENIOR HIGH SCHOOL', 'Education Office']} 
              />
            </Field>
            {errors.category && <p style={{ color: '#CE1126', fontSize: '12px', marginTop: '4px' }}>{errors.category}</p>}
          </div>
          <div>
            <Field label="Staff ID" required>
              <Inp value={f.staffId} onChange={() => {}} placeholder="Auto-filled" disabled />
            </Field>
            {errors.staffId && <p style={{ color: '#CE1126', fontSize: '12px', marginTop: '4px' }}>{errors.staffId}</p>}
          </div>
        </div>
        
        {isSchool && (
          <>
            {f.category === 'SENIOR HIGH SCHOOL' ? (
              <div className="form-row cols-1">
                <Field label="School Name" required>
                  <Sel 
                    value={f.school} 
                    onChange={upd('school')} 
                    options={[
                      'CHEMU SENIOR HIGH/TECHNICAL SCHOOL',
                      'MANHEAN SENIOR HIGH/TECHNICAL SCHOOL',
                      'OUR LADY OF MERCY SENIOR HIGH SCHOOL (OLAMS)',
                      'TEMA METHODIST DAY SECONDARY SCHOOL',
                      'TEMA PRESBYTERIAN SENIOR HIGH SCHOOL'
                    ]} 
                  />
                </Field>
              </div>
            ) : (
              <div className="form-row cols-2">
                <Field label="Circuit Name" required><Sel value={f.circuit} onChange={upd('circuit')} options={dynamicCircuits} /></Field>
                <Field label="School Name" required><Sel value={f.school} onChange={upd('school')} options={f.circuit ? getSchoolsForCircuit(f.circuit) : []} disabled={!f.circuit} /></Field>
              </div>
            )}
            {errors.circuit && f.category !== 'SENIOR HIGH SCHOOL' && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.circuit}</p>}
            {errors.school && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.school}</p>}
            <div className="form-row cols-1">
              <Field label={f.category === 'SENIOR HIGH SCHOOL' ? 'Department Field' : 'Subject Taught'} required>
                <Sel 
                  value={f.subject} 
                  onChange={upd('subject')} 
                  options={f.category === 'SENIOR HIGH SCHOOL' ? ['SCIENCE', 'GENERAL ARTS', 'BUSINESS', 'AGRICULTURAL SCIENCE', 'VOCATIONAL', 'ICT', 'VISUAL ARTS', 'ADMINISTRATION'] : SUBJECTS} 
                />
              </Field>
            </div>
            {errors.subject && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.subject}</p>}
          </>
        )}

        <div className="form-row cols-1">
          <Field label="Current Rank" required error={errors.currentRank}><Sel value={f.currentRank} onChange={upd('currentRank')} options={['Director II', 'Deputy Director', 'Assistant Director I', 'Assistant Director II', 'Principal Superintendent', 'Senior Superintendent I', 'Senior Superintendent II', 'Superintendent I', 'Superintendent II', 'Pupil Teacher']} /></Field>
        </div>
      </div>

      <div className="section-title" style={{ margin: '0 0 0 0' }}>Biographic Details</div>
      <div className="form-card">
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div>
            <div className="field-label">Passport Photo<span className="required">*</span></div>
            <div className="photo-box" onClick={() => photoRef.current?.click()} style={errors.photoUrl ? { borderColor: '#CE1126', backgroundColor: '#FDF2F2' } : {}}>
              {f.photoUrl ? <img src={f.photoUrl} alt="passport" /> : <><span style={{ fontSize: 24 }}>📷</span><span>Tap to upload</span></>}
            </div>
            {errors.photoUrl && <p style={{ color: '#CE1126', fontSize: '12px', marginTop: '4px', marginBottom: '-4px' }}>{errors.photoUrl}</p>}
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                onPhotoSelect(file);
                if (photoRef.current) photoRef.current.value = '';
              }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Field label="First Name" required error={errors.firstName}><Inp value={f.firstName} onChange={upd('firstName')} placeholder="First name" /></Field>
            <Field label="Other Name(s)"><Inp value={f.otherNames} onChange={upd('otherNames')} placeholder="Other names" /></Field>
            <Field label="Surname" required error={errors.surname}><Inp value={f.surname} onChange={upd('surname')} placeholder="Surname" /></Field>
          </div>
        </div>

        <div className="form-row cols-2">
          <Field label="Designation"><Sel value={f.designation} onChange={upd('designation')} options={['Dr', 'Rev', 'Mr', 'Mrs', 'Miss']} /></Field>
          <Field label="Sex"><Sel value={f.sex} onChange={upd('sex')} options={['Male', 'Female']} /></Field>
        </div>
        <div className="form-row cols-2">
          <Field label="Reg. No." required error={errors.regNo}><Inp value={f.regNo} onChange={upd('regNo')} placeholder="Reg. No." /></Field>
          <Field label="Staff ID" required error={errors.staffId}><Inp value={f.staffId} onChange={() => {}} placeholder="Auto-filled from Registration" disabled /></Field>
        </div>

        <div className="form-row cols-2">
          <Field label="Date of Birth" required error={errors.dob}><Inp value={f.dob} onChange={upd('dob')} type="date" /></Field>
          <Field label="Nationality"><Inp value={f.nationality} onChange={upd('nationality')} placeholder="e.g. Ghanaian" /></Field>
        </div>
        <div className="form-row cols-1">
          <Field label="Home Town"><Inp value={f.hometown} onChange={upd('hometown')} placeholder="Home town" /></Field>
        </div>
        <div className="form-row cols-1">
          <Field label="Address"><Inp value={f.address} onChange={upd('address')} placeholder="Residential address" /></Field>
        </div>
        <div className="form-row cols-2">
          <Field label="Mobile No." required error={errors.mobile}><Inp value={f.mobile} onChange={upd('mobile')} type="tel" placeholder="0XX XXX XXXX" /></Field>
          <Field label="Email" required error={errors.email}><Inp value={f.email} onChange={upd('email')} type="email" placeholder="email@example.com" /></Field>
        </div>
        <div className="form-row cols-2">
          <Field label="SSF No."><Inp value={f.ssfNo} onChange={upd('ssfNo')} placeholder="SSF No." /></Field>
          <Field label="NIA No." required error={errors.niaNo}><Inp value={f.niaNo} onChange={upd('niaNo')} placeholder="NIA No." /></Field>
        </div>
        <div className="form-row cols-2">
          <Field label="Driving Licence No."><Inp value={f.drivingLicence} onChange={upd('drivingLicence')} placeholder="Driving Licence No." /></Field>
          <Field label="Teachers Licence No."><Inp value={f.teachersLicence} onChange={upd('teachersLicence')} placeholder="Teachers Licence No." /></Field>
        </div>
        <div className="form-row cols-2">
          <Field label="Date of First Appointment"><Inp value={f.firstAppointment} onChange={upd('firstAppointment')} type="date" /></Field>
          <Field label="Date Confirmed"><Inp value={f.dateConfirmed} onChange={upd('dateConfirmed')} type="date" /></Field>
        </div>
      </div>
    </div>
  );
}

function SectionFamilyLang({ f, setF }: { f: FormState; setF: React.Dispatch<React.SetStateAction<FormState>> }) {
  const upd = (key: keyof FormState) => (v: string) => setF(p => ({ ...p, [key]: v.toUpperCase() }));
  const updChild = (i: number, key: keyof Child, v: string) => setF((p: FormState) => { const c = [...p.children]; c[i] = { ...c[i], [key]: v }; return { ...p, children: c }; });
  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="section-title">Next of Kin</div>
      <div className="form-card">
        <div className="form-row cols-1">
          <Field label="Next of Kin Name"><Inp value={f.nextOfKin} onChange={upd('nextOfKin')} placeholder="Full name" /></Field>
        </div>
        <div className="form-row cols-2">
          <Field label="Tel."><Inp value={f.nokTel} onChange={upd('nokTel')} type="tel" /></Field>
          <Field label="Relationship"><Inp value={f.nokRelationship} onChange={upd('nokRelationship')} placeholder="e.g. Wife" /></Field>
        </div>
        <div className="form-row cols-2">
          <Field label="Marital Status"><Sel value={f.maritalStatus} onChange={upd('maritalStatus')} options={['Single', 'Married', 'Widow', 'Widower', 'Divorced']} /></Field>
          <Field label="Spouse Tel."><Inp value={f.spouseTel} onChange={upd('spouseTel')} type="tel" /></Field>
        </div>
        <div className="form-row cols-1">
          <Field label="Name of Spouse"><Inp value={f.spouseName} onChange={upd('spouseName')} placeholder="Spouse's name" /></Field>
        </div>
      </div>

      <div className="section-title">Languages Spoken</div>
      <div className="form-card">
        <div className="form-row cols-3">
          <Field label="Language 1"><Inp value={f.lang1} onChange={upd('lang1')} /></Field>
          <Field label="Language 2"><Inp value={f.lang2} onChange={upd('lang2')} /></Field>
          <Field label="Language 3"><Inp value={f.lang3} onChange={upd('lang3')} /></Field>
        </div>
      </div>

      <div className="section-title">Names &amp; Dates of Birth of Children</div>
      <div className="form-card">
        {f.children.map((c: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
              <Field label={`Child ${i + 1} Name`}>
                <Inp value={c.name} onChange={v => updChild(i, 'name', v.toUpperCase())} placeholder="Full Name" />
              </Field>
              <Field label="Date of Birth">
                <Inp value={c.dob} onChange={v => updChild(i, 'dob', v)} type="date" />
              </Field>
            </div>
            {f.children.length > 1 && (
              <button
                onClick={() => setF((p: FormState) => ({ ...p, children: p.children.filter((_: any, j: number) => j !== i) }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 20, paddingTop: 18, flexShrink: 0 }}
              >×</button>
            )}
          </div>
        ))}
        <button
          className="add-row-btn"
          onClick={() => setF((p: FormState) => ({ ...p, children: [...p.children, { name: '', dob: '' }] }))}
        >+ Add Child</button>
      </div>
    </div>
  );
}

function DynTable<T extends Record<string, string>>({
  rows, setRows, columns
}: {
  rows: T[];
  setRows: (r: T[]) => void;
  columns: { key: keyof T; label: string; width?: number }[];
}) {
  const emptyRow = () => Object.fromEntries(columns.map(c => [c.key, ''])) as T;
  return (
    <div>
      <div className="table-wrap">
        <table className="dyn-table">
          <thead><tr>
            <th style={{ width: 30 }}>#</th>
            {columns.map(c => <th key={String(c.key)} style={c.width ? { width: c.width } : {}}>{c.label}</th>)}
            <th style={{ width: 28 }}></th>
          </tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={{ color: '#9ca3af', textAlign: 'center' }}>{i + 1}</td>
                {columns.map(c => (
                  <td key={String(c.key)}>
                    <input value={row[c.key] as string} onChange={e => {
                      const updated = [...rows];
                      const isDate = c.key === 'from' || c.key === 'to' || c.key === 'effectiveDate' || c.key === 'dateChange' || c.key === 'award';
                      updated[i] = { ...updated[i], [c.key]: isDate ? e.target.value : e.target.value.toUpperCase() };
                      setRows(updated);
                    }} />
                  </td>
                ))}
                <td><button className="del-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="add-row-btn" onClick={() => setRows([...rows, emptyRow()])}>+ Add Row</button>
    </div>
  );
}

function SectionQualifications({ f, setF }: { f: FormState; setF: React.Dispatch<React.SetStateAction<FormState>> }) {
  const upd = (key: keyof FormState) => (v: string) => setF(p => ({ ...p, [key]: v }));
  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="section-title">Academic Qualifications</div>
      <div className="form-card">
        <DynTable
          rows={f.academic}
          setRows={rows => setF(p => ({ ...p, academic: rows }))}
          columns={[
            { key: 'level', label: 'Level / Qualification' },
            { key: 'subjects', label: 'Subjects Passed', width: 140 },
            { key: 'year', label: 'Year', width: 60 },
          ]}
        />
      </div>

      <div className="section-title">Professional Qualifications</div>
      <div className="form-card">
        <DynTable
          rows={f.professional}
          setRows={rows => setF(p => ({ ...p, professional: rows }))}
          columns={[
            { key: 'course', label: 'Course' },
            { key: 'institution', label: 'Institution' },
            { key: 'from', label: 'From', width: 65 },
            { key: 'to', label: 'To', width: 65 },
            { key: 'award', label: 'Award Date', width: 80 },
          ]}
        />
      </div>

      <div className="section-title">Promotions</div>
      <div className="form-card">
        <DynTable
          rows={f.promotions}
          setRows={rows => setF(p => ({ ...p, promotions: rows }))}
          columns={[
            { key: 'kind', label: 'Kind of Promotion' },
            { key: 'effectiveDate', label: 'Effective Date', width: 80 },
            { key: 'salary', label: 'Salary Scale', width: 80 },
            { key: 'point', label: 'Point of Entry', width: 80 },
          ]}
        />
      </div>

      <div className="section-title">Present Station &amp; Salary</div>
      <div className="form-card">
        <div className="form-row cols-1">
          <Field label="Address of Present Station"><Inp value={f.presentStation} onChange={upd('presentStation')} placeholder="Station address" /></Field>
        </div>
        <div className="form-row cols-2">
          <Field label="Salary Level"><Inp value={f.salaryLevel} onChange={upd('salaryLevel')} /></Field>
          <Field label="Salary Step"><Inp value={f.salaryStep} onChange={upd('salaryStep')} /></Field>
        </div>
      </div>
    </div>
  );
}

function SectionEmployment({ f, setF }: { f: FormState; setF: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="form-card">
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 0, lineHeight: 1.5 }}>
          Indicate where appropriate any break or discontinuance of services (study leave, maternity leave, sick leave, resignation, dismissal, suspension etc.) with dates.
        </p>
        <DynTable
          rows={f.employment}
          setRows={rows => setF(p => ({ ...p, employment: rows }))}
          columns={[
            { key: 'particulars', label: 'Particulars of Employment / Posting' },
            { key: 'from', label: 'From', width: 65 },
            { key: 'to', label: 'To', width: 65 },
            { key: 'remarks', label: 'Remarks with Dates', width: 120 },
          ]}
        />
      </div>
    </div>
  );
}

function SectionNameSig({ f, setF }: { f: FormState; setF: React.Dispatch<React.SetStateAction<FormState>> }) {
  const upd = (key: keyof FormState) => (v: string) => setF(p => ({ ...p, [key]: v }));
  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="section-title">Name Change (if applicable)</div>
      <div className="form-card">
        <DynTable
          rows={f.nameChanges}
          setRows={rows => setF(p => ({ ...p, nameChanges: rows }))}
          columns={[
            { key: 'former', label: 'Former Name' },
            { key: 'dateChange', label: 'Date of Change', width: 90 },
            { key: 'authority', label: 'Authority', width: 100 },
          ]}
        />
      </div>
      <div className="section-title">Certification</div>
      <div className="form-card">
        <p style={{ fontSize: 13, color: '#374151', fontStyle: 'italic', lineHeight: 1.6 }}>
          I certify that the information given on this form is accurate.
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <div style={{ flex: 1 }}>
            <div className="sig-line">Signature of Teacher / Officer</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="sig-line">Signature &amp; Official Stamp of Director / Head of School</div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Field label="Date"><Inp value={f.certificationDate || ''} onChange={upd('certificationDate')} type="date" /></Field>
        </div>
      </div>
    </div>
  );
}

export function Summary({ f, onReset, isPreview = false, onGoDashboard, onLogout }: { f: FormState; onReset?: () => void; isPreview?: boolean; onGoDashboard?: () => void; onLogout?: () => void; }) {
  const row = (label: string, val: string) => val ? (
    <div className="summary-item">
      <span className="summary-key">{label}</span>
      <span className="summary-val">{val}</span>
    </div>
  ) : null;

  return (
    <div style={{ minHeight: '100vh', background: isPreview ? 'transparent' : '#f0f4f8', paddingBottom: 90, maxWidth: 600, margin: '0 auto' }}>
      {!isPreview && (
        <>
          <div className="ges-header">
            <h1>Ghana Education Service</h1>
            <h2>Tema Metropolitan Directorate of Education</h2>
          </div>
          <div style={{ padding: '14px 12px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 32 }}>✅</div>
            <h2 style={{ color: '#002147', margin: '6px 0 4px', fontSize: 17 }}>Record Submitted Successfully</h2>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Personal Record of Members of the GES</p>
          </div>
        </>
      )}

      {f.photoUrl && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
          <img src={f.photoUrl} alt="passport" style={{ width: 90, height: 108, objectFit: 'cover', border: '2px solid #002147', borderRadius: 4 }} />
        </div>
      )}

      {[[
        ['Full Name', [f.designation, f.firstName, f.otherNames, f.surname].filter(Boolean).join(' ')],
        ['Staff ID', f.staffId], ['Reg. No.', f.regNo], ['Sex', f.sex],
        ['Date of Birth', f.dob], ['Nationality', f.nationality], ['Home Town', f.hometown],
        ['Address', f.address], ['Mobile', f.mobile], ['Email', f.email],
        ['SSF No.', f.ssfNo], ['NIA No.', f.niaNo],
        ['Driving Licence', f.drivingLicence], ['Teachers Licence', f.teachersLicence],
        ['First Appointment', f.firstAppointment], ['Date Confirmed', f.dateConfirmed],
        ['Marital Status', f.maritalStatus], ['Spouse', f.spouseName],
        ['Next of Kin', f.nextOfKin], ['Languages', [f.lang1, f.lang2, f.lang3].filter(Boolean).join(', ')],
      ] as [string, string][]].map((section, si) => (
        <div key={si} className="form-card">
          <div style={{ fontWeight: 700, color: '#002147', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Personal Information</div>
          {section.map(([k, v]) => row(k, v))}
        </div>
      ))}

      {f.children && f.children.some(c => c.name || (c as any).nameAndDob) && (
        <div className="form-card">
          <div style={{ fontWeight: 700, color: '#002147', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' }}>Children</div>
          {f.children.filter(c => c.name || (c as any).nameAndDob).map((c, i) => (
            <div key={i} className="summary-item">
              <span className="summary-key">Child {i + 1}</span>
              <span className="summary-val">{c.name ? `${c.name} (DOB: ${c.dob})` : (c as any).nameAndDob}</span>
            </div>
          ))}
        </div>
      )}

      {f.academic?.some(r => r.level) && (
        <div className="form-card">
          <div style={{ fontWeight: 700, color: '#002147', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' }}>Academic Qualifications</div>
          {f.academic.filter(r => r.level).map((r, i) => (
            <div key={i} className="summary-item">
              <span className="summary-key">{r.level}</span>
              <span className="summary-val">{r.subjects} {r.year ? `(${r.year})` : ''}</span>
            </div>
          ))}
        </div>
      )}

      {f.professional?.some(r => r.course) && (
        <div className="form-card">
          <div style={{ fontWeight: 700, color: '#002147', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' }}>Professional Qualifications</div>
          {f.professional.filter(r => r.course).map((r, i) => (
            <div key={i} className="summary-item">
              <span className="summary-key">{r.course}</span>
              <span className="summary-val">{r.institution} ({r.from}–{r.to})</span>
            </div>
          ))}
        </div>
      )}

      {f.promotions?.some(r => r.kind) && (
        <div className="form-card">
          <div style={{ fontWeight: 700, color: '#002147', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' }}>Promotions</div>
          {f.promotions.filter(r => r.kind).map((r, i) => (
            <div key={i} className="summary-item">
              <span className="summary-key">{r.kind}</span>
              <span className="summary-val">{r.effectiveDate} (Scale: {r.salary}, Point: {r.point})</span>
            </div>
          ))}
        </div>
      )}

      {f.employment?.some(r => r.particulars) && (
        <div className="form-card">
          <div style={{ fontWeight: 700, color: '#002147', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' }}>Employment History</div>
          {f.employment.filter(r => r.particulars).map((r, i) => (
            <div key={i} className="summary-item">
              <span className="summary-key">{r.particulars}</span>
              <span className="summary-val">{r.from} – {r.to}</span>
            </div>
          ))}
        </div>
      )}

      {f.nameChanges && f.nameChanges.some(r => r.former) && (
        <div className="form-card">
          <div style={{ fontWeight: 700, color: '#002147', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' }}>Name Changes</div>
          {f.nameChanges.filter(r => r.former).map((r, i) => (
            <div key={i} className="summary-item">
              <span className="summary-key">{r.former}</span>
              <span className="summary-val">{r.dateChange} (Auth: {r.authority})</span>
            </div>
          ))}
        </div>
      )}

      {!isPreview && (onReset || onGoDashboard || onLogout) && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 600, background: 'white', borderTop: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', gap: '8px' }}>
          {onReset && <button onClick={onReset} style={{ flex: 1, padding: 12, background: '#002147', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Start New Record</button>}
          {onGoDashboard && <button onClick={onGoDashboard} style={{ flex: 1, padding: 12, background: '#F59E0B', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Dashboard</button>}
          {onLogout && <button onClick={onLogout} style={{ flex: 1, padding: 12, background: '#E5E7EB', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Log Out</button>}
        </div>
      )}
    </div>
  );
}

// ── File Upload Row ───────────────────────────────────────────────
function FileUploadRow({ docLabel, index, filesList, onFilesChange, isOptional, currentRole }: { docLabel: string; index: number; filesList: UploadFile[]; onFilesChange: (f: UploadFile[]) => void; isOptional?: boolean; currentRole: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);
  
  const handleAddFile = (file: File | null) => {
    if (!file) return;
    onFilesChange([...filesList, file]);
  };

  const handleSelectFile = (file: File | null) => {
    if (!file) return;
    if (file.type.startsWith('image/')) {
      setFileToCrop(file);
    } else {
      handleAddFile(file);
    }
  };

  const handleRemoveFile = (fileIndex: number, fileObj: UploadFile) => {
    if ('isExisting' in fileObj && currentRole !== 'admin') {
      alert('You cannot delete an already uploaded document. Please contact an administrator.');
      return;
    }
    onFilesChange(filesList.filter((_, i) => i !== fileIndex));
  };

  const hasFiles = filesList.length > 0;

  return (
    <>
      <div style={{
        borderRadius: '12px', border: '1.5px solid', borderColor: hasFiles ? '#002147' : '#E5E7EB',
        backgroundColor: hasFiles ? '#E8F0FE' : '#FAFAFA', marginBottom: '10px', overflow: 'hidden', transition: 'all 0.15s',
      }}>
        {/* Doc label row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 12px 8px' }}>
          <div style={{
            width: '24px', height: '24px', borderRadius: '50%', border: '2px solid',
            borderColor: hasFiles ? '#002147' : '#D1D5DB', backgroundColor: hasFiles ? '#002147' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', transition: 'all 0.15s',
          }}>
            {hasFiles ? <CheckCircle size={14} color="#fff" strokeWidth={2.5} /> : <span style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF' }}>{index + 1}</span>}
          </div>
          <span style={{ fontSize: '13px', color: '#374151', fontWeight: hasFiles ? '600' : '400', lineHeight: '1.5', flex: 1 }}>
            {docLabel} {isOptional && <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 'normal', marginLeft: '4px' }}>(Optional)</span>}
          </span>
        </div>

        {/* Upload area */}
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filesList.map((f, i) => {
            const isExt = 'isExisting' in f;
            const name = isExt ? (f as ExistingFile).fileName : (f as File).name;
            const canDelete = !isExt || currentRole === 'admin';
            
            return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#D0E2FF', borderRadius: '8px', padding: '8px 12px' }}>
              <FileText size={14} color="#002147" />
              <span style={{ fontSize: '12px', color: '#002147', fontWeight: '500', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
              {canDelete && (
                <button
                  onClick={() => handleRemoveFile(i, f)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center' }}
                >
                  <X size={14} color="#CE1126" />
                </button>
              )}
            </div>
          )})}
          <button
            onClick={() => ref.current?.click()}
            style={{
              width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px dashed #D1D5DB',
              backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '6px', cursor: 'pointer', color: '#6B7280', fontSize: '12px', fontWeight: '500',
            }}
          >
            <Upload size={14} color="#6B7280" /> {hasFiles ? 'Add another document' : 'Scan / Upload document'}
          </button>
          <input ref={ref} type="file" accept="image/*,application/pdf" capture="environment" onChange={e => { handleSelectFile(e.target.files?.[0] ?? null); if (ref.current) ref.current.value = ''; }} style={{ display: 'none' }} />
        </div>
      </div>

      {fileToCrop && (
        <ImageCropperModal
          file={fileToCrop}
          docLabel={docLabel}
          onCropComplete={(croppedFile) => {
            handleAddFile(croppedFile);
            setFileToCrop(null);
          }}
          onCancel={() => {
            setFileToCrop(null);
          }}
        />
      )}
    </>
  );
}

// ── Main App ───────────────────────────────────────────────
export default function TeacherForm() {
  const { user, role, staffId: authStaffId, logout } = useAuth();
  
  const getInitialSection = () => {
    try {
      const saved = localStorage.getItem('tema_metro_section');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) return parsed;
      }
    } catch(e) {}
    return 0;
  };

  const getInitialForm = () => {
    try {
      const saved = localStorage.getItem('tema_metro_form_draft');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return initForm();
  };

  const [section, setSection] = useState<number>(getInitialSection());
  const [form, setForm] = useState<FormState>(getInitialForm());
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [files, setFiles] = useState<UploadFile[][]>(DOCUMENTS.map(() => []));
  const [submitting, setSubmitting] = useState(false);
  const [submittingText, setSubmittingText] = useState('Submitting...');
  const [schoolsData, setSchoolsData] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [editSubmissionId, setEditSubmissionId] = useState<string | null>(null);
  const [passportCropFile, setPassportCropFile] = useState<File | null>(null);

  const totalSections = SECTIONS.length;
  const pct = ((section + 1) / totalSections) * 100;

  useEffect(() => {
    localStorage.setItem('tema_metro_form_draft', JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    localStorage.setItem('tema_metro_section', section.toString());
  }, [section]);

  useEffect(() => {
    if (authStaffId) {
      setForm(prev => ({ ...prev, staffId: authStaffId }));
    }
  }, [authStaffId]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'schools'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchoolsData(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'submissions'), where('submittedBy', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMySubmissions(data);
    });
    return () => unsub();
  }, [user]);

  const dynamicCircuits = Array.from(new Set(schoolsData.map(s => s.circuit))).sort();
  const getSchoolsForCircuit = (circuit: string) => schoolsData.filter(s => s.circuit === circuit).map(s => s.school).sort();

  const currentRole = role || 'teacher';

  useEffect(() => {
  }, [currentRole]);

  // Auto-Save Effect (Every 10 seconds)
  useEffect(() => {
    if (currentRole !== 'teacher' && currentRole !== 'metro_officer') return;
    
    const interval = setInterval(async () => {
      if (!form.staffId || form.staffId.trim() === '') return;
      if (submitting) return;

      try {
        if (editSubmissionId) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { photoUrl, ...formWithoutPhoto } = form;
          await updateDoc(doc(db, 'submissions', editSubmissionId), {
            ...formWithoutPhoto,
            status: form.status || 'submitted',
            updatedAt: serverTimestamp(),
          });
        } else {
          const q = query(collection(db, 'submissions'), where('submittedBy', '==', user?.uid ?? ''));
          const snap = await getDocs(q);
          const normalizedInputId = form.staffId.replace(/\s+/g, '').toUpperCase();
          const existingDoc = snap.docs.find(d => {
            const docStaffId = d.data().staffId?.replace(/\s+/g, '').toUpperCase();
            return docStaffId === normalizedInputId;
          });
          if (existingDoc) {
            const existingId = existingDoc.id;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { photoUrl, ...formWithoutPhoto } = form;
            await updateDoc(doc(db, 'submissions', existingId), {
              ...formWithoutPhoto,
              status: form.status || 'submitted',
              updatedAt: serverTimestamp(),
            });
            setEditSubmissionId(existingId);
          } else {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { photoUrl, ...formWithoutPhoto } = form;
            const docRef = await addDoc(collection(db, 'submissions'), {
              ...formWithoutPhoto,
              status: 'draft',
              submittedBy: user?.uid ?? '',
              submittedByEmail: user?.email ?? '',
              createdAt: serverTimestamp(),
            });
            setEditSubmissionId(docRef.id);
            setForm(f => ({ ...f, status: 'draft' }));
          }
        }
      } catch (err) {
        console.error('Auto-save error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [form, editSubmissionId, currentRole, submitting, user]);

  const validatePersonal = () => {
    const e: Partial<FormState> = {};
    if (!form.staffId || form.staffId.trim() === '') e.staffId = 'Required';
    if (!form.category) e.category = 'Required';
    if (form.category === 'BASIC SCHOOL') {
      if (!form.circuit) e.circuit = 'Required';
      if (!form.school) e.school = 'Required';
      if (!form.subject) e.subject = 'Required';
    } else if (form.category === 'SENIOR HIGH SCHOOL') {
      if (!form.school) e.school = 'Required';
      if (!form.subject) e.subject = 'Required';
    }
    
    if (!form.firstName || form.firstName.trim() === '') e.firstName = 'Required';
    if (!form.surname || form.surname.trim() === '') e.surname = 'Required';
    if (!form.currentRank) e.currentRank = 'Required';
    if (!form.photoUrl) e.photoUrl = 'Photo Required';
    if (!form.regNo || form.regNo.trim() === '') e.regNo = 'Required';
    if (!form.dob) e.dob = 'Required';
    if (!form.mobile || form.mobile.trim() === '') e.mobile = 'Required';
    if (!form.email || form.email.trim() === '') e.email = 'Required';
    if (!form.niaNo || form.niaNo.trim() === '') e.niaNo = 'Required';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleProceedNext = () => {
    if (section === 0) {
      if (validatePersonal()) {
        setSection(s => s + 1);
        window.scrollTo(0, 0);
      }
    } else if (section < totalSections - 1) {
      setSection(s => s + 1);
      window.scrollTo(0, 0);
    }
  };

  const setFileGroup = (i: number) => (fs: UploadFile[]) => setFiles(prev => prev.map((v, idx) => idx === i ? fs : v));
  const requiredUploadedCount = files.slice(0, 4).filter(group => group.length > 0).length;
  const allUploaded = requiredUploadedCount === 4;

  const handleEditSubmission = (sub: any) => {
    setForm({
      ...initForm(),
      ...sub,
      category: sub.category || '',
      circuit: sub.circuit || '',
      school: sub.school || '',
      subject: sub.subject || '',
      certificationDate: sub.certificationDate || '',
      firstName: sub.firstName || sub.teacherName?.split(' ')[0] || '',
      surname: sub.surname || sub.teacherName?.split(' ').slice(1).join(' ') || '',
      sex: sub.sex || '',
    });
    setEditSubmissionId(sub.id);
    
    const newFiles = DOCUMENTS.map(docName => {
      const existingDocs = sub.documents?.filter((d: any) => d.documentType === docName) || [];
      return existingDocs.map((d: any) => ({
        isExisting: true,
        downloadURL: d.downloadURL,
        fileName: d.fileName,
        documentType: d.documentType,
      }));
    });
    setFiles(newFiles);
    
    setSection(0);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmittingText('Preparing files...');
    try {
      const flatFiles = files.flatMap((group, index) => 
        group.map(file => ({ file, documentType: DOCUMENTS[index] }))
      );

      const sanitizeForFilename = (str: string) => {
        return str.trim().replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_');
      };

      // Cloudinary config — hoisted so both the doc loop and photo upload can use it
      const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
      const uploadPreset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();
      if (!cloudName || !uploadPreset || cloudName === 'your_cloudinary_cloud_name') {
        throw new Error('MISSING_CLOUDINARY_CONFIG');
      }

      setSubmittingText(`Uploading ${flatFiles.length} documents...`);

      const uploadPromises = flatFiles.map(async ({ file, documentType }) => {
        if ('isExisting' in file) {
          return { documentType, downloadURL: file.downloadURL, fileName: file.fileName };
        }

        let fileToUpload = file as File;
        let ext = fileToUpload.name.split('.').pop()?.toLowerCase() || 'pdf';

        if (fileToUpload.type.startsWith('image/')) {
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 2048,
            useWebWorker: true,
          };
          try {
            fileToUpload = await imageCompression(fileToUpload, options);
            ext = fileToUpload.type.split('/')[1] === 'png' ? 'png' : 'jpg';
          } catch (error) {
            console.error('Image compression error:', error);
          }
        }

        const sanitizedTeacher = sanitizeForFilename(form.teacherName || form.firstName);
        const safeDocType = sanitizeForFilename(documentType);
        const prefix = sanitizeForFilename(form.staffId || 'NO_ID');
        const newFilename = `${prefix}_${sanitizedTeacher}_${safeDocType}.${ext}`;
        const renamedFile = new File([fileToUpload], newFilename, { type: fileToUpload.type });

        const formData = new FormData();
        formData.append('file', renamedFile, newFilename);
        formData.append('upload_preset', uploadPreset);
        
        const folderPath = form.category === 'Education Office' 
          ? `ges-tema/Education Office/${form.teacherName}`
          : `ges-tema/${form.circuit}/${form.school}/${form.teacherName}`;
        formData.append('folder', folderPath);

        const resourceType = renamedFile.type.startsWith('image/') ? 'image' : 'raw';
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Cloudinary upload failed for ${newFilename}. Reason: ${errText}`);
        }

        const data = await response.json();
        return {
          documentType,
          downloadURL: data.secure_url,
          fileName: newFilename,
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      // Upload passport photo to Cloudinary if it's a base64 string (not already a URL)
      let passportPhotoUrl = '';
      if (form.photoUrl && form.photoUrl.startsWith('data:')) {
        try {
          setSubmittingText('Uploading passport photo...');
          // Convert base64 data URL to blob using fetch natively (much faster than atob loop)
          const res = await fetch(form.photoUrl);
          const photoBlob = await res.blob();
          const photoFile = new File([photoBlob], `${sanitizeForFilename(form.staffId || 'NO_ID')}_${sanitizeForFilename(form.teacherName || form.firstName)}_Passport.jpg`, { type: 'image/jpeg' });

          const photoFormData = new FormData();
          photoFormData.append('file', photoFile);
          photoFormData.append('upload_preset', uploadPreset);
          const folderPath = form.category === 'Education Office'
            ? `ges-tema/Education Office/${form.teacherName}/passport`
            : `ges-tema/${form.circuit}/${form.school}/${form.teacherName}/passport`;
          photoFormData.append('folder', folderPath);

          const photoRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: photoFormData,
          });
          if (photoRes.ok) {
            const photoData = await photoRes.json();
            passportPhotoUrl = photoData.secure_url;
          }
        } catch (photoErr) {
          console.warn('Passport photo upload failed, continuing without it:', photoErr);
        }
      } else if (form.photoUrl && form.photoUrl.startsWith('http')) {
        // Already a Cloudinary URL from a previous submission
        passportPhotoUrl = form.photoUrl;
      }

      setSubmittingText('Saving to database...');

      // Strip base64 photoUrl — never write large base64 strings to Firestore
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { photoUrl: _base64Photo, ...formWithoutPhoto } = form;
      const firestorePayload = {
        ...formWithoutPhoto,
        photoUrl: passportPhotoUrl, // store only the Cloudinary URL (empty string if upload failed)
        documents: uploadedFiles,
      };

      // Save to Firestore using staffId as lookup key
      if (editSubmissionId) {
        await updateDoc(doc(db, 'submissions', editSubmissionId), {
          ...firestorePayload,
          status: 'submitted',
          updatedAt: serverTimestamp(),
        });
      } else {
        // Check if a record with this staffId already exists within user's own submissions
        const q = query(collection(db, 'submissions'), where('submittedBy', '==', user?.uid ?? ''));
        const snap = await getDocs(q);
        const normalizedInputId = form.staffId.replace(/\s+/g, '').toUpperCase();
        const existingDoc = snap.docs.find(d => {
          const docStaffId = d.data().staffId?.replace(/\s+/g, '').toUpperCase();
          return docStaffId === normalizedInputId;
        });
        if (existingDoc) {
          const existingId = existingDoc.id;
          await updateDoc(doc(db, 'submissions', existingId), {
            ...firestorePayload,
            status: 'submitted',
            updatedAt: serverTimestamp(),
          });
          setEditSubmissionId(existingId);
        } else {
          const docRef = await addDoc(collection(db, 'submissions'), {
            ...firestorePayload,
            status: 'submitted',
            submittedBy: user?.uid ?? '',
            submittedByEmail: user?.email ?? '',
            submittedAt: serverTimestamp(),
          });
          setEditSubmissionId(docRef.id);
        }
      }


      localStorage.removeItem('tema_metro_form_draft');
      localStorage.removeItem('tema_metro_section');
      setSubmitting(false);
      setSection(7); // Move to Success/Summary section
    } catch (error: any) {
      console.error('Error submitting form:', error);
      if (error.message === 'MISSING_CLOUDINARY_CONFIG') {
        alert('Configuration Error: Cloudinary settings are missing. Please update VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env file.');
      } else {
        alert('There was an error submitting your form. Please ensure you are connected to the internet and try again. Contact the admin if the issue persists.');
      }
      setSubmitting(false);
    }
  };

  // Check roles
  if (currentRole !== 'teacher' && currentRole !== 'metro_officer' && currentRole !== 'admin' && currentRole !== 'editor') {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#F0F4F8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
        <div
          onClick={() => window.location.href = '/'}
          style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#002147', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', cursor: 'pointer', padding: '4px', boxShadow: '0 4px 12px rgba(0,33,71,0.25)' }}
        >
          <img src="/logo.png" alt="GES Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#CE1126', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
          <ShieldAlert size={36} color="#FFFFFF" strokeWidth={2.5} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#111827', margin: '0 0 8px', textAlign: 'center' }}>Access Denied</h2>
        <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', margin: '0 0 28px', lineHeight: '1.6' }}>
          You are signed in as an <strong>{(role ?? '').toUpperCase()}</strong>.<br />
          Only <strong>Teacher</strong> and <strong>Metro Officer</strong> roles can submit records.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => window.location.href = '/admin'} style={{ padding: '13px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#002147', color: '#FFFFFF', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Go to Admin Panel</button>
          <button onClick={logout} style={{ padding: '13px 24px', borderRadius: '12px', border: '1.5px solid #D1D5DB', backgroundColor: '#FFFFFF', color: '#374151', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Log Out</button>
        </div>
      </div>
    );
  }

  if (section === 7) {
    return <Summary 
      f={form} 
      onReset={() => { localStorage.removeItem('tema_metro_form_draft'); localStorage.removeItem('tema_metro_section'); setForm(initForm()); setSection(0); setEditSubmissionId(null); setFiles(DOCUMENTS.map(() => [])); }} 
      onGoDashboard={() => { setSection(0); setEditSubmissionId(null); }} 
      onLogout={logout} 
    />;
  }

  const sectionComponents = [
    <SectionPersonal f={form} setF={setForm} dynamicCircuits={dynamicCircuits} getSchoolsForCircuit={getSchoolsForCircuit} errors={errors} onPhotoSelect={setPassportCropFile} />,
    <SectionFamilyLang f={form} setF={setForm} />,
    <SectionQualifications f={form} setF={setForm} />,
    <SectionEmployment f={form} setF={setForm} />,
    <SectionNameSig f={form} setF={setForm} />,
  ];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', minHeight: '100vh', background: '#f0f4f8' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #002147 0%, #001530 100%)', padding: '24px 20px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: '-30px', left: '-10px', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.04)' }} />

        {/* User bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', paddingBottom: '12px', marginBottom: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={14} color="#FFF" />
            </div>
            <div style={{ fontSize: '12px', color: '#FFF' }}>
              <span style={{ fontWeight: '600' }}>{user?.email}</span>
              <span style={{ fontSize: '10px', backgroundColor: '#CE1126', color: '#FFF', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                {currentRole === 'metro_officer' ? 'Education Officer' : currentRole === 'teacher' ? 'Teacher' : currentRole}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {(currentRole === 'admin' || currentRole === 'editor') && (
              <button
                onClick={() => window.location.href = '/admin'}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '6px', color: '#FFF', fontSize: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
              >
                <ShieldAlert size={14} /> Admin Panel
              </button>
            )}
            <button
              onClick={logout}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
            >
              <LogOut size={14} /> Log Out
            </button>
          </div>
        </div>

        <div 
          onClick={() => window.location.href = '/'}
          style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', cursor: 'pointer', borderRadius: '12px', padding: '6px 8px', transition: 'background-color 0.2s' }}
          title="Click to Refresh & Return to Landing Page"
        >
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '2px', overflow: 'hidden' }}>
            <img src="/logo.png" alt="GES Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ghana Education Service</div>
            <div style={{ fontSize: '15px', color: '#FFFFFF', fontWeight: '700', lineHeight: '1.2', marginTop: '2px' }}>Tema Metro Education</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: '500' }}>Directorate</div>
          </div>
        </div>

        {!(section === 0 && mySubmissions.length > 0 && !editSubmissionId) && (
          <>
            <div className="progress-label" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 16, textAlign: 'left' }}>
              {SECTIONS[section]} ({section + 1} of {totalSections})
            </div>
            <div className="progress-bar" style={{ backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
              <div className="progress-fill" style={{ width: `${pct}%`, backgroundColor: '#CE1126' }} />
            </div>
          </>
        )}
      </div>

      <div style={{ padding: '20px 16px' }}>
        {section === 0 && mySubmissions.length > 0 && !editSubmissionId && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#111827', margin: '0 0 12px' }}>Your Previous Submissions</h3>
            {mySubmissions.map(sub => (
              <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #E5E7EB', borderRadius: '8px', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#002147' }}>{sub.teacherName || sub.firstName}</div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>{sub.category === 'Education Office' ? 'Education Office' : `${sub.school} (${sub.circuit})`}</div>
                </div>
                <button onClick={() => handleEditSubmission(sub)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: '#FFF', color: '#002147', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Edit</button>
              </div>
            ))}
          </div>
        )}

        {/* Dynamic section rendering */}
        {!(section === 0 && mySubmissions.length > 0 && !editSubmissionId) && (
          <>
            {section < 5 ? sectionComponents[section] : section === 5 ? (
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <FileText size={16} color="#002147" />
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Documents to be Scanned</span>
                </div>
                <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px', marginTop: '4px' }}>
                  Scan or upload each document using your camera or file picker.
                </p>
                {DOCUMENTS.map((doc, i) => (
                  <FileUploadRow key={i} index={i} docLabel={doc} filesList={files[i]} onFilesChange={setFileGroup(i)} isOptional={i === 4} currentRole={currentRole} />
                ))}

                <div style={{ backgroundColor: '#F9FAFB', borderRadius: '12px', padding: '12px 16px', marginTop: '16px', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>Required documents uploaded</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: allUploaded ? '#002147' : '#6B7280' }}>
                    {requiredUploadedCount} / 4
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <CheckCircle size={18} color="#002147" />
                  <span style={{ fontSize: '15px', fontWeight: '700', color: '#111827' }}>Preview Before Submission</span>
                </div>
                <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
                  Please review all your details below. If anything is incorrect, use the Back button to make corrections before final submission.
                </p>
                <Summary f={form} isPreview={true} />
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ height: '80px' }} /> {/* Spacer for nav bar */}
      
      {/* Nav bar */}
      {!(section === 0 && mySubmissions.length > 0 && !editSubmissionId) && (
        <div className="nav-bar">
          <div>
            {section > 0 && <button className="btn-back" onClick={() => { setSection(s => s - 1); window.scrollTo(0,0); }}>← Back</button>}
            {section === 0 && editSubmissionId && (
              <button className="btn-back" onClick={() => { localStorage.removeItem('tema_metro_form_draft'); localStorage.removeItem('tema_metro_section'); setEditSubmissionId(null); setForm(initForm()); setFiles(DOCUMENTS.map(() => [])); }}>Cancel Edit</button>
            )}
          </div>
          <button
            className="btn-next"
            onClick={() => {
              if (section < 6) {
                handleProceedNext();
              } else {
                handleSubmit();
              }
            }}
            disabled={(section === 5 && !allUploaded) || submitting}
            style={{ opacity: ((section === 5 && !allUploaded) || submitting) ? 0.6 : 1 }}
          >
            {section < 6 ? 'Next →' : (submitting ? submittingText : 'Submit Record')}
          </button>
        </div>
      )}
      <Footer theme="light" />

      {passportCropFile && (
        <ImageCropperModal
          file={passportCropFile}
          docLabel="Passport Photo"
          onCancel={() => setPassportCropFile(null)}
          onCropComplete={(croppedFile: File) => {
            setPassportCropFile(null);
            const reader = new FileReader();
            reader.onload = () => {
              setForm(f => ({ ...f, photoUrl: reader.result as string }));
            };
            reader.readAsDataURL(croppedFile);
          }}
        />
      )}
    </div>
  );
}
