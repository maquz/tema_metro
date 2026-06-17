import { useState, useRef, useEffect } from 'react';
import { CheckCircle, ChevronDown, User, FileText, Upload, Send, X, LogOut, ShieldAlert } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import jsPDF from 'jspdf';
import { collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import ImageCropperModal from '../components/ImageCropperModal';
import Footer from '../components/Footer';

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

interface ExistingFile {
  isExisting: true;
  downloadURL: string;
  fileName: string;
  documentType: string;
}

type UploadFile = File | ExistingFile;

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

function FileUploadRow({ docLabel, index, filesList, onFilesChange, isOptional }: { docLabel: string; index: number; filesList: UploadFile[]; onFilesChange: (f: UploadFile[]) => void; isOptional?: boolean }) {
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

  const handleRemoveFile = (fileIndex: number) => {
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
            return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#D0E2FF', borderRadius: '8px', padding: '8px 12px' }}>
              <FileText size={14} color="#002147" />
              <span style={{ fontSize: '12px', color: '#002147', fontWeight: '500', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
              <button
                onClick={() => handleRemoveFile(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center' }}
              >
                <X size={14} color="#CE1126" />
              </button>
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

export default function TeacherForm() {
  const { user, role, logout } = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<FormData>({
    category: '', circuit: '', school: '', teacherName: '', sex: '', subject: 'English',
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [files, setFiles] = useState<UploadFile[][]>(DOCUMENTS.map(() => []));
  const [submitting, setSubmitting] = useState(false);
  const [submittingText, setSubmittingText] = useState('Submitting...');
  const [schoolsData, setSchoolsData] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [editSubmissionId, setEditSubmissionId] = useState<string | null>(null);

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

  const currentRole = role || 'teacher'; // Fallback for old users without roles

  useEffect(() => {
    // eslint-disable-next-line react-hooks/rules-of-hooks, @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line
    if (currentRole === 'teacher') {
      setForm(f => ({ ...f, category: 'School' }));
    } else if (currentRole === 'metro_officer') {
      setForm(f => ({ ...f, category: 'Education Office' }));
    }
  }, [currentRole]);

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
  const setFileGroup = (i: number) => (fs: UploadFile[]) => setFiles(prev => prev.map((v, idx) => idx === i ? fs : v));
  const requiredUploadedCount = files.slice(0, 4).filter(group => group.length > 0).length;
  const allUploaded = requiredUploadedCount === 4;

  const handleEditSubmission = (sub: any) => {
    setForm({
      category: sub.category,
      circuit: sub.circuit || '',
      school: sub.school || '',
      teacherName: sub.teacherName,
      sex: sub.sex || '',
      subject: sub.subject || 'English',
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
    
    setStep('form');
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

      const uploadedFiles = [];

      for (let i = 0; i < flatFiles.length; i++) {
        const { file, documentType } = flatFiles[i];
        
        if ('isExisting' in file) {
          uploadedFiles.push({ documentType, downloadURL: file.downloadURL, fileName: file.fileName });
          continue;
        }

        setSubmittingText(`Uploading document ${i + 1} of ${flatFiles.length}...`);

        let fileToUpload = file as File;
        let ext = fileToUpload.name.split('.').pop()?.toLowerCase() || 'pdf';

        // Compress if it's an image and convert to PDF
        if (fileToUpload.type.startsWith('image/')) {
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 2048,
            useWebWorker: true,
          };
          try {
            const compressedFile = await imageCompression(fileToUpload, options);

            // Read compressed image as base64
            const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(compressedFile);
            });

            // Get natural image dimensions via HTMLImageElement
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
              const image = new Image();
              image.onload = () => resolve(image);
              image.onerror = reject;
              image.src = base64Data;
            });

            // A4 page in mm with 10mm margins
            const pageW = 210;
            const pageH = 297;
            const margin = 10;
            const maxW = pageW - margin * 2;
            const maxH = pageH - margin * 2;

            // Scale image to fit inside the margin box
            const imgAspect = img.naturalWidth / img.naturalHeight;
            let drawW = maxW;
            let drawH = drawW / imgAspect;
            if (drawH > maxH) {
              drawH = maxH;
              drawW = drawH * imgAspect;
            }

            // Centre on the page
            const offsetX = (pageW - drawW) / 2;
            const offsetY = (pageH - drawH) / 2;

            // Determine image format for jsPDF
            const imgFormat = compressedFile.type === 'image/png' ? 'PNG' : 'JPEG';

            // Create PDF (units = mm, format = A4)
            const pdf = new jsPDF({ orientation: drawW > drawH ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
            pdf.addImage(base64Data, imgFormat, offsetX, offsetY, drawW, drawH);

            const pdfBlob = pdf.output('blob');
            fileToUpload = new File([pdfBlob], file.name.replace(/\.[^/.]+$/, '') + '.pdf', { type: 'application/pdf' });
            ext = 'pdf';
          } catch (error) {
            console.error('PDF conversion error:', error);
            // Fallback: upload original image if conversion fails
          }
        }

        // Rename logic: 01_Teacher Name.pdf
        const paddedIndex = String(i + 1).padStart(2, '0');
        const sanitizedTeacher = sanitizeForFilename(form.teacherName);
        const newFilename = `${paddedIndex}_${sanitizedTeacher}.${ext}`;
        const renamedFile = new File([fileToUpload], newFilename, { type: fileToUpload.type });

        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
        
        if (!cloudName || !uploadPreset || cloudName === 'your_cloudinary_cloud_name') {
          throw new Error('MISSING_CLOUDINARY_CONFIG');
        }

        const formData = new FormData();
        formData.append('file', renamedFile, newFilename);
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
          throw new Error(`Cloudinary upload failed for ${newFilename}`);
        }

        const data = await response.json();
        const downloadURL = data.secure_url;

        uploadedFiles.push({
          documentType,
          downloadURL,
          fileName: newFilename,
        });
      }

      setSubmittingText('Saving to database...');

      // Save to Firestore
      if (editSubmissionId) {
        await updateDoc(doc(db, 'submissions', editSubmissionId), {
          ...form,
          documents: uploadedFiles,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'submissions'), {
          ...form,
          documents: uploadedFiles,
          submittedBy: user?.uid ?? '',
          submittedByEmail: user?.email ?? '',
          submittedAt: serverTimestamp(),
        });
      }

      setSubmitting(false);
      setStep('success');
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

  const summaryFields = isSchool
    ? [['Circuit', form.circuit], ['School', form.school], ['Teacher', form.teacherName], ['Subject', form.subject]]
    : [['Category', form.category], ['Teacher', form.teacherName]];

  // If the user's role is not teacher, metro_officer, admin, or editor, show a clean message and a link to admin dashboard or logout
  if (currentRole !== 'teacher' && currentRole !== 'metro_officer' && currentRole !== 'admin' && currentRole !== 'editor') {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#F0F4F8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
        <div
          onClick={() => window.location.href = '/'}
          style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#002147', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', cursor: 'pointer', padding: '4px', boxShadow: '0 4px 12px rgba(0,33,71,0.25)' }}
          title="Return to Landing Page"
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
          <button
            onClick={() => window.location.href = '/admin'}
            style={{ padding: '13px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#002147', color: '#FFFFFF', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
          >
            Go to Admin Panel
          </button>
          <button
            onClick={logout}
            style={{ padding: '13px 24px', borderRadius: '12px', border: '1.5px solid #D1D5DB', backgroundColor: '#FFFFFF', color: '#374151', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
          >
            Log Out
          </button>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#F0F4F8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
        {/* Clickable Logo */}
        <div
          onClick={() => window.location.href = '/'}
          style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#002147', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', cursor: 'pointer', padding: '4px', boxShadow: '0 4px 12px rgba(0,33,71,0.3)', transition: 'box-shadow 0.2s' }}
          title="Return to Landing Page"
          onMouseOver={e => (e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,33,71,0.5)')}
          onMouseOut={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,33,71,0.3)')}
        >
          <img src="/logo.png" alt="GES Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        {/* Success checkmark */}
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#002147', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 8px 24px rgba(0,33,71,0.25)' }}>
          <CheckCircle size={36} color="#FFFFFF" strokeWidth={2.5} />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', margin: '0 0 10px', textAlign: 'center' }}>Submission Successful!</h2>
        <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', margin: '0 0 8px', lineHeight: '1.6' }}>
          Your documents have been submitted to the<br />GES Tema Metro Education Directorate.
        </p>
        <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', margin: '0 0 32px' }}>Would you like to upload another teacher's data or log off?</p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => { setStep('form'); setEditSubmissionId(null); setForm(f => ({ ...f, circuit: '', school: '', teacherName: '', sex: '', subject: 'English' })); setFiles(DOCUMENTS.map(() => [])); }}
            style={{ padding: '13px 28px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #002147, #001530)', color: '#FFFFFF', fontSize: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,33,71,0.3)' }}
          >
            Go back to Form
          </button>
          <button
            onClick={logout}
            style={{ padding: '13px 28px', borderRadius: '12px', border: '1.5px solid #D1D5DB', backgroundColor: '#FFFFFF', color: '#374151', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
          >
            Log Off
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#F0F4F8', display: 'flex', flexDirection: 'column' }}>
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
          onMouseOver={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
          onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
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

        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', position: 'relative' }}>
          {[0, 1].map(i => (
            <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', backgroundColor: (step === 'form' && i === 0) || step === 'documents' ? '#CE1126' : 'rgba(255,255,255,0.25)' }} />
          ))}
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '6px', position: 'relative' }}>
          {step === 'form' ? `Step 1 of 2 — ${currentRole === 'metro_officer' ? 'Education Officer' : 'Teacher'} Information` : 'Step 2 of 2 — Documents Checklist'}
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {step === 'form' ? (
          <>
            {mySubmissions.length > 0 && !editSubmissionId && (
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#111827', margin: '0 0 12px' }}>Your Previous Submissions</h3>
                {mySubmissions.map(sub => (
                  <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #E5E7EB', borderRadius: '8px', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#002147' }}>{sub.teacherName}</div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>{sub.category === 'School' ? `${sub.school} (${sub.circuit})` : 'Education Office'}</div>
                    </div>
                    <button onClick={() => handleEditSubmission(sub)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: '#FFF', color: '#002147', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Edit</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                <User size={16} color="#002147" />
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>{editSubmissionId ? 'Editing Record' : (currentRole === 'metro_officer' ? 'Education Officer' : 'Teacher Details')}</span>
              </div>
              
              {/* Note: The category is auto-assigned based on role, so we don't display the dropdown */}
              
              {isEducationOffice && (
                <>
                  {/* Read-only Education Office display field */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Category
                    </label>
                    <div style={{
                      width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #002147',
                      backgroundColor: '#F0F4F8', fontSize: '14px', color: '#002147', fontWeight: '600',
                      boxSizing: 'border-box',
                    }}>
                      Education Office
                    </div>
                  </div>
                  <InputField label="Teacher Name" value={form.teacherName} onChange={set('teacherName')} placeholder="Enter full name" />
                  {errors.teacherName && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.teacherName}</p>}
                </>
              )}

              {isSchool && (
                <>
                  <SelectField label="Circuit Name" value={form.circuit} onChange={set('circuit')} options={dynamicCircuits as string[]} placeholder="— Select Circuit —" />
                  {errors.circuit && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.circuit}</p>}
                  <SelectField label="School Name" value={form.school} onChange={set('school')} options={form.circuit ? getSchoolsForCircuit(form.circuit) : []} placeholder={form.circuit ? '— Select School —' : 'Select a circuit first...'} disabled={!form.circuit} />
                  {errors.school && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.school}</p>}
                  <InputField label="Teacher Name" value={form.teacherName} onChange={set('teacherName')} placeholder="Enter full name" />
                  {errors.teacherName && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.teacherName}</p>}
                  <SelectField label="Sex" value={form.sex} onChange={set('sex')} options={['Male', 'Female']} placeholder="Select Male / Female" />
                  {errors.sex && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.sex}</p>}
                  <SelectField label="Subject" value={form.subject} onChange={set('subject')} options={SUBJECTS} placeholder="— Select Subject —" />
                  {errors.subject && <p style={{ color: '#CE1126', fontSize: '12px', margin: '-12px 0 12px' }}>{errors.subject}</p>}
                </>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                {editSubmissionId && (
                  <button
                    onClick={() => { setEditSubmissionId(null); setForm(f => ({ ...f, teacherName: '', circuit: '', school: '', sex: '', subject: 'English' })); setFiles(DOCUMENTS.map(() => [])); }}
                    style={{ flex: 1, padding: '15px', borderRadius: '12px', border: '1.5px solid #D1D5DB', backgroundColor: '#FFF', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  onClick={handleProceed}
                  style={{ flex: editSubmissionId ? 2 : 1, padding: '15px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #002147, #001530)', color: '#FFFFFF', fontSize: '15px', fontWeight: '700', cursor: 'pointer', letterSpacing: '0.02em' }}
                >
                  Proceed to Documents →
                </button>
              </div>
            </div>
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
                <FileUploadRow key={i} index={i} docLabel={doc} filesList={files[i]} onFilesChange={setFileGroup(i)} isOptional={i === 4} />
              ))}
            </div>

            {/* Progress indicator */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>Required documents uploaded</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: allUploaded ? '#002147' : '#6B7280' }}>
                {requiredUploadedCount} / 4
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
              {submitting ? submittingText : (<><Send size={16} /> Submit Documents</>)}
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
      <Footer theme="light" />
    </div>
  );
}
