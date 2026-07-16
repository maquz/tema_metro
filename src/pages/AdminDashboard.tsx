import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, getDocs } from 'firebase/firestore';
import { auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Summary } from './TeacherForm';
import { PersonalRecordPDF } from '../components/PersonalRecordPDF';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import Footer from '../components/Footer';
import { 
  LogOut, Users, FileText, Activity, Search, Download, 
  ChevronRight, ExternalLink, BarChart3, TrendingUp, GraduationCap, Building2, ShieldCheck,
  Pencil, Trash2, FolderDown, Plus, KeyRound, X, Save, Share2, Printer, Menu, Phone, Eye
} from 'lucide-react';

const CIRCUITS = [
  'ASHAMANG', 'AWUDUM', 'COMMUNITY 11/REDEMPTION VALLEY', 'COMMUNITY 7/REPUBLIC ROAD',
  'COMMUNITY 8', 'ONINKU/MANTE-DIN', 'TWEDAASE',
];

const DEFAULT_SCHOOLS: Record<string, string[]> = {
  'ASHAMANG': ['MANHEAN METHODIST BASIC SCHOOL', 'MANHEAN S.D.A BASIC SCHOOL', 'MANHEAN TMA PRIMARY \'A\'', 'MANHEAN TMA PRIMARY \'B\'', 'NAVAL BASE JHS', 'NAVAL BASE PRE-SCHOOL', 'NAVAL BASE PRIMARY', 'NII ADJETEY ANSAH MEMORIAL J.H.S', 'ST. PETERS CATHOLIC BASIC SCHOOL'],
  'AWUDUM': ['MANHEAN ANGLICAN \'A\' & \'B\' PRIMARY', 'MANHEAN ANGLICAN D PRIMARY SCHOOL', 'MANHEAN ANGLICAN JHS', 'MANHEAN ANGLICAN PRIMARY \'C\'', 'MANHEAN COMMUNITY PRIMARY', 'MANHEAN PRESBY PRIMARY \'A\' SCHOOL', 'MANHEAN PRESBY PRIMARY \'B\' SCHOOL', 'MANHEAN TMA 1 JHS', 'MANHEAN TMA 2 JHS'],
  'COMMUNITY 11/REDEMPTION VALLEY': ['COMMUNITY 11 COMPLEX J.H.S.', 'COMMUNITY 11 COMPLEX PRIMARY \'B\' & KG', 'RAHMANIYYA ISLAMIC BASIC SCHOOL', 'REDEMPTION VALLEY PRIMARY AND K.G', 'COMMUNITY 11 COMPLEX PRIMARY \'A\' & KG', 'REDEMPTION VALLEY BASIC SCHOOL'],
  'COMMUNITY 7/REPUBLIC ROAD': ['COMMUNITY 4NO2 PRIMARY SCHOOL', 'COMMUNITY 7 NO.1 BASIC SCHOOL', 'COMMUNITY 7 NO.2 J.H.S', 'COMMUNITY 7 NO.2 PRIMARY SCHOOL', 'NAYLOR SDA SCHOOL', 'REPUBLIC ROAD J.H.S', 'COMMUNITY 8 NO 1 PRIMARY SCHOOL'],
  'COMMUNITY 8': ['COMMUNITY 8 NO.1 JHS', 'COMMUNITY 8 NO.2 J.H.S', 'COMMUNITY 8 NO.3 J.H.S', 'COMMUNITY 8 NO.3 PRIMARY', 'COMMUNITY 8 NO.4 J.H.S', 'COMMUNITY 8 NO.4 PRIMARY SCHOOL'],
  'ONINKU/MANTE-DIN': ['COMMUNITY 1 PRESBY PRIMARY SCHOOL', 'MANTE-DIN DRIVE BASIC', 'ONINKU DRIVE 1 J.H.S', 'ONINKU DRIVE 2 JUNIOR HIGH SCHOOL', 'ONINKU DRIVE PRIMARY', 'ST. ALBAN ANGLICAN BASIC SCHOOL'],
  'TWEDAASE': ['AKODZO J.H.S', 'LORENZE WOLF JHS', 'PADMORE STREET PRIMARY SCHOOL', 'ST. PAUL METHODIST J.H.S.', 'TWEDAASE J.H.S', 'TWEDAASE PRIMARY SCHOOL'],
};

const DOCUMENTS = [
  'Letter of Appointment',
  'Completed and signed Personal Record Form',
  'Certified true copies of Academic and Professional Certificates',
  'Copies of all Promotion Letters',
  'Any other relevant personnel documents relating to your career progression and status within the Service',
];

const DOCUMENT_ORDER = [
  'Copies of all Promotion Letters',
  'Completed and signed Personal Record Form',
  'Certified true copies of Academic and Professional Certificates',
  'Letter of Appointment',
  'Any other relevant personnel documents relating to your career progression and status within the Service',
];

const createCombinedPDF = async (sub: any): Promise<Uint8Array | null> => {
  if (!sub.documents || sub.documents.length === 0) return null;
  const mergedPdf = await PDFDocument.create();
  
  for (const docName of DOCUMENT_ORDER) {
    const docItems = sub.documents.filter((d: any) => d.documentType === docName);
    for (const docItem of docItems) {
      try {
        const response = await fetch(docItem.downloadURL);
        if (!response.ok) continue;
        const arrayBuffer = await response.arrayBuffer();
        
        const contentType = response.headers.get('content-type') || '';
        const fileName = docItem.fileName || '';
        const lowerName = fileName.toLowerCase();
        
        if (contentType.includes('pdf') || lowerName.endsWith('.pdf')) {
          try {
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
          } catch (pdfErr) {
            console.error('Could not parse PDF:', pdfErr);
          }
        } else if (
          contentType.includes('image/jpeg') || contentType.includes('image/png') ||
          lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png')
        ) {
          try {
            let image;
            if (contentType.includes('image/png') || lowerName.endsWith('.png')) {
              image = await mergedPdf.embedPng(arrayBuffer);
            } else {
              image = await mergedPdf.embedJpg(arrayBuffer);
            }
            
            const page = mergedPdf.addPage([595.28, 841.89]); // A4
            const { width, height } = page.getSize();
            const imgDims = image.scaleToFit(width - 40, height - 40);
            page.drawImage(image, {
              x: width / 2 - imgDims.width / 2,
              y: height / 2 - imgDims.height / 2,
              width: imgDims.width,
              height: imgDims.height,
            });
          } catch (imgErr) {
            console.error('Could not embed Image:', imgErr);
          }
        }
      } catch (e) {
        console.error('Error fetching document:', e);
      }
    }
  }
  return mergedPdf.getPageCount() > 0 ? await mergedPdf.save() : null;
};

export default function AdminDashboard() {
  const { user, role, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'submissions' | 'users' | 'analytics' | 'schools' | 'bulk-download' | 'drafts'>('submissions');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Data States
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<{ staffId: string, duplicates: any[], keep: any }[]>([]);
  const [deletedDuplicatesList, setDeletedDuplicatesList] = useState<any[]>([]);
  
  // Filtering & Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [draftSearchTerm, setDraftSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCircuit, setFilterCircuit] = useState('');
  const filterSubject = '';
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected rows
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());

  // Selected submission modal
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Edit modal state
  const [editSub, setEditSub] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving] = useState(false);

  // Delete confirmation state
  const [deleteSub, setDeleteSub] = useState<any | null>(null);
  const [deleting] = useState(false);

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkZipProgress, setBulkZipProgress] = useState<{ current: number; total: number; batch: number; totalBatches: number } | null>(null);

  // User Management State
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [editUserModal, setEditUserModal] = useState<any | null>(null);
  const [editUserRole, setEditUserRole] = useState('');
  const [editUserSaving, setEditUserSaving] = useState(false);
  const [resetEmailSending, setResetEmailSending] = useState<string | null>(null);

  // Schools Management State
  const [schoolsData, setSchoolsData] = useState<any[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [newSchool, setNewSchool] = useState({ circuit: '', school: '' });
  const [editSchoolId, setEditSchoolId] = useState<string | null>(null);
  const [editSchoolData, setEditSchoolData] = useState({ circuit: '', school: '' });
  const [bulkStaffIds, setBulkStaffIds] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [bulkMatchedSubs, setBulkMatchedSubs] = useState<any[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [bulkNotFoundItems, setBulkNotFoundItems] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('newest');
  
  // Pagination State
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    setBulkMatchedSubs(prev => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map(p => {
        const up = submissions.find(s => s.id === p.id);
        if (up && up !== p) {
          changed = true;
          return up;
        }
        return p;
      });
      return changed ? next : prev;
    });
  }, [submissions]);

  // Real-time Firestore Listeners
  useEffect(() => {
    const unsubSubmissions = onSnapshot(collection(db, 'submissions'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by submittedAt descending
      data.sort((a: any, b: any) => {
        const timeA = a.submittedAt?.seconds || 0;
        const timeB = b.submittedAt?.seconds || 0;
        return timeB - timeA;
      });
      setSubmissions(data);
      setFetchError(null);
    }, (err) => {
      console.error("Firestore onSnapshot Error:", err);
      setFetchError(err.message || 'Unknown Firestore Error');
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
    });

    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchoolsData(data);
    });

    return () => {
      unsubSubmissions();
      unsubUsers();
      unsubSchools();
    };
  }, []);

  const fetchSubmissions = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'submissions'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => {
        const timeA = a.submittedAt?.seconds || 0;
        const timeB = b.submittedAt?.seconds || 0;
        return timeB - timeA;
      });
      setSubmissions(data);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'N/A';
    if (ts.toDate) {
      return ts.toDate().toLocaleString();
    }
    if (ts.seconds) {
      return new Date(ts.seconds * 1000).toLocaleString();
    }
    return new Date(ts).toLocaleString();
  };

  const isUserActive = (userDoc: any) => {
    if (!userDoc.isOnline) return false;
    if (!userDoc.lastActive) return false;
    
    // Check if heartbeat is within last 5 minutes
    const lastActiveDate = new Date(userDoc.lastActive);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastActiveDate > fiveMinutesAgo;
  };

  // Filter out true drafts first so they don't bloat the total counts
  const validSubmissions = submissions.filter((sub: any) => {
    const isDraft = sub.status === 'draft' && (!sub.documents || sub.documents.length === 0);
    return !isDraft;
  });

  const draftSubmissions = submissions.filter((sub: any) => {
    const isDraft = sub.status === 'draft' && (!sub.documents || sub.documents.length === 0);
    return isDraft;
  });

  const filteredDrafts = draftSubmissions.filter((sub: any) => {
    const matchesSearch = draftSearchTerm === '' ? true : (
      (sub.teacherName?.toLowerCase() || '').includes(draftSearchTerm.toLowerCase()) ||
      (sub.staffId?.toLowerCase() || '').includes(draftSearchTerm.toLowerCase())
    );
    return matchesSearch;
  });

  // Submissions Filtering logic
  const filteredSubmissions = validSubmissions.filter((sub: any) => {
    const matchesSearch = searchTerm === '' ? true : (
      (sub.teacherName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (sub.staffId?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
    const matchesCategory = filterCategory ? sub.category === filterCategory : true;
    const matchesCircuit = filterCircuit ? sub.circuit === filterCircuit : true;
    const matchesSubject = filterSubject ? sub.subject === filterSubject : true;
    
    let matchesDate = true;
    if (sub.submittedAt) {
      const subDate = sub.submittedAt.toDate ? sub.submittedAt.toDate() : new Date(sub.submittedAt);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        if (subDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23,59,59,999);
        if (subDate > end) matchesDate = false;
      }
    }
    
    return matchesSearch && matchesCategory && matchesCircuit && matchesSubject && matchesDate;
  }).sort((a: any, b: any) => {
    if (sortBy === 'newest') return (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0);
    if (sortBy === 'oldest') return (a.submittedAt?.seconds || 0) - (b.submittedAt?.seconds || 0);
    if (sortBy === 'name') return (a.teacherName || '').localeCompare(b.teacherName || '');
    if (sortBy === 'staffId') return (a.staffId || '').localeCompare(b.staffId || '');
    if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
    return 0;
  });

  const handleExportCSV = () => {
    const exportData = filteredSubmissions.map((sub: any) => {
      const docUrls: Record<string, string> = {};
      DOCUMENTS.forEach((docName) => {
        const docObj = sub.documents?.find((d: any) => d.documentType === docName);
        docUrls[docName] = docObj ? docObj.downloadURL : 'Not Uploaded';
      });

      return {
        'Teacher Name': sub.teacherName || '',
        'Sex': sub.sex || 'N/A',
        'Category': sub.category || '',
        'Circuit': sub.circuit || 'N/A',
        'School': sub.school || 'N/A',
        'Subject': sub.subject || 'N/A',
        'Submitted At': formatTimestamp(sub.submittedAt),
        'Submitted By Email': sub.submittedByEmail || 'N/A',
        'Teachers Licence No.': sub.teachersLicence || 'N/A',
        ...docUrls
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `GES_Tema_Submissions_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const handleOpenEditUser = (u: any) => {
    setEditUserModal(u);
    setEditUserRole(u.role || 'teacher');
  };

  const handleSaveEditUser = async () => {
    if (!editUserModal) return;
    setEditUserSaving(true);
    try {
      await updateDoc(doc(db, 'users', editUserModal.id), { role: editUserRole });
      setEditUserModal(null);
    } catch (err) {
      console.error('Error saving user:', err);
      alert('Failed to save changes.');
    }
    setEditUserSaving(false);
  };

  const handleSendPasswordReset = async (email: string) => {
    if (!email) return;
    setResetEmailSending(email);
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Password reset email sent to ${email}`);
    } catch (err: any) {
      console.error('Password reset error:', err);
      alert(`Failed to send password reset email: ${err.message}`);
    }
    setResetEmailSending(null);
  };

  const handleOpenEdit = (sub: any) => {
    setEditSub(sub);
    setEditForm({
      teacherName: sub.teacherName || '',
      staffId: sub.staffId || '',
      category: sub.category || 'BASIC SCHOOL',
      circuit: sub.circuit || '',
      school: sub.school || '',
      subject: sub.subject || '',
      sex: sub.sex || '',
      currentRank: sub.currentRank || '',
    });
  };

  const handleSaveEdit = () => {
    if (!editSub) return;
    const subToUpdate = editSub;
    const dataToUpdate = editForm;
    setEditSub(null); // Optimistic UI: close modal instantly
    
    // Update runs in the background
    updateDoc(doc(db, 'submissions', subToUpdate.id), dataToUpdate).catch(err => {
      console.error('Error updating submission:', err);
      alert(`Failed to save changes: ${(err as any).message || 'Please try again.'}`);
    });
  };

  const handleDelete = () => {
    if (!deleteSub) return;
    const subToDelete = deleteSub;
    setDeleteSub(null); // Optimistic UI: close modal instantly
    
    // Deletion runs in the background. With localCache enabled,
    // onSnapshot will instantly update the UI.
    deleteDoc(doc(db, 'submissions', subToDelete.id)).catch(err => {
      console.error('Error deleting submission:', err);
      alert('Failed to delete record. Please try again.');
    });
  };

  const handleDownloadAll = async (sub: any) => {
    if (!sub.documents || sub.documents.length === 0) {
      alert('No documents available to download.');
      return;
    }
    setDownloadingId(sub.id);
    try {
      const pdfBytes = await createCombinedPDF(sub);
      if (pdfBytes) {
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        const safeId = (sub.staffId || 'NO_ID').replace(/[^a-zA-Z0-9- _]/g, '');
        const safeName = (sub.teacherName || 'Teacher').replace(/[^a-zA-Z0-9- _]/g, '');
        saveAs(blob, `${safeId}_${safeName}.pdf`);
      } else {
        alert('Could not combine documents.');
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to create PDF file. Please try again.');
    }
    setDownloadingId(null);
  };

  const handleGeneratePDF = async (sub: any, action: 'download' | 'print') => {
    if (!pdfRef.current) return;
    setIsGeneratingPDF(true);
    try {
      // Temporarily make the ref visible if needed, or rely on html2canvas to render it off-screen
      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // If content is longer than A4, split into multiple pages
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      if (action === 'download') {
        pdf.save(`GES_Personal_Record_${sub.staffId || 'NO_ID'}_${sub.teacherName || ''}.pdf`);
      } else if (action === 'print') {
        pdf.autoPrint();
        window.open(pdf.output('bloburl'), '_blank');
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const downloadZippedSubmissions = async (targetSubmissions: any[], zipFilename: string) => {
    if (targetSubmissions.length === 0) {
      alert('No submissions available to download.');
      return;
    }
    
    const validSubs = targetSubmissions.filter(sub => sub.documents && sub.documents.length > 0);
    if (validSubs.length === 0) {
      alert('No documents found in the selected submissions.');
      return;
    }
    
    if (!window.confirm(`Are you sure you want to download and combine documents for ${validSubs.length} submissions? This may take several minutes depending on the number of records.`)) {
      return;
    }

    setBulkDownloading(true);
    setBulkZipProgress({ current: 0, total: validSubs.length, batch: 1, totalBatches: 1 });
    
    try {
      let processedSubs = 0;
      const zip = new JSZip();

      const dateStr = new Date().toISOString().slice(0, 10);
      const rootFolder = zip.folder(`GES_Submissions_${dateStr}`);

      for (let i = 0; i < validSubs.length; i++) {
        const sub = validSubs[i];
        try {
          const pdfBytes = await createCombinedPDF(sub);
          if (pdfBytes) {
            const schoolFolder = sub.category !== 'Education Office' ? (sub.school || 'Unknown_School') : 'Education_Office';
            const safeSchoolFolder = schoolFolder.replace(/[^a-zA-Z0-9- _]/g, '');
            const safeTeacherName = `${sub.teacherName || 'Teacher'}`.replace(/[^a-zA-Z0-9- _]/g, '');
            const safeId = (sub.staffId || 'NO_ID').replace(/[^a-zA-Z0-9- _]/g, '');
            
            rootFolder?.folder(safeSchoolFolder)?.file(`${safeId}_${safeTeacherName}.pdf`, pdfBytes);
          }
        } catch (e) {
          console.error('Error processing submission for ZIP:', e);
        } finally {
          processedSubs++;
          setBulkZipProgress({ current: processedSubs, total: validSubs.length, batch: 1, totalBatches: 1 });
        }
      }
      
      const content = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      saveAs(content, `${zipFilename}.zip`);
      alert(`Successfully downloaded ${validSubs.length} combined PDFs.`);
    } catch (err: any) {
      console.error('Bulk download error:', err);
      alert(`Failed to create bulk ZIP file. Error: ${err?.message || String(err)}`);
    } finally {
      setBulkDownloading(false);
      setBulkZipProgress(null);
    }
  };

  const handleDownloadAllSubmissions = async () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    await downloadZippedSubmissions(filteredSubmissions, `Bulk_Submissions_${dateStr}`);
  };

  const handleDownloadSelectedSubmissions = async () => {
    const selectedList = filteredSubmissions.filter(s => selectedSubs.has(s.id));
    const dateStr = new Date().toISOString().slice(0, 10);
    await downloadZippedSubmissions(selectedList, `Selected_Submissions_${dateStr}`);
  };

  // State for circuit and school bulk download
  const [downloadCircuit, setDownloadCircuit] = useState('');
  const [downloadSchool, setDownloadSchool] = useState('');
  const [downloadRank, setDownloadRank] = useState('');
  const [downloadCategory, setDownloadCategory] = useState('');

  const handleCleanDuplicates = () => {
    const groups: Record<string, any[]> = {};
    submissions.forEach(sub => {
      if (!sub.staffId) return;
      const normalizedId = sub.staffId.replace(/\s+/g, '').toUpperCase();
      if (!groups[normalizedId]) {
        groups[normalizedId] = [];
      }
      groups[normalizedId].push(sub);
    });

    const duplicates: { staffId: string, duplicates: any[], keep: any }[] = [];
    
    for (const staffId in groups) {
      const docs = groups[staffId];
      if (docs.length > 1) {
        docs.sort((a, b) => {
          const timeA = new Date(a.submittedAt).getTime();
          const timeB = new Date(b.submittedAt).getTime();
          return timeB - timeA; // Newest first
        });
        
        duplicates.push({ staffId, keep: docs[0], duplicates: docs.slice(1) });
      }
    }

    if (duplicates.length === 0) {
      alert("No duplicates found.");
      return;
    }

    setDuplicateGroups(duplicates);
    setDeletedDuplicatesList([]);
    setShowDuplicatesModal(true);
  };

  const confirmDeleteDuplicates = async () => {
    if (!window.confirm(`Are you sure you want to delete all older duplicates? This action cannot be undone.`)) return;
    setCleaningDuplicates(true);
    try {
      const deleted: any[] = [];
      for (const group of duplicateGroups) {
        for (const docObj of group.duplicates) {
          await deleteDoc(doc(db, 'submissions', docObj.id));
          deleted.push(docObj);
        }
      }
      setDeletedDuplicatesList(deleted);
      setDuplicateGroups([]);
      fetchSubmissions();
    } catch (error) {
      console.error('Error cleaning duplicates:', error);
      alert('Error cleaning duplicates.');
    } finally {
      setCleaningDuplicates(false);
    }
  };

  const handleBulkDownloadByCircuit = async () => {
    if (!downloadCircuit) return alert('Please select a circuit.');
    const circuitSubs = submissions.filter(s => s.circuit === downloadCircuit);
    const dateStr = new Date().toISOString().split('T')[0];
    await downloadZippedSubmissions(circuitSubs, `Circuit_${downloadCircuit.replace(/[^a-zA-Z0-9- _]/g, '')}_${dateStr}`);
  };

  const handleBulkDownloadByCategory = async () => {
    if (!downloadCategory) return alert('Please select a category.');
    const categorySubs = submissions.filter(s => s.category === downloadCategory);
    const dateStr = new Date().toISOString().split('T')[0];
    await downloadZippedSubmissions(categorySubs, `Category_${downloadCategory.replace(/[^a-zA-Z0-9- _]/g, '')}_${dateStr}`);
  };

  const handleBulkDownloadBySchool = async () => {
    if (!downloadSchool) return alert('Please select a school.');
    const schoolSubs = submissions.filter(s => s.school === downloadSchool);
    const dateStr = new Date().toISOString().slice(0, 10);
    await downloadZippedSubmissions(schoolSubs, `School_${downloadSchool.replace(/[^a-zA-Z0-9- _]/g, '')}_${dateStr}`);
  };

  const handleBulkDownloadByRank = async () => {
    if (!downloadRank) return alert('Please select a rank.');
    const rankSubs = submissions.filter(s => s.currentRank === downloadRank);
    const dateStr = new Date().toISOString().slice(0, 10);
    await downloadZippedSubmissions(rankSubs, `Rank_${downloadRank.replace(/[^a-zA-Z0-9- _]/g, '')}_${dateStr}`);
  };

  const dynamicCircuits = Array.from(new Set(schoolsData.map((s: any) => s.circuit))).sort();
  const displayCircuits = dynamicCircuits.length > 0 ? dynamicCircuits : CIRCUITS;
  const displayRanks = [
    'Director II', 'Deputy Director', 'Assistant Director I', 'Assistant Director II', 
    'Principal Superintendent', 'Senior Superintendent I', 'Senior Superintendent II', 
    'Superintendent I', 'Superintendent II', 'Pupil Teacher'
  ];

  // Metrics calculations
  const totalSubmissions = submissions.length;
  
  const totalUsers = users.length;
  const activeUsersCount = users.filter(isUserActive).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F3F4F6', color: '#111827', fontFamily: 'system-ui, sans-serif' }}>
      {/* Bulk Download Progress Modal */}
      {bulkDownloading && bulkZipProgress && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', textAlign: 'center', width: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '20px', color: '#002147' }}>Downloading Data...</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0 0 8px', fontSize: '14px', fontWeight: '600' }}>
              <span style={{ color: '#10B981' }}>Downloaded: {bulkZipProgress.current}</span>
              <span style={{ color: '#6B7280' }}>Yet to download: {bulkZipProgress.total - bulkZipProgress.current}</span>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#E5E7EB', borderRadius: '5px', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ width: `${(bulkZipProgress.current / bulkZipProgress.total) * 100}%`, height: '100%', backgroundColor: '#10B981', transition: 'width 0.2s' }}></div>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>Please wait, compressing into a single ZIP file.</p>
          </div>
        </div>
      )}

      {/* Top Banner Header */}
      <header style={{ position: 'sticky', top: 0, background: '#002147', color: '#FFFFFF', padding: '12px 24px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 }}>
        {/* Left: Hamburger + Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            <Menu size={24} />
          </button>
          <div 
            onClick={() => window.location.href = '/'}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '4px', borderRadius: '8px', transition: 'background-color 0.2s' }}
            title="Click to Refresh & Return to Landing Page"
            onMouseOver={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
            onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', overflow: 'hidden' }}>
              <img src="/logo.png" alt="GES Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{}}>
              <h1 style={{ fontSize: '16px', fontWeight: '800', margin: 0, lineHeight: '1.1' }}>Tema Metro Directorate</h1>
              <div style={{ fontSize: '11px', color: '#CE1126', fontWeight: '700', textTransform: 'uppercase' }}>Admin Panel</div>
            </div>
          </div>
        </div>
        
        {/* Center: Global Search */}
        <div style={{ flex: '0 1 500px', margin: '0 24px', position: 'relative' }}>
          <Search size={16} color="#6B7280" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            placeholder="Search teachers..." 
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '20px', border: 'none', fontSize: '14px', backgroundColor: '#F3F4F6', color: '#111827', outline: 'none' }}
          />
        </div>

        {/* Right: User + Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '13px', fontWeight: '600' }}>{user?.email}</span>
            <span style={{ fontSize: '10px', backgroundColor: '#CE1126', color: '#FFF', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '2px' }}>
              {role}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              onClick={() => window.location.href = '/teacher'}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1.5px solid rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFF', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            >
              <FileText size={14} /> <span>Submission Form</span>
            </button>
            <button 
              onClick={logout}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1.5px solid rgba(255,255,255,0.2)', backgroundColor: 'transparent', color: '#FFF', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <aside style={{ 
          width: sidebarOpen ? '260px' : '0px', 
          backgroundColor: '#FFFFFF', 
          borderRight: '1px solid #E5E7EB', 
          transition: 'width 0.3s ease', 
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '260px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', paddingLeft: '16px' }}>Main Menu</div>
            <button
              onClick={() => setActiveTab('submissions')}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: activeTab === 'submissions' ? '#F3F4F6' : 'transparent', color: activeTab === 'submissions' ? '#002147' : '#4B5563', fontWeight: activeTab === 'submissions' ? '700' : '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}
            >
              <FileText size={18} color={activeTab === 'submissions' ? '#002147' : '#9CA3AF'} /> Submissions
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: activeTab === 'drafts' ? '#F3F4F6' : 'transparent', color: activeTab === 'drafts' ? '#002147' : '#4B5563', fontWeight: activeTab === 'drafts' ? '700' : '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}
            >
              <FileText size={18} color={activeTab === 'drafts' ? '#002147' : '#9CA3AF'} /> Incomplete Drafts
            </button>
            <button
              onClick={() => setActiveTab('users')}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: activeTab === 'users' ? '#F3F4F6' : 'transparent', color: activeTab === 'users' ? '#002147' : '#4B5563', fontWeight: activeTab === 'users' ? '700' : '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}
            >
              <Users size={18} color={activeTab === 'users' ? '#002147' : '#9CA3AF'} /> System Users
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: activeTab === 'analytics' ? '#F3F4F6' : 'transparent', color: activeTab === 'analytics' ? '#002147' : '#4B5563', fontWeight: activeTab === 'analytics' ? '700' : '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}
            >
              <BarChart3 size={18} color={activeTab === 'analytics' ? '#002147' : '#9CA3AF'} /> Analytics
            </button>
            <button
              onClick={() => { setActiveTab('schools'); setSidebarOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: activeTab === 'schools' ? '#F3F4F6' : 'transparent', color: activeTab === 'schools' ? '#002147' : '#4B5563', fontWeight: activeTab === 'schools' ? '700' : '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}
            >
              <Building2 size={18} color={activeTab === 'schools' ? '#002147' : '#9CA3AF'} /> Schools
            </button>
            <button
              onClick={() => { setActiveTab('bulk-download'); setSidebarOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: activeTab === 'bulk-download' ? '#F3F4F6' : 'transparent', color: activeTab === 'bulk-download' ? '#002147' : '#4B5563', fontWeight: activeTab === 'bulk-download' ? '700' : '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}
            >
              <FolderDown size={18} color={activeTab === 'bulk-download' ? '#002147' : '#9CA3AF'} /> Bulk Select & Download
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          
          {/* Stats Overview */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFFFFF', padding: '10px 16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Activity size={18} color="#10B981" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', color: '#6B7280', textTransform: 'uppercase', fontWeight: '600' }}>Users Online</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#002147' }}>{activeUsersCount} <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 'normal' }}>/ {totalUsers} total</span></span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFFFFF', padding: '10px 16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <FileText size={18} color="#002147" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', color: '#6B7280', textTransform: 'uppercase', fontWeight: '600' }}>Submissions</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#002147' }}>{totalSubmissions}</span>
              </div>
            </div>
          </div>

          {/* Tab CONTENT 1: SUBMISSIONS MONITOR */}
          {activeTab === 'submissions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Action Buttons Container */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={handleExportCSV}
                  disabled={filteredSubmissions.length === 0}
                  style={{ padding: '11px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#CE1126', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: filteredSubmissions.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', opacity: filteredSubmissions.length === 0 ? 0.6 : 1 }}
                >
                  <Download size={14} /> Export CSV
                </button>
                <button
                  onClick={handleDownloadSelectedSubmissions}
                  disabled={selectedSubs.size === 0 || bulkDownloading}
                  style={{ padding: '11px 16px', borderRadius: '8px', border: '1.5px solid #002147', backgroundColor: '#F0F4F8', color: '#002147', fontSize: '13px', fontWeight: '700', cursor: (selectedSubs.size === 0 || bulkDownloading) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', opacity: (selectedSubs.size === 0 || bulkDownloading) ? 0.6 : 1 }}
                >
                  <FolderDown size={14} /> 
                  {bulkDownloading && bulkZipProgress 
                    ? `Part ${bulkZipProgress.batch}/${bulkZipProgress.totalBatches} (${bulkZipProgress.current}/${bulkZipProgress.total})...` 
                    : `Download Selected (${selectedSubs.size})`}
                </button>
                <button
                  onClick={handleDownloadAllSubmissions}
                  disabled={filteredSubmissions.length === 0 || bulkDownloading}
                  style={{ padding: '11px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#002147', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: (filteredSubmissions.length === 0 || bulkDownloading) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', opacity: (filteredSubmissions.length === 0 || bulkDownloading) ? 0.6 : 1 }}
                >
                  <FolderDown size={14} /> 
                  {bulkDownloading && bulkZipProgress 
                    ? `Part ${bulkZipProgress.batch}/${bulkZipProgress.totalBatches} (${bulkZipProgress.current}/${bulkZipProgress.total})...` 
                    : 'Download All (ZIP)'}
                </button>
                {role === 'admin' && (
                  <button
                    onClick={handleCleanDuplicates}
                    disabled={cleaningDuplicates}
                    style={{ padding: '11px 16px', borderRadius: '8px', border: '1.5px solid #D97706', backgroundColor: '#FEF3C7', color: '#B45309', fontSize: '13px', fontWeight: '700', cursor: cleaningDuplicates ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', opacity: cleaningDuplicates ? 0.6 : 1 }}
                  >
                    <Activity size={14} /> {cleaningDuplicates ? 'Cleaning...' : 'Clean Duplicates'}
                  </button>
                )}
              </div>

              {/* Filter Bar */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>Category</label>
                <select 
                  value={filterCategory} 
                  onChange={e => setFilterCategory(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', backgroundColor: '#FFF', outline: 'none' }}
                >
                  <option value="">All Categories</option>
                  <option value="BASIC SCHOOL">Basic School</option>
                  <option value="SENIOR HIGH SCHOOL">Senior High School</option>
                  <option value="Education Office">Education Office</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>Circuit</label>
                <select 
                  value={filterCircuit} 
                  onChange={e => setFilterCircuit(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', backgroundColor: '#FFF', outline: 'none' }}
                >
                  <option value="">All Circuits</option>
                  {displayCircuits.map((c: any) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>Start Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>End Date</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </div>

            {/* ERROR DISPLAY */}
            {fetchError && (
              <div style={{ backgroundColor: '#FEE2E2', color: '#B91C1C', padding: '16px', borderRadius: '12px', marginBottom: '20px', fontWeight: 'bold' }}>
                <p style={{ margin: '0 0 8px 0' }}>Firebase Error: {fetchError}</p>
                <p style={{ margin: 0, fontWeight: 'normal' }}>
                  Please ensure your database user profile 'role' is exactly 'admin'. 
                  <br /><br />
                  <strong>IMPORTANT:</strong> Make sure you are editing the correct document in the `users` collection! 
                  Your current User ID (UID) is: <span style={{ fontFamily: 'monospace', backgroundColor: '#FECACA', padding: '2px 6px', borderRadius: '4px' }}>{user?.uid}</span>
                  <br />
                  You must find the document with THIS exact ID in Firestore, and set its <code>role</code> field to <code>admin</code>.
                </p>
              </div>
            )}

            {/* Submissions Table */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#002147', margin: 0 }}>Submitted Records</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', outline: 'none', color: '#374151', cursor: 'pointer' }}
                  >
                    <option value="newest">Sort by: Newest First</option>
                    <option value="oldest">Sort by: Oldest First</option>
                    <option value="name">Sort by: Name (A-Z)</option>
                    <option value="staffId">Sort by: Staff ID</option>
                    <option value="category">Sort by: Category</option>
                  </select>
                  <span style={{ fontSize: '12px', color: '#6B7280', backgroundColor: '#F3F4F6', padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>
                    Showing {filteredSubmissions.length} of {totalSubmissions} records
                  </span>
                </div>
              </div>

              {filteredSubmissions.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
                  <FileText size={48} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontWeight: '600' }}>No submissions found matching the criteria.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                        <th style={{ padding: '16px 12px', width: '40px', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={filteredSubmissions.length > 0 && selectedSubs.size === filteredSubmissions.length} 
                            onChange={(e) => {
                              if (e.target.checked) setSelectedSubs(new Set(filteredSubmissions.map((s: any) => s.id)));
                              else setSelectedSubs(new Set());
                            }} 
                            style={{ cursor: 'pointer' }}
                          />
                        </th>
                        <th style={{ padding: '16px 12px', color: '#4B5563', fontWeight: '600' }}>S/N</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Teacher Name</th>
                         <th style={{ padding: '16px 12px', color: '#4B5563', fontWeight: '600' }}>Staff ID</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Category</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Location details</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Subject</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Submitted At</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Docs Count</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600', textAlign: 'center', minWidth: '220px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.slice((submissionsPage - 1) * itemsPerPage, submissionsPage * itemsPerPage).map((sub: any, pageIndex: number) => {
                        const index = (submissionsPage - 1) * itemsPerPage + pageIndex;
                        return (
                        <tr key={sub.id} style={{ borderBottom: '1px solid #F3F4F6', transition: 'background-color 0.15s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#F9FAFB'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedSubs.has(sub.id)} 
                              onChange={(e) => {
                                const newSet = new Set(selectedSubs);
                                if (e.target.checked) newSet.add(sub.id);
                                else newSet.delete(sub.id);
                                setSelectedSubs(newSet);
                              }} 
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '16px 12px', fontWeight: '600', color: '#6B7280' }}>
                            {sortBy === 'newest' ? filteredSubmissions.length - index : index + 1}
                          </td>
                          <td style={{ padding: '16px 24px', fontWeight: '600', color: '#002147' }}>
                            {sub.teacherName}
                            {sub.sex && <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: '500', marginLeft: '6px' }}>({sub.sex})</span>}
                          </td>
                          <td style={{ padding: '16px 12px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#002147', backgroundColor: '#E8EFF7', padding: '3px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                              {sub.staffId || <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontFamily: 'system-ui' }}>N/A</span>}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', backgroundColor: sub.category !== 'Education Office' ? '#E0F2FE' : '#FEF3C7', color: sub.category !== 'Education Office' ? '#0369A1' : '#B45309' }}>
                              {sub.category}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px', color: '#4B5563', fontSize: '13px' }}>
                            {sub.category !== 'Education Office' ? (
                              <div>
                                <div style={{ fontWeight: '600', color: '#111827' }}>{sub.school}</div>
                                <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Circuit: {sub.circuit}</div>
                              </div>
                            ) : (
                              <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>GES Education Office</span>
                            )}
                          </td>
                          <td style={{ padding: '16px 24px', color: '#4B5563' }}>{sub.category !== 'Education Office' ? sub.subject : 'N/A'}</td>
                          <td style={{ padding: '16px 24px', color: '#4B5563', fontSize: '13px' }}>{formatTimestamp(sub.submittedAt)}</td>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{ fontWeight: '600', color: sub.documents?.length === DOCUMENTS.length ? '#047857' : '#B45309' }}>
                              {sub.documents?.length || 0} / {DOCUMENTS.length}
                            </span>
                          </td>
                          <td style={{ padding: '12px 24px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => setSelectedSub(sub)}
                                title="View Documents"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', backgroundColor: '#002147', color: '#FFF', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }}
                                onMouseOver={e => e.currentTarget.style.backgroundColor = '#001530'}
                                onMouseOut={e => e.currentTarget.style.backgroundColor = '#002147'}
                              >
                                <ChevronRight size={12} /> View
                              </button>
                              <button
                                onClick={() => handleDownloadAll(sub)}
                                title="Download all documents as ZIP"
                                disabled={downloadingId === sub.id}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', backgroundColor: '#0369A1', color: '#FFF', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: downloadingId === sub.id ? 'not-allowed' : 'pointer', opacity: downloadingId === sub.id ? 0.7 : 1 }}
                              >
                                <FolderDown size={12} /> {downloadingId === sub.id ? '...' : 'ZIP'}
                              </button>
                              <button
                                onClick={() => handleOpenEdit(sub)}
                                title="Edit record"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', backgroundColor: '#D97706', color: '#FFF', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                <Pencil size={12} /> Edit
                              </button>
                              <button
                                onClick={() => setDeleteSub(sub)}
                                title="Delete record"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', backgroundColor: '#CE1126', color: '#FFF', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                <Trash2 size={14} /> Delete 
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {/* Submissions Pagination */}
                  {Math.ceil(filteredSubmissions.length / itemsPerPage) > 1 && (
                    <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
                      <button 
                        onClick={() => setSubmissionsPage(p => Math.max(1, p - 1))} 
                        disabled={submissionsPage === 1}
                        style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: submissionsPage === 1 ? '#F3F4F6' : '#FFF', color: submissionsPage === 1 ? '#9CA3AF' : '#374151', fontSize: '13px', fontWeight: '600', cursor: submissionsPage === 1 ? 'not-allowed' : 'pointer' }}
                      >
                        Previous
                      </button>
                      <span style={{ fontSize: '13px', color: '#4B5563', fontWeight: '500' }}>
                        Page {submissionsPage} of {Math.ceil(filteredSubmissions.length / itemsPerPage)}
                      </span>
                      <button 
                        onClick={() => setSubmissionsPage(p => Math.min(Math.ceil(filteredSubmissions.length / itemsPerPage), p + 1))} 
                        disabled={submissionsPage === Math.ceil(filteredSubmissions.length / itemsPerPage)}
                        style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: submissionsPage === Math.ceil(filteredSubmissions.length / itemsPerPage) ? '#F3F4F6' : '#FFF', color: submissionsPage === Math.ceil(filteredSubmissions.length / itemsPerPage) ? '#9CA3AF' : '#374151', fontSize: '13px', fontWeight: '600', cursor: submissionsPage === Math.ceil(filteredSubmissions.length / itemsPerPage) ? 'not-allowed' : 'pointer' }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                  
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab CONTENT: INCOMPLETE DRAFTS */}
        {activeTab === 'drafts' && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#002147', margin: '0 0 2px' }}>Incomplete Draft Records</h3>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                  Showing {filteredDrafts.length} abandoned/incomplete submissions
                </p>
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Search drafts..." 
                  value={draftSearchTerm} 
                  onChange={(e) => setDraftSearchTerm(e.target.value)} 
                  style={{ padding: '8px 12px 8px 36px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', width: '250px' }}
                />
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              {filteredDrafts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280' }}>
                  <FileText size={48} color="#D1D5DB" style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <div style={{ fontSize: '15px', fontWeight: '500' }}>No incomplete drafts found.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                      <tr>
                        <th style={{ padding: '16px 12px', color: '#4B5563', fontWeight: '600' }}>S/N</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Teacher Name</th>
                         <th style={{ padding: '16px 12px', color: '#4B5563', fontWeight: '600' }}>Staff ID</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Category</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>School/Circuit</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Submitted By</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDrafts.map((sub: any, index: number) => {
                        return (
                        <tr key={sub.id} style={{ borderBottom: '1px solid #F3F4F6', transition: 'background-color 0.15s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#F9FAFB'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                            {index + 1}
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontWeight: '700', color: '#111827', fontSize: '14px', marginBottom: '4px' }}>{sub.teacherName || sub.firstName + ' ' + sub.surname}</div>
                            <div style={{ color: '#6B7280', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Phone size={12} /> {sub.phoneNumber || 'N/A'}
                            </div>
                          </td>
                          <td style={{ padding: '16px 12px' }}>
                            <div style={{ fontWeight: '600', color: '#374151', letterSpacing: '0.05em' }}>{sub.staffId}</div>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: sub.category === 'Education Office' ? '#FEF3C7' : '#E0F2FE', color: sub.category === 'Education Office' ? '#92400E' : '#0369A1' }}>
                              {sub.category || 'N/A'}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                             <div style={{ fontWeight: '600', color: '#111827', marginBottom: '2px' }}>{sub.school || 'N/A'}</div>
                             <div style={{ fontSize: '11px', color: '#6B7280' }}>{sub.circuit || 'N/A'}</div>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ color: '#4B5563', fontSize: '12px' }}>{sub.submittedByEmail || 'N/A'}</div>
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button
                                onClick={() => setSelectedSub(sub)}
                                title="View record details"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', backgroundColor: '#F3F4F6', color: '#374151', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                <Eye size={14} /> View
                              </button>
                              <button
                                onClick={() => handleOpenEdit(sub)}
                                title="Edit record"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', backgroundColor: '#E0F2FE', color: '#0369A1', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                <Pencil size={14} /> Edit
                              </button>
                              <button
                                onClick={() => setDeleteSub(sub)}
                                title="Delete record"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', backgroundColor: '#CE1126', color: '#FFF', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                <Trash2 size={14} /> Delete 
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab CONTENT 2: USER PRESENCE & ROLES */}
        {activeTab === 'users' && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#002147', margin: '0 0 2px' }}>Registered Portal Users</h3>
                <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>{users.length} total users registered</p>
              </div>
              <div style={{ position: 'relative', width: '300px' }}>
                <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  value={userSearchTerm} 
                  onChange={e => { setUserSearchTerm(e.target.value); setUsersPage(1); }} 
                  placeholder="Search by email..." 
                  style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Email Address</th>
                    <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Current Role</th>
                    <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Online Status</th>
                    <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Last Active Time</th>
                    <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Registered On</th>
                    {role === 'admin' && <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600', textAlign: 'center', minWidth: '200px' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredUsers = users.filter(u => u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()));
                    const paginatedUsers = filteredUsers.slice((usersPage - 1) * itemsPerPage, usersPage * itemsPerPage);
                    return paginatedUsers.map((u: any) => {
                      const online = isUserActive(u);
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '16px 24px', fontWeight: '600', color: '#111827' }}>
                          {u.email}
                          {u.id === user?.uid && <span style={{ fontSize: '11px', color: '#6B7280', fontStyle: 'italic', marginLeft: '6px' }}>(You)</span>}
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{
                            fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px',
                            backgroundColor:
                              u.role === 'admin' ? '#FEE2E2'
                              : u.role === 'editor' ? '#ECFDF5'
                              : u.role === 'metro_officer' ? '#FEF3C7'
                              : '#EFF6FF',
                            color:
                              u.role === 'admin' ? '#991B1B'
                              : u.role === 'editor' ? '#065F46'
                              : u.role === 'metro_officer' ? '#92400E'
                              : '#1D4ED8'
                          }}>
                            {u.role === 'metro_officer' ? 'Metro Officer' : u.role || 'teacher'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: online ? '#10B981' : '#9CA3AF' }} />
                            <span style={{ fontSize: '13px', fontWeight: '500', color: online ? '#10B981' : '#6B7280' }}>
                              {online ? 'Active Now' : 'Offline'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px', color: '#4B5563', fontSize: '13px' }}>
                          {u.lastActive ? formatTimestamp(u.lastActive) : 'Never'}
                        </td>
                        <td style={{ padding: '16px 24px', color: '#4B5563', fontSize: '13px' }}>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        {role === 'admin' && (
                          <td style={{ padding: '12px 24px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                              {/* Edit Role button */}
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                title="Edit User Role"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#D97706', color: '#FFF', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                <Pencil size={13} /> Edit
                              </button>
                              {/* Password Reset button */}
                              <button
                                onClick={() => handleSendPasswordReset(u.email)}
                                disabled={resetEmailSending === u.email}
                                title="Send Password Reset Email"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#0369A1', color: '#FFF', fontSize: '12px', fontWeight: '600', cursor: resetEmailSending === u.email ? 'not-allowed' : 'pointer', opacity: resetEmailSending === u.email ? 0.7 : 1 }}
                              >
                                <KeyRound size={13} /> {resetEmailSending === u.email ? '...' : 'Reset PW'}
                              </button>
                              {/* Delete button */}
                              <button
                                onClick={async () => {
                                  if (window.confirm(`Are you sure you want to delete portal access for ${u.email}? This will remove their role but they can still log in.`)) {
                                    try {
                                      await deleteDoc(doc(db, 'users', u.id));
                                    } catch (err) {
                                      console.error(err);
                                      alert('Failed to delete user data.');
                                    }
                                  }
                                }}
                                disabled={u.id === user?.uid}
                                title="Delete User Access"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#CE1126', color: '#FFF', fontSize: '12px', fontWeight: '600', cursor: u.id === user?.uid ? 'not-allowed' : 'pointer', opacity: u.id === user?.uid ? 0.5 : 1 }}
                              >
                                <Trash2 size={13} /> Del
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })})()}
                </tbody>
              </table>

              {/* Users Pagination */}
              {(() => {
                const filteredUsers = users.filter(u => u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()));
                const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
                if (totalPages <= 1) return null;
                return (
                  <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
                    <button 
                      onClick={() => setUsersPage(p => Math.max(1, p - 1))} 
                      disabled={usersPage === 1}
                      style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: usersPage === 1 ? '#F3F4F6' : '#FFF', color: usersPage === 1 ? '#9CA3AF' : '#374151', fontSize: '13px', fontWeight: '600', cursor: usersPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      Previous
                    </button>
                    <span style={{ fontSize: '13px', color: '#4B5563', fontWeight: '500' }}>
                      Page {usersPage} of {totalPages}
                    </span>
                    <button 
                      onClick={() => setUsersPage(p => Math.min(totalPages, p + 1))} 
                      disabled={usersPage === totalPages}
                      style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: usersPage === totalPages ? '#F3F4F6' : '#FFF', color: usersPage === totalPages ? '#9CA3AF' : '#374151', fontSize: '13px', fontWeight: '600', cursor: usersPage === totalPages ? 'not-allowed' : 'pointer' }}
                    >
                      Next
                    </button>
                  </div>
                );
              })()}

            </div>
          </div>
        )}

        {/* EDIT USER MODAL */}
        {editUserModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#002147', margin: '0 0 4px' }}>Edit User</h3>
                  <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>Update role and send password reset</p>
                </div>
                <button onClick={() => setEditUserModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: '4px' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Email display */}
              <div style={{ backgroundColor: '#F3F4F6', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', marginBottom: '4px' }}>Email Address</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{editUserModal.email}</div>
              </div>

              {/* Role selector */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', marginBottom: '8px' }}>Assign Role</label>
                <select
                  value={editUserRole}
                  onChange={e => setEditUserRole(e.target.value)}
                  disabled={editUserModal.id === user?.uid}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #D1D5DB', fontSize: '14px', fontWeight: '600', outline: 'none', backgroundColor: '#FFF', cursor: editUserModal.id === user?.uid ? 'not-allowed' : 'pointer' }}
                >
                  <option value="teacher">🎓 Teacher</option>
                  <option value="metro_officer">🏛️ Metro Officer</option>
                  <option value="editor">✏️ Editor</option>
                  <option value="admin">🔐 Admin</option>
                </select>
                {editUserModal.id === user?.uid && (
                  <p style={{ fontSize: '12px', color: '#CE1126', marginTop: '6px' }}>You cannot change your own role.</p>
                )}
              </div>

              {/* Password Reset section */}
              <div style={{ backgroundColor: '#EFF6FF', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#1D4ED8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <KeyRound size={14} /> Password Recovery
                </div>
                <p style={{ fontSize: '12px', color: '#374151', margin: '0 0 12px', lineHeight: '1.5' }}>
                  Send a password reset link to <strong>{editUserModal.email}</strong>. They will receive an email with a link to set a new password.
                </p>
                <button
                  onClick={() => handleSendPasswordReset(editUserModal.email)}
                  disabled={resetEmailSending === editUserModal.email}
                  style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#1D4ED8', color: '#FFF', fontSize: '13px', fontWeight: '700', cursor: resetEmailSending === editUserModal.email ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: resetEmailSending === editUserModal.email ? 0.7 : 1 }}
                >
                  <KeyRound size={14} />
                  {resetEmailSending === editUserModal.email ? 'Sending...' : 'Send Password Reset Email'}
                </button>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setEditUserModal(null)}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid #D1D5DB', backgroundColor: '#FFF', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditUser}
                  disabled={editUserSaving || editUserModal.id === user?.uid}
                  style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: editUserModal.id === user?.uid ? '#E5E7EB' : '#002147', color: editUserModal.id === user?.uid ? '#9CA3AF' : '#FFF', fontSize: '14px', fontWeight: '700', cursor: (editUserSaving || editUserModal.id === user?.uid) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Save size={15} /> {editUserSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab CONTENT: SCHOOLS MANAGEMENT */}
        {activeTab === 'schools' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header and Seed Button */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#002147', margin: '0 0 4px' }}>Schools & Circuits Management</h3>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Add, edit, or remove circuits and schools. Data is synced in real-time.</p>
              </div>
              <button
                onClick={async () => {
                  if (!window.confirm('Seed default Tema Metro schools? This will add dozens of records.')) return;
                  setSeeding(true);
                  try {
                    const promises = [];
                    for (const [circuit, schoolsList] of Object.entries(DEFAULT_SCHOOLS)) {
                      for (const school of schoolsList) {
                        promises.push(addDoc(collection(db, 'schools'), { circuit, school }));
                      }
                    }
                    await Promise.all(promises);
                    alert('Schools seeded successfully!');
                  } catch (err) {
                    console.error(err);
                    alert('Failed to seed schools.');
                  }
                  setSeeding(false);
                }}
                disabled={seeding}
                style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#002147', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: seeding ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
              >
                {seeding ? 'Seeding...' : 'Seed Default Tema Schools'}
              </button>
            </div>

            {/* Add New School Form */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#111827', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} /> Add New School
              </h4>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>Circuit Name</label>
                  <input
                    type="text"
                    value={newSchool.circuit}
                    onChange={e => setNewSchool(prev => ({ ...prev, circuit: e.target.value.toUpperCase() }))}
                    placeholder="e.g. ASHAMANG"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>School Name</label>
                  <input
                    type="text"
                    value={newSchool.school}
                    onChange={e => setNewSchool(prev => ({ ...prev, school: e.target.value.toUpperCase() }))}
                    placeholder="e.g. MANHEAN METHODIST BASIC SCHOOL"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!newSchool.circuit || !newSchool.school) return alert('Both fields are required.');
                    try {
                      await addDoc(collection(db, 'schools'), newSchool);
                      setNewSchool({ circuit: '', school: '' });
                    } catch (err) {
                      console.error(err);
                      alert('Failed to add school.');
                    }
                  }}
                  style={{ padding: '11px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#10B981', color: '#FFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer', height: '42px' }}
                >
                  Add School
                </button>
              </div>
            </div>


            {/* Existing Schools List */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#111827', margin: '0 0 16px' }}>Current Database ({schoolsData.length} records)</h4>
              <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#F9FAFB', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: '600' }}>Circuit</th>
                      <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: '600' }}>School</th>
                      <th style={{ padding: '12px 16px', color: '#4B5563', fontWeight: '600', textAlign: 'center', width: '80px' }}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolsData.slice().sort((a, b) => a.circuit.localeCompare(b.circuit) || a.school.localeCompare(b.school)).map((s: any) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: '#374151' }}>
                          {editSchoolId === s.id ? (
                            <input
                              type="text"
                              value={editSchoolData.circuit}
                              onChange={e => setEditSchoolData(prev => ({ ...prev, circuit: e.target.value.toUpperCase() }))}
                              style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #D1D5DB' }}
                            />
                          ) : s.circuit}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#111827' }}>
                          {editSchoolId === s.id ? (
                            <input
                              type="text"
                              value={editSchoolData.school}
                              onChange={e => setEditSchoolData(prev => ({ ...prev, school: e.target.value.toUpperCase() }))}
                              style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #D1D5DB' }}
                            />
                          ) : s.school}
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            {editSchoolId === s.id ? (
                              <>
                                <button
                                  onClick={async () => {
                                    if (!editSchoolData.circuit || !editSchoolData.school) return alert('Both fields required');
                                    try {
                                      await updateDoc(doc(db, 'schools', s.id), {
                                        circuit: editSchoolData.circuit,
                                        school: editSchoolData.school
                                      });
                                      setEditSchoolId(null);
                                    } catch (err) {
                                      console.error(err);
                                      alert('Failed to update school.');
                                    }
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', padding: '4px' }}
                                  title="Save Changes"
                                >
                                  <Save size={16} />
                                </button>
                                <button
                                  onClick={() => setEditSchoolId(null)}
                                  style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: '4px' }}
                                  title="Cancel"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditSchoolId(s.id);
                                    setEditSchoolData({ circuit: s.circuit, school: s.school });
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#D97706', cursor: 'pointer', padding: '4px' }}
                                  title="Edit School"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (window.confirm(`Delete ${s.school}?`)) {
                                      await deleteDoc(doc(db, 'schools', s.id));
                                    }
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#CE1126', cursor: 'pointer', padding: '4px' }}
                                  title="Delete School"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {schoolsData.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>
                          No schools in database. Use the seed button above or add them manually.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab CONTENT: BULK DOWNLOAD */}
        {activeTab === 'bulk-download' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Search Controls */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#111827', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderDown size={16} /> Bulk Select & Download
              </h4>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                
                {/* Bulk Select by Staff IDs */}
                <div style={{ flex: '1 1 45%', backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '12px', border: '1px solid #E5E7EB', marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '8px' }}>Bulk Search by Staff IDs</label>
                  <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 8px 0' }}>Paste a list of Staff IDs (separated by commas or new lines) to search for records.</p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <textarea 
                      value={bulkStaffIds}
                      onChange={e => setBulkStaffIds(e.target.value)}
                      placeholder="e.g. GES/1234, GES/5678..."
                      style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', outline: 'none', backgroundColor: '#FFF', minHeight: '80px', fontFamily: 'monospace' }}
                    />
                    <button
                      onClick={() => {
                        if (!bulkStaffIds.trim()) return alert('Please enter at least one Staff ID.');
                        const idsToSearch = bulkStaffIds.split(/[\n,]+/).map(id => id.trim().toUpperCase()).filter(id => id);
                        const matchedSubs = submissions.filter(s => idsToSearch.includes(s.staffId?.toUpperCase()));
                        
                        const matchedIds = matchedSubs.map(s => s.staffId?.toUpperCase());
                        const notFound = idsToSearch.filter(id => !matchedIds.includes(id));
                        setBulkNotFoundItems(notFound);

                        if (matchedSubs.length === 0) return alert('No matching records found.');
                        setBulkMatchedSubs(matchedSubs);
                        alert(`Found ${matchedSubs.length} matching records by Staff ID.`);
                        setBulkStaffIds('');
                      }}
                      style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#10B981', color: '#FFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer', height: 'fit-content', whiteSpace: 'nowrap' }}
                    >
                      <Search size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} /> Search
                    </button>
                  </div>
                </div>

                {/* Bulk Select by Names */}
                <div style={{ flex: '1 1 45%', backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '12px', border: '1px solid #E5E7EB', marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '8px' }}>Bulk Search by Names</label>
                  <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 8px 0' }}>Paste a list of Names (separated by commas or new lines) to search for records.</p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <textarea 
                      value={bulkNames}
                      onChange={e => setBulkNames(e.target.value)}
                      placeholder="e.g. John Doe, Jane Smith..."
                      style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', outline: 'none', backgroundColor: '#FFF', minHeight: '80px', fontFamily: 'monospace' }}
                    />
                    <button
                      onClick={() => {
                        if (!bulkNames.trim()) return alert('Please enter at least one name.');
                        const namesToSearch = bulkNames.split(/[\n,]+/).map(name => name.trim().toLowerCase()).filter(name => name);
                        const matchedSubs = submissions.filter(s => {
                          const fullName = (s.teacherName || `${s.firstName || ''} ${s.otherNames || ''} ${s.surname || ''}`).toLowerCase();
                          return namesToSearch.some(searchName => fullName.includes(searchName));
                        });

                        const notFound = namesToSearch.filter(searchName => {
                          return !matchedSubs.some(s => {
                            const fullName = (s.teacherName || `${s.firstName || ''} ${s.otherNames || ''} ${s.surname || ''}`).toLowerCase();
                            return fullName.includes(searchName);
                          });
                        });
                        setBulkNotFoundItems(notFound);

                        if (matchedSubs.length === 0) return alert('No matching records found.');
                        setBulkMatchedSubs(matchedSubs);
                        alert(`Found ${matchedSubs.length} matching records by Name.`);
                        setBulkNames('');
                      }}
                      style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#10B981', color: '#FFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer', height: 'fit-content', whiteSpace: 'nowrap' }}
                    >
                      <Search size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} /> Search
                    </button>
                  </div>
                </div>

                {/* Download by Circuit */}
                <div style={{ flex: '1 1 300px', backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '8px' }}>Download by Circuit</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={downloadCircuit}
                      onChange={e => setDownloadCircuit(e.target.value)}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', outline: 'none', backgroundColor: '#FFF' }}
                    >
                      <option value="">-- Select Circuit --</option>
                      {displayCircuits.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                      onClick={handleBulkDownloadByCircuit}
                      disabled={!downloadCircuit || bulkDownloading}
                      style={{ padding: '0 16px', borderRadius: '8px', border: 'none', backgroundColor: '#002147', color: '#FFF', fontSize: '13px', fontWeight: '600', cursor: (!downloadCircuit || bulkDownloading) ? 'not-allowed' : 'pointer', opacity: (!downloadCircuit || bulkDownloading) ? 0.6 : 1 }}
                    >
                      Download ZIP
                    </button>
                  </div>
                </div>

                {/* Download by Category */}
                <div style={{ flex: '1 1 300px', backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '8px' }}>Download by Category</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={downloadCategory}
                      onChange={e => setDownloadCategory(e.target.value)}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', outline: 'none', backgroundColor: '#FFF' }}
                    >
                      <option value="">-- Select Category --</option>
                      <option value="Basic">Basic</option>
                      <option value="Senior High">Senior High</option>
                      <option value="Education Office">Education Office</option>
                    </select>
                    <button
                      onClick={handleBulkDownloadByCategory}
                      disabled={!downloadCategory || bulkDownloading}
                      style={{ padding: '0 16px', borderRadius: '8px', border: 'none', backgroundColor: '#002147', color: '#FFF', fontSize: '13px', fontWeight: '600', cursor: (!downloadCategory || bulkDownloading) ? 'not-allowed' : 'pointer', opacity: (!downloadCategory || bulkDownloading) ? 0.6 : 1 }}
                    >
                      Download ZIP
                    </button>
                  </div>
                </div>

                {/* Download by School */}
                <div style={{ flex: '1 1 300px', backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '8px' }}>Download by School</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={downloadSchool}
                      onChange={e => setDownloadSchool(e.target.value)}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', outline: 'none', backgroundColor: '#FFF' }}
                    >
                      <option value="">-- Select School --</option>
                      {schoolsData.slice().sort((a, b) => a.school.localeCompare(b.school)).map((s: any) => (
                        <option key={s.id} value={s.school}>{s.school}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleBulkDownloadBySchool}
                      disabled={!downloadSchool || bulkDownloading}
                      style={{ padding: '0 16px', borderRadius: '8px', border: 'none', backgroundColor: '#002147', color: '#FFF', fontSize: '13px', fontWeight: '600', cursor: (!downloadSchool || bulkDownloading) ? 'not-allowed' : 'pointer', opacity: (!downloadSchool || bulkDownloading) ? 0.6 : 1 }}
                    >
                      Download ZIP
                    </button>
                  </div>
                </div>

                {/* Download by Current Rank */}
                <div style={{ flex: '1 1 300px', backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '8px' }}>Download by Current Rank</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={downloadRank}
                      onChange={e => setDownloadRank(e.target.value)}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', outline: 'none', backgroundColor: '#FFF' }}
                    >
                      <option value="">-- Select Rank --</option>
                      {displayRanks.map((r: any) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleBulkDownloadByRank}
                      disabled={!downloadRank || bulkDownloading}
                      style={{ padding: '0 16px', borderRadius: '8px', border: 'none', backgroundColor: '#002147', color: '#FFF', fontSize: '13px', fontWeight: '600', cursor: (!downloadRank || bulkDownloading) ? 'not-allowed' : 'pointer', opacity: (!downloadRank || bulkDownloading) ? 0.6 : 1 }}
                    >
                      Download ZIP
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Temporal Table for Search Results */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#002147', margin: 0 }}>Search Results ({bulkMatchedSubs.length})</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => { setBulkMatchedSubs([]); setBulkNotFoundItems([]); }}
                    disabled={bulkMatchedSubs.length === 0 && bulkNotFoundItems.length === 0}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FFF', color: '#4B5563', fontSize: '13px', fontWeight: '600', cursor: (bulkMatchedSubs.length === 0 && bulkNotFoundItems.length === 0) ? 'not-allowed' : 'pointer', opacity: (bulkMatchedSubs.length === 0 && bulkNotFoundItems.length === 0) ? 0.5 : 1 }}
                  >
                    Clear Results
                  </button>
                  <button
                    onClick={() => {
                      const newSelected = new Set(selectedSubs);
                      bulkMatchedSubs.forEach(s => newSelected.add(s.id));
                      setSelectedSubs(newSelected);
                      setActiveTab('submissions');
                    }}
                    disabled={bulkMatchedSubs.length === 0}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#002147', color: '#FFF', fontSize: '13px', fontWeight: '600', cursor: bulkMatchedSubs.length === 0 ? 'not-allowed' : 'pointer', opacity: bulkMatchedSubs.length === 0 ? 0.5 : 1 }}
                  >
                    Select & Download in Submissions Tab
                  </button>
                </div>
              </div>

              {bulkMatchedSubs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                  <Search size={32} style={{ marginBottom: '12px', opacity: 0.5, display: 'inline-block' }} />
                  <p style={{ fontSize: '14px' }}>No records matched. Use the search tools above to find staff data.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#F9FAFB', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                        <th style={{ padding: '12px 24px', color: '#4B5563', fontWeight: '600' }}>S/N</th>
                        <th style={{ padding: '12px 24px', color: '#4B5563', fontWeight: '600' }}>Staff ID</th>
                        <th style={{ padding: '12px 24px', color: '#4B5563', fontWeight: '600' }}>Teacher Name</th>
                        <th style={{ padding: '12px 24px', color: '#4B5563', fontWeight: '600' }}>Category</th>
                        <th style={{ padding: '12px 24px', color: '#4B5563', fontWeight: '600' }}>School</th>
                        <th style={{ padding: '12px 24px', color: '#4B5563', fontWeight: '600', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkMatchedSubs.map((s, idx) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#F9FAFB'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <td style={{ padding: '12px 24px', color: '#6B7280' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 24px', fontWeight: '600', color: '#002147' }}>{s.staffId || 'N/A'}</td>
                          <td style={{ padding: '12px 24px', fontWeight: '600', color: '#111827' }}>{s.teacherName || `${s.firstName || ''} ${s.surname || ''}`}</td>
                          <td style={{ padding: '12px 24px', color: '#4B5563' }}>{s.category || 'N/A'}</td>
                          <td style={{ padding: '12px 24px', color: '#4B5563' }}>{s.school || 'N/A'}</td>
                          <td style={{ padding: '12px 24px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleOpenEdit(s)}
                              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: '#FFF', color: '#4B5563', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                            >
                              <Pencil size={12} style={{ display: 'inline', marginRight: '4px' }} /> Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {bulkNotFoundItems.length > 0 && (
                <div style={{ padding: '16px 24px', backgroundColor: '#FEF2F2', borderTop: '1px solid #FEE2E2' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#B91C1C', fontSize: '14px', fontWeight: '700' }}>Items Not Found ({bulkNotFoundItems.length})</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {bulkNotFoundItems.map((item, idx) => (
                      <span key={idx} style={{ padding: '4px 8px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab CONTENT 3: APP ANALYTICS */}
        {activeTab === 'analytics' && (() => {
          const validSubmissions = submissions.filter((s: any) => s.status !== 'draft');
          const totalSubmissions = validSubmissions.length;
          const draftCount = submissions.length - validSubmissions.length;
          
          const officeSubs = validSubmissions.filter((s: any) => s.category === 'Education Office').length;
          
          const teacherCount = users.filter((u: any) => !u.role || u.role === 'teacher').length;
          const metroCount = users.filter((u: any) => u.role === 'metro_officer').length;
          const adminCount = users.filter((u: any) => u.role === 'admin' || u.role === 'editor').length;

          const circuitMap: Record<string, number> = {};
          submissions.forEach((s: any) => {
            if (s.circuit) circuitMap[s.circuit] = (circuitMap[s.circuit] || 0) + 1;
          });
          const circuitEntries = Object.entries(circuitMap).sort((a, b) => b[1] - a[1]);
          const maxCircuit = circuitEntries[0]?.[1] || 1;

          const submitterMap: Record<string, number> = {};
          validSubmissions.forEach((s: any) => {
            if (s.submittedByEmail) submitterMap[s.submittedByEmail] = (submitterMap[s.submittedByEmail] || 0) + 1;
          });
          const topSubmitters = Object.entries(submitterMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
          const maxSubmitter = topSubmitters[0]?.[1] || 1;

          const categoryMap: Record<string, number> = {};
          validSubmissions.forEach((s: any) => {
            if (s.category) categoryMap[s.category] = (categoryMap[s.category] || 0) + 1;
          });
          const categoryEntries = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
          const maxCategory = categoryEntries[0]?.[1] || 1;

          const rankMap: Record<string, number> = {};
          validSubmissions.forEach((s: any) => {
            if (s.currentRank) rankMap[s.currentRank] = (rankMap[s.currentRank] || 0) + 1;
          });
          const rankEntries = Object.entries(rankMap).sort((a, b) => b[1] - a[1]);
          const maxRank = rankEntries[0]?.[1] || 1;

          const kpiCard = (icon: React.ReactNode, label: string, value: string | number, accent: string, sub?: string) => (
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: `4px solid ${accent}`, display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>{icon}</div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#002147', lineHeight: '1.2' }}>{value}</div>
                {sub && <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{sub}</div>}
              </div>
            </div>
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {kpiCard(<TrendingUp size={22} />, 'Total Completed', totalSubmissions, '#002147', 'valid submissions')}
                {kpiCard(<FileText size={22} />, 'Incomplete Drafts', draftCount, '#CE1126', 'abandoned/in-progress')}
                {kpiCard(<Building2 size={22} />, 'Education Office', officeSubs, '#B45309', `${totalSubmissions ? Math.round(officeSubs / totalSubmissions * 100) : 0}% of completed`)}
                {kpiCard(<Users size={22} />, 'Registered Users', totalUsers, '#065F46', `${activeUsersCount} currently online`)}
              </div>

              {/* User Role Breakdown */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <Users size={18} color="#002147" />
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#002147' }}>User Role Breakdown</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                  {[
                    { label: 'Teachers', count: teacherCount, icon: <GraduationCap size={20} />, color: '#1D4ED8', bg: '#EFF6FF' },
                    { label: 'Metro Officers', count: metroCount, icon: <Building2 size={20} />, color: '#92400E', bg: '#FEF3C7' },
                    { label: 'Admins / Editors', count: adminCount, icon: <ShieldCheck size={20} />, color: '#991B1B', bg: '#FEE2E2' },
                  ].map(({ label, count, icon, color, bg }) => (
                    <div key={label} style={{ backgroundColor: bg, borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ color }}>{icon}</div>
                      <div>
                        <div style={{ fontSize: '22px', fontWeight: '900', color }}>{count}</div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color, opacity: 0.75 }}>{label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakdown by Category & Rank */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {/* Category Breakdown */}
                {categoryEntries.length > 0 && (
                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                      <BarChart3 size={18} color="#002147" />
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#002147' }}>Submissions by Category</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {categoryEntries.map(([category, count]) => (
                        <div key={category} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '120px', fontSize: '12px', fontWeight: '600', color: '#4B5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{category}</div>
                          <div style={{ flex: 1, height: '8px', backgroundColor: '#F3F4F6', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', backgroundColor: '#0369A1', width: `${(count / maxCategory) * 100}%`, borderRadius: '4px' }}></div>
                          </div>
                          <div style={{ width: '40px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#111827' }}>{count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rank Breakdown */}
                {rankEntries.length > 0 && (
                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                      <BarChart3 size={18} color="#002147" />
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#002147' }}>Submissions by Rank</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {rankEntries.slice(0, 10).map(([rank, count]) => (
                        <div key={rank} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '150px', fontSize: '12px', fontWeight: '600', color: '#4B5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={rank}>{rank}</div>
                          <div style={{ flex: 1, height: '8px', backgroundColor: '#F3F4F6', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', backgroundColor: '#B45309', width: `${(count / maxRank) * 100}%`, borderRadius: '4px' }}></div>
                          </div>
                          <div style={{ width: '40px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#111827' }}>{count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Submissions by Circuit */}
              {circuitEntries.length > 0 && (
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <BarChart3 size={18} color="#002147" />
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#002147' }}>Submissions by Circuit</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {circuitEntries.map(([circuit, count]) => (
                      <div key={circuit}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{circuit}</span>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#002147' }}>{count}</span>
                        </div>
                        <div style={{ height: '10px', backgroundColor: '#F3F4F6', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(count / maxCircuit) * 100}%`, background: 'linear-gradient(90deg, #002147, #0047AB)', borderRadius: '99px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Submitters */}
              {topSubmitters.length > 0 && (
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <Activity size={18} color="#002147" />
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#002147' }}>Top 5 Submitters</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {topSubmitters.map(([email, count], idx) => (
                      <div key={email}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: idx === 0 ? '#FCD116' : '#F3F4F6', color: idx === 0 ? '#002147' : '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', flexShrink: 0 }}>{idx + 1}</span>
                            <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>{email}</span>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#002147', flexShrink: 0 }}>{count} {count === 1 ? 'record' : 'records'}</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: '#F3F4F6', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(count / maxSubmitter) * 100}%`, background: idx === 0 ? 'linear-gradient(90deg, #FCD116, #F59E0B)' : 'linear-gradient(90deg, #002147, #0047AB)', borderRadius: '99px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {submissions.length === 0 && (
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#9CA3AF', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <BarChart3 size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <p style={{ margin: 0, fontWeight: '600' }}>No data yet — analytics will appear once submissions are recorded.</p>
                </div>
              )}
            </div>
          );
        })()}
        </main>
      </div>

      {/* VIEW SUBMISSION DETAILS MODAL */}
      {selectedSub && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#F0F4F8', borderRadius: '20px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', position: 'relative' }}>
            
            <div style={{ position: 'sticky', top: 0, backgroundColor: '#FFF', padding: '16px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#002147', margin: '0 0 4px' }}>Teacher Details</h3>
                <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>ID: {selectedSub.staffId || 'N/A'}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  onClick={() => handleGeneratePDF(selectedSub, 'print')} 
                  disabled={isGeneratingPDF}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1.5px solid #E5E7EB', backgroundColor: '#FFF', color: '#374151', fontSize: '12px', fontWeight: '700', cursor: isGeneratingPDF ? 'not-allowed' : 'pointer' }}
                >
                  <Printer size={14} /> Print
                </button>
                <button 
                  onClick={() => handleGeneratePDF(selectedSub, 'download')} 
                  disabled={isGeneratingPDF}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1.5px solid #002147', backgroundColor: '#002147', color: '#FFF', fontSize: '12px', fontWeight: '700', cursor: isGeneratingPDF ? 'not-allowed' : 'pointer' }}
                >
                  <Download size={14} /> {isGeneratingPDF ? 'Wait...' : 'Save PDF'}
                </button>
                <button onClick={() => setSelectedSub(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: '4px', marginLeft: '8px' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ padding: '24px' }}>
              <Summary f={selectedSub} isPreview={true} />

              <div style={{ marginTop: '32px', backgroundColor: '#FFF', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#111827', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Uploaded Documents Checklist</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {DOCUMENTS.map((docName, index) => {
                    const matchingDoc = selectedSub.documents?.find((d: any) => d.documentType === docName);
                    
                    return (
                      <div 
                        key={index} 
                        style={{ 
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                          padding: '12px 16px', borderRadius: '10px', border: '1.5px solid',
                          borderColor: matchingDoc ? '#ECFDF5' : '#E5E7EB',
                          backgroundColor: matchingDoc ? '#F0FDF4' : '#FAFAFA'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, marginRight: '16px' }}>
                          <div style={{ 
                            width: '24px', height: '24px', borderRadius: '50%', 
                            backgroundColor: matchingDoc ? '#10B981' : '#9CA3AF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            <span style={{ fontSize: '11px', color: '#FFF', fontWeight: 'bold' }}>{index + 1}</span>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: matchingDoc ? '#065F46' : '#4B5563' }}>
                            {docName}
                          </span>
                        </div>

                        {matchingDoc ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => {
                                if (navigator.share) {
                                  navigator.share({
                                    title: docName,
                                    url: matchingDoc.downloadURL
                                  }).catch(console.error);
                                } else {
                                  navigator.clipboard.writeText(matchingDoc.downloadURL);
                                  alert('Link copied to clipboard!');
                                }
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none',
                                color: '#6B7280', fontSize: '12px', fontWeight: '700', backgroundColor: '#FFF',
                                border: '1.5px solid #D1D5DB', padding: '6px 12px', borderRadius: '6px',
                                transition: 'all 0.2s', flexShrink: 0, cursor: 'pointer'
                              }}
                              onMouseOver={e => { e.currentTarget.style.backgroundColor = '#F3F4F6'; e.currentTarget.style.color = '#374151'; }}
                              onMouseOut={e => { e.currentTarget.style.backgroundColor = '#FFF'; e.currentTarget.style.color = '#6B7280'; }}
                            >
                              Share <Share2 size={12} />
                            </button>
                            <a 
                              href={matchingDoc.downloadURL} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ 
                                display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none',
                                color: '#10B981', fontSize: '12px', fontWeight: '700', backgroundColor: '#FFF',
                                border: '1.5px solid #10B981', padding: '6px 12px', borderRadius: '6px',
                                transition: 'all 0.2s', flexShrink: 0
                              }}
                              onMouseOver={e => { e.currentTarget.style.backgroundColor = '#10B981'; e.currentTarget.style.color = '#FFF'; }}
                              onMouseOut={e => { e.currentTarget.style.backgroundColor = '#FFF'; e.currentTarget.style.color = '#10B981'; }}
                            >
                              Open File <ExternalLink size={12} />
                            </a>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: '600', fontStyle: 'italic', flexShrink: 0 }}>
                            Missing
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', position: 'sticky', bottom: 0, zIndex: 10 }}>
              <button
                onClick={() => { setSelectedSub(null); handleDownloadAll(selectedSub); }}
                disabled={downloadingId === selectedSub?.id}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0369A1', color: '#FFFFFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                <Download size={14} /> {downloadingId === selectedSub?.id ? 'Downloading...' : 'Download All as ZIP'}
              </button>
              <button 
                onClick={() => setSelectedSub(null)}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #D1D5DB', backgroundColor: '#FFFFFF', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

            {/* Hidden PDF content for generation */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
              <PersonalRecordPDF ref={pdfRef} f={selectedSub} />
            </div>

          </div>
        </div>
      )}

      {/* EDIT SUBMISSION MODAL */}
      {editSub && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '20px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', maxWidth: '560px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#002147', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Pencil size={18} /> Edit Record
              </h3>
              <button onClick={() => setEditSub(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9CA3AF' }}>&times;</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {([
                { label: 'Teacher Name', key: 'teacherName', type: 'text' },
                { label: 'Staff ID', key: 'staffId', type: 'text' },
              ]).map(({ label, key, type }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</label>
                  <input
                    type={type}
                    value={editForm[key] || ''}
                    onChange={e => setEditForm((f: any) => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>Category</label>
                <select value={editForm.category || ''} onChange={e => setEditForm((f: any) => ({ ...f, category: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '14px', backgroundColor: '#FFF' }}>
                  <option value="BASIC SCHOOL">BASIC SCHOOL</option>
                  <option value="Senior High School">Senior High School</option>
                  <option value="Education Office">Education Office</option>
                </select>
              </div>
              {editForm.category !== 'Education Office' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>Circuit</label>
                    <select value={editForm.circuit || ''} onChange={e => setEditForm((f: any) => ({ ...f, circuit: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '14px', backgroundColor: '#FFF' }}>
                      <option value="">Select Circuit</option>
                      {displayCircuits.map((c: any) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>School</label>
                    <input type="text" value={editForm.school || ''} onChange={e => setEditForm((f: any) => ({ ...f, school: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>Subject</label>
                    <input type="text" value={editForm.subject || ''} onChange={e => setEditForm((f: any) => ({ ...f, subject: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>Sex</label>
                    <select value={editForm.sex || ''} onChange={e => setEditForm((f: any) => ({ ...f, sex: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '14px', backgroundColor: '#FFF' }}>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>Current Rank</label>
                    <select value={editForm.currentRank || ''} onChange={e => setEditForm((f: any) => ({ ...f, currentRank: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '14px', backgroundColor: '#FFF' }}>
                      <option value="">Select Rank</option>
                      <option value="Director II">Director II</option>
                      <option value="Deputy Director">Deputy Director</option>
                      <option value="Assistant Director I">Assistant Director I</option>
                      <option value="Assistant Director II">Assistant Director II</option>
                      <option value="Principal Superintendent">Principal Superintendent</option>
                      <option value="Senior Superintendent I">Senior Superintendent I</option>
                      <option value="Senior Superintendent II">Senior Superintendent II</option>
                      <option value="Superintendent I">Superintendent I</option>
                      <option value="Superintendent II">Superintendent II</option>
                      <option value="Pupil Teacher">Pupil Teacher</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#F9FAFB', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
              <button onClick={() => setEditSub(null)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #D1D5DB', backgroundColor: '#FFF', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#002147', color: '#FFF', fontSize: '13px', fontWeight: '700', cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.7 : 1 }}
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteSub && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '20px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Trash2 size={24} color="#CE1126" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#111827', margin: '0 0 8px' }}>Delete Record?</h3>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 24px', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete the record for <strong style={{ color: '#111827' }}>{deleteSub.teacherName}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteSub(null)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1.5px solid #D1D5DB', backgroundColor: '#FFF', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#CE1126', color: '#FFF', fontSize: '13px', fontWeight: '700', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATES MANAGEMENT MODAL */}
      {showDuplicatesModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#FFF', borderRadius: '16px', maxWidth: '800px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#002147', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} color="#D97706" /> Duplicate Records Management
              </h3>
              <button onClick={() => setShowDuplicatesModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {duplicateGroups.length > 0 ? (
                <div>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#4B5563' }}>
                    Found <strong>{duplicateGroups.length}</strong> staff member(s) with multiple submissions. The newest submission will be kept, and the older ones will be deleted.
                  </p>
                  {duplicateGroups.map(group => (
                    <div key={group.staffId} style={{ marginBottom: '24px', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: '#F9FAFB', padding: '12px 16px', borderBottom: '1px solid #E5E7EB', fontWeight: '700', color: '#111827' }}>
                        Staff ID: <span style={{ fontFamily: 'monospace', color: '#0369A1' }}>{group.staffId}</span> ({group.keep.teacherName})
                      </div>
                      <div style={{ padding: '16px' }}>
                        <div style={{ marginBottom: '12px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#059669', backgroundColor: '#D1FAE5', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '8px' }}>Keep (Newest)</span>
                          <div style={{ fontSize: '13px', color: '#374151' }}>
                            Submitted: {formatTimestamp(group.keep.submittedAt)} | Category: {group.keep.category} | School: {group.keep.school || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#DC2626', backgroundColor: '#FEE2E2', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '8px' }}>To Delete (Older)</span>
                          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#6B7280' }}>
                            {group.duplicates.map((d: any) => (
                              <li key={d.id}>Submitted: {formatTimestamp(d.submittedAt)} | Category: {d.category} | School: {d.school || 'N/A'}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : deletedDuplicatesList.length > 0 ? (
                <div>
                  <div style={{ padding: '16px', backgroundColor: '#ECFDF5', border: '1px solid #10B981', borderRadius: '8px', marginBottom: '24px' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#065F46', fontSize: '15px' }}>Cleanup Successful!</h4>
                    <p style={{ margin: 0, color: '#047857', fontSize: '14px' }}>Deleted {deletedDuplicatesList.length} duplicate record(s).</p>
                  </div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#374151' }}>List of Deleted Records:</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#6B7280', maxHeight: '300px', overflowY: 'auto' }}>
                    {deletedDuplicatesList.map((d: any, i: number) => (
                      <li key={i} style={{ marginBottom: '6px' }}>
                        <strong>{d.teacherName}</strong> (ID: {d.staffId}) - Submitted: {formatTimestamp(d.submittedAt)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p style={{ color: '#6B7280', fontSize: '14px' }}>No duplicates to display.</p>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#F9FAFB', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
              <button onClick={() => setShowDuplicatesModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #D1D5DB', backgroundColor: '#FFF', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Close</button>
              {duplicateGroups.length > 0 && (
                <button
                  onClick={confirmDeleteDuplicates}
                  disabled={cleaningDuplicates}
                  style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#DC2626', color: '#FFF', fontSize: '13px', fontWeight: '700', cursor: cleaningDuplicates ? 'not-allowed' : 'pointer', opacity: cleaningDuplicates ? 0.7 : 1 }}
                >
                  {cleaningDuplicates ? 'Deleting...' : 'Delete All Older Duplicates'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer theme="light" />
    </div>
  );
}
