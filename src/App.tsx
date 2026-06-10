import { useState, useRef } from 'react';
import { CheckCircle, ChevronDown, User, FileText, Upload, Send, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const CIRCUITS = [
  'ASHAMANG', 'AWUDUM', 'COMMUNITY 11/REDEMPTION VALLEY', 'COMMUNITY 7/REPUBLIC ROAD',
  'COMMUNITY 8', 'ONINKU/MANTE-DIN', 'TWEDAASE',
];
const SCHOOLS: Record<string, string[]> = {
  'ASHAMANG': ['Ashamang D/A Primary', 'Ashamang D/A JHS', 'Ashamang R/C Primary'],
  'AWUDUM': ['Awudum D/A Primary', 'Awudum M/A JHS', 'Awudum Methodist Primary'],
  'COMMUNITY 11/REDEMPTION VALLEY': ['Comm. 11 Primary', 'Redemption Valley JHS', 'Comm. 11 M/A School'],
  'COMMUNITY 7/REPUBLIC ROAD': ['Comm. 7 Primary', 'Republic Road JHS', 'Comm. 7 Basic School'],
  'COMMUNITY 8': ['Comm. 8 Primary', 'Comm. 8 JHS', 'Comm. 8 Basic School'],
  'ONINKU/MANTE-DIN': ['Oninku Primary', 'Mante-Din JHS', 'Oninku Basic School'],
  'TWEDAASE': ['Twedaase Primary', 'Twedaase JHS', 'Twedaase M/A Basic'],
};

const CATEGORIES = ['Education Office', 'School'];
const SUBJECTS = [
  'English', 'Mathematics', 'Science', 'Social Studies', 'ICT', 'French',
  'RME', 'Creative Arts', 'Ghanaian Language', 'Physical Education'
];

const DOCUMENTS = [
  'Letter of Appointment',
  'Completed and signed Personal Record Form',
  'Certified true copies of Academic and Professional Certificates',
  'Copies of all Promotion Letters',
  'Any other relevant personnel documents relating to your career progression and status within the Service',
];

type Step = 'form' | 'documents' | 'success';

interface FormData {
  category: string;
  circuit: string;
  school: string;
  teacherName: string;
  sex: string;
  subject: string;
}

function SelectField({ label, value, onChange, options, placeholder, disabled = false }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string; disabled?: boolean;
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={{
            width: '100%', padding: '12px 40px 12px 14px', borderRadius: '10px', border: '1.5px solid',
            borderColor: value ? '#002147' : '#D1D5DB',
            backgroundColor: disabled ? '#F9FAFB' : '#FFFFFF',
            fontSize: '14px', color: value ? '#111827' : '#9CA3AF', appearance: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none', transition: 'border-color 0.15s',
          }}
        >
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={16} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid',
          borderColor: value ? '#002147' : '#D1D5DB',
          fontSize: '14px', color: '#111827', outline: 'none', transition: 'border-color 0.15s', backgroundColor: '#FFFFFF',
        }}
      />
    </div>
  );
}

function FileUploadRow({ docLabel, index, file, onFile }: { docLabel: string; index: number; file: File | null; onFile: (f: File | null) => void; }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{
      borderRadius: '12px', border: '1.5px solid', borderColor: file ? '#002147' : '#E5E7EB',
      backgroundColor: file ? '#E8F0FE' : '#FAFAFA', marginBottom: '10px', overflow: 'hidden', transition: 'all 0.15s',
    }}>
      {/* Doc label row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 12px 8px' }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '50%', border: '2px solid',
          borderColor: file ? '#002147' : '#D1D5DB', backgroundColor: file ? '#002147' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', transition: 'all 0.15s',
        }}>
          {file ? <CheckCircle size={14} color="#fff" strokeWidth={2.5} /> : <span style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF' }}>{index + 1}</span>}
        </div>
        <span style={{ fontSize: '13px', color: '#374151', fontWeight: file ? '600' : '400', lineHeight: '1.5', flex: 1 }}>
          {docLabel}
        </span>
      </div>

      {/* Upload area */}
      <div style={{ padding: '0 12px 12px' }}>
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#D0E2FF', borderRadius: '8px', padding: '8px 12px' }}>
            <FileText size={14} color="#002147" />
            <span style={{ fontSize: '12px', color: '#002147', fontWeight: '500', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </span>
            <button
              onClick={() => { onFile(null); if (ref.current) ref.current.value = ''; }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center' }}
            >
              <X size={14} color="#CE1126" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => ref.current?.click()}
            style={{
              width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px dashed #D1D5DB',
              backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '6px', cursor: 'pointer', color: '#6B7280', fontSize: '12px', fontWeight: '500',
            }}
          >
            <Upload size={14} color="#6B7280" /> Scan / Upload document
          </button>
        )}
        <input ref={ref} type="file" accept="image/*,application/pdf" capture="environment" onChange={e => onFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
      </div>
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<FormData>({
    category: '', circuit: '', school: '', teacherName: '', sex: '', subject: 'English',
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [files, setFiles] = useState<(File | null)[]>(DOCUMENTS.map(() => null));
  const [submitting, setSubmitting] = useState(false);

  const isEducationOffice = form.category === 'Education Office';
  const isSchool = form.category === 'School';

  const set = (field: keyof FormData) => (v: string) => {
    setForm(f => ({
      ...f, [field]: v,
      ...(field === 'circuit' ? { school: '' } : {}),
      ...(field === 'category' ? { circuit: '', school: '', sex: '', subject: 'English' } : {}),
    }));
    setErrors(e => ({ ...e, [field]: '' }));
  };

  const validate = () => {
    const e: Partial<FormData> = {};
    if (!form.category) e.category = 'Required';
    if (!form.teacherName.trim()) e.teacherName = 'Required';
    if (isSchool) {
      if (!form.circuit) e.circuit = 'Required';
      if (!form.school) e.school = 'Required';
      if (!form.sex) e.sex = 'Required';
      if (!form.subject) e.subject = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleProceed = () => { if (validate()) setStep('documents'); };
  const setFile = (i: number) => (f: File | null) => setFiles(prev => prev.map((v, idx) => idx === i ? f : v));
  const allUploaded = files.every(Boolean);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const uploadPromises = files.map(async (file, index) => {
        if (!file) return null;
        let fileToUpload = file;

        // Compress if it's an image
        if (file.type.startsWith('image/')) {
          const options = {
            maxSizeMB: 0.5, // 500KB max
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };
          try {
            fileToUpload = await imageCompression(file, options);
          } catch (error) {
            console.error('Compression error:', error);
            // Fallback to original file if compression fails
          }
        }

        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
        
        if (!cloudName || !uploadPreset) {
          throw new Error('Cloudinary configuration missing in .env');
        }

        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('upload_preset', uploadPreset);
        
        const folderPath = form.category === 'Education Office' 
          ? `ges-tema/Education Office/${form.teacherName}`
          : `ges-tema/${form.circuit}/${form.school}/${form.teacherName}`;
        formData.append('folder', folderPath);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Cloudinary upload failed');
        }

        const data = await response.json();
        const downloadURL = data.secure_url;

        return {
          documentType: DOCUMENTS[index],
          downloadURL,
          fileName: fileToUpload.name,
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      // Save to Firestore
      await addDoc(collection(db, 'submissions'), {
        ...form,
        documents: uploadedFiles.filter(Boolean),
        submittedAt: serverTimestamp(),
      });

      setSubmitting(false);
      setStep('success');
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('There was an error submitting your form. Please try again.');
      setSubmitting(false);
    }
  };

  const summaryFields = isSchool
    ? [['Circuit', form.circuit], ['School', form.school], ['Teacher', form.teacherName], ['Subject', form.subject]]
    : [['Category', form.category], ['Teacher', form.teacherName]];

  if (step === 'success') {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#F0F4F8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#002147', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
          <CheckCircle size={36} color="#FFFFFF" strokeWidth={2.5} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#111827', margin: '0 0 8px', textAlign: 'center' }}>Submission Successful!</h2>
        <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', margin: '0 0 28px', lineHeight: '1.6' }}>
          Your documents have been submitted to the<br />GES Tema Metro Education Directorate.
        </p>
        <button
          onClick={() => { setStep('form'); setForm({ category: '', circuit: '', school: '', teacherName: '', sex: '', subject: 'English' }); setFiles(DOCUMENTS.map(() => null)); }}
          style={{ padding: '13px 32px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #002147, #001530)', color: '#FFFFFF', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
        >
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#F0F4F8' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #002147 0%, #001530 100%)', padding: '24px 20px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: '-30px', left: '-10px', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.04)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '2px', overflow: 'hidden' }}>
            <img src="/logo.png" alt="GES Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ghana Education Service</div>
            <div style={{ fontSize: '15px', color: '#FFFFFF', fontWeight: '700', lineHeight: '1.2', marginTop: '2px' }}>Tema Metro Education</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: '500' }}>Directorate</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', position: 'relative' }}>
          {[0, 1].map(i => (
            <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', backgroundColor: (step === 'form' && i === 0) || step === 'documents' ? '#CE1126' : 'rgba(255,255,255,0.25)' }} />
          ))}
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '6px', position: 'relative' }}>
          {step === 'form' ? 'Step 1 of 2 — Teacher Information' : 'Step 2 of 2 — Documents Checklist'}
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {step === 'form' ? (
          <>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                <User size={16} color="#002147" />
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Teacher Details</span>
              </div>
              <SelectField label="Category" value={form.category} onChange={set('category')} options={CATEGORIES} placeholder="— Select Category —" />
              {errors.category && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.category}</p>}

              {isEducationOffice && (
                <>
                  <InputField label="Teacher Name" value={form.teacherName} onChange={set('teacherName')} placeholder="Enter full name" />
                  {errors.teacherName && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.teacherName}</p>}
                </>
              )}

              {isSchool && (
                <>
                  <SelectField label="Circuit Name" value={form.circuit} onChange={set('circuit')} options={CIRCUITS} placeholder="— Select Circuit —" />
                  {errors.circuit && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.circuit}</p>}
                  <SelectField label="School Name" value={form.school} onChange={set('school')} options={form.circuit ? SCHOOLS[form.circuit] || [] : []} placeholder={form.circuit ? '— Select School —' : 'Select a circuit first...'} disabled={!form.circuit} />
                  {errors.school && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.school}</p>}
                  <InputField label="Teacher Name" value={form.teacherName} onChange={set('teacherName')} placeholder="Enter full name" />
                  {errors.teacherName && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.teacherName}</p>}
                  <SelectField label="Sex" value={form.sex} onChange={set('sex')} options={['Male', 'Female']} placeholder="Select Male / Female" />
                  {errors.sex && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.sex}</p>}
                  <SelectField label="Subject" value={form.subject} onChange={set('subject')} options={SUBJECTS} placeholder="— Select Subject —" />
                  {errors.subject && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.subject}</p>}
                </>
              )}

              {!form.category && (
                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '4px 0 0', textAlign: 'center' }}>Select a category to continue</p>
              )}
            </div>

            {form.category && (
              <button
                onClick={handleProceed}
                style={{ width: '100%', padding: '15px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #002147, #001530)', color: '#FFFFFF', fontSize: '15px', fontWeight: '700', cursor: 'pointer', letterSpacing: '0.02em' }}
              >
                Proceed to Documents →
              </button>
            )}
          </>
        ) : (
          <>
            {/* Summary card */}
            <div style={{ backgroundColor: '#002147', borderRadius: '14px', padding: '16px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {summaryFields.map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div style={{ fontSize: '13px', color: '#FFFFFF', fontWeight: '600', marginTop: '2px' }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Documents with upload */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <FileText size={16} color="#002147" />
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Documents to be Scanned</span>
              </div>
              <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px', marginTop: '4px' }}>
                Scan or upload each document using your camera or file picker.
              </p>
              {DOCUMENTS.map((doc, i) => (
                <FileUploadRow key={i} index={i} docLabel={doc} file={files[i]} onFile={setFile(i)} />
              ))}
            </div>

            {/* Progress indicator */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>Documents uploaded</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: allUploaded ? '#002147' : '#6B7280' }}>
                {files.filter(Boolean).length} / {DOCUMENTS.length}
              </span>
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit} disabled={!allUploaded || submitting}
              style={{
                width: '100%', padding: '15px', borderRadius: '12px', border: 'none',
                background: allUploaded ? 'linear-gradient(135deg, #002147, #001530)' : '#E5E7EB',
                color: allUploaded ? '#FFFFFF' : '#9CA3AF', fontSize: '15px', fontWeight: '700', cursor: allUploaded ? 'pointer' : 'not-allowed',
                marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.15s',
              }}
            >
              {submitting ? 'Submitting…' : (<><Send size={16} /> Submit Documents</>)}
            </button>
            <button
              onClick={() => setStep('form')}
              style={{ width: '100%', padding: '13px', borderRadius: '12px', border: '1.5px solid #D1D5DB', backgroundColor: '#FFFFFF', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            >
              ← Back to Form
            </button>
          </>
        )}
      </div>
    </div>
  );
}
