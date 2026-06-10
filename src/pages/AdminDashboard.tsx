import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Papa from 'papaparse';
import Footer from '../components/Footer';
import { 
  LogOut, Users, FileText, Activity, Search, Download, 
  ChevronRight, ExternalLink, BarChart3, TrendingUp, GraduationCap, Building2, ShieldCheck
} from 'lucide-react';

const CIRCUITS = [
  'ASHAMANG', 'AWUDUM', 'COMMUNITY 11/REDEMPTION VALLEY', 'COMMUNITY 7/REPUBLIC ROAD',
  'COMMUNITY 8', 'ONINKU/MANTE-DIN', 'TWEDAASE',
];

const DOCUMENTS = [
  'Letter of Appointment',
  'Completed and signed Personal Record Form',
  'Certified true copies of Academic and Professional Certificates',
  'Copies of all Promotion Letters',
  'Any other relevant personnel documents relating to your career progression and status within the Service',
];

export default function AdminDashboard() {
  const { user, role, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'submissions' | 'users' | 'analytics'>('submissions');
  
  // Data States
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  // Filtering & Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCircuit, setFilterCircuit] = useState('');
  const filterSubject = '';
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected submission modal
  const [selectedSub, setSelectedSub] = useState<any | null>(null);

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
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
    });

    return () => {
      unsubSubmissions();
      unsubUsers();
    };
  }, []);

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

  // Submissions Filtering logic
  const filteredSubmissions = submissions.filter((sub: any) => {
    const matchesSearch = sub.teacherName?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
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

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (role !== 'admin') {
      alert('Only Admins can change user roles.');
      return;
    }
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
    } catch (err) {
      console.error('Error updating role:', err);
      alert('Failed to update role. Please try again.');
    }
  };

  // Metrics calculations
  const totalSubmissions = submissions.length;
  
  const totalUsers = users.length;
  const activeUsersCount = users.filter(isUserActive).length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F3F4F6', color: '#111827', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top Banner Header */}
      <header style={{ background: 'linear-gradient(135deg, #002147 0%, #001530 100%)', color: '#FFFFFF', padding: '20px 32px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div 
          onClick={() => window.location.href = '/'}
          style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', borderRadius: '12px', padding: '8px 10px', transition: 'background-color 0.2s' }}
          title="Click to Refresh & Return to Landing Page"
          onMouseOver={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
          onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', overflow: 'hidden' }}>
            <img src="/logo.png" alt="GES Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ghana Education Service</div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', lineHeight: '1.2' }}>Tema Metro Directorate</h1>
            <div style={{ fontSize: '13px', color: '#CE1126', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Admin Panel Dashboard</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>{user?.email}</span>
            <span style={{ fontSize: '10px', backgroundColor: '#CE1126', color: '#FFF', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '2px' }}>
              {role}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => window.location.href = '/teacher'}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: '1.5px solid rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            >
              <FileText size={16} /> Submission Form
            </button>
            <button 
              onClick={logout}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: '1.5px solid rgba(255,255,255,0.2)', backgroundColor: 'transparent', color: '#FFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <LogOut size={16} /> Log Out
            </button>
          </div>
        </div>
      </header>

      <div style={{ padding: '32px' }}>
        {/* Navigation Tabs and Stats Overview */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', backgroundColor: '#E5E7EB', padding: '4px', borderRadius: '10px' }}>
            <button
              onClick={() => setActiveTab('submissions')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: activeTab === 'submissions' ? '#002147' : 'transparent', color: activeTab === 'submissions' ? '#FFFFFF' : '#4B5563', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <FileText size={16} /> Submissions Monitor
            </button>
            <button
              onClick={() => setActiveTab('users')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: activeTab === 'users' ? '#002147' : 'transparent', color: activeTab === 'users' ? '#FFFFFF' : '#4B5563', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <Users size={16} /> User Presence & Roles
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: activeTab === 'analytics' ? '#002147' : 'transparent', color: activeTab === 'analytics' ? '#FFFFFF' : '#4B5563', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <BarChart3 size={16} /> App Analytics
            </button>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
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
        </div>

        {/* Tab CONTENT 1: SUBMISSIONS MONITOR */}
        {activeTab === 'submissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Filter Bar */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>Search Teacher</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    placeholder="Enter name..." 
                    style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>Category</label>
                <select 
                  value={filterCategory} 
                  onChange={e => setFilterCategory(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', backgroundColor: '#FFF', outline: 'none' }}
                >
                  <option value="">All Categories</option>
                  <option value="School">School</option>
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
                  {CIRCUITS.map(c => <option key={c} value={c}>{c}</option>)}
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

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleExportCSV}
                  disabled={filteredSubmissions.length === 0}
                  style={{ width: '100%', padding: '11px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#CE1126', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: filteredSubmissions.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', opacity: filteredSubmissions.length === 0 ? 0.6 : 1 }}
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>
            </div>

            {/* Submissions Table */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#002147', margin: 0 }}>Submitted Records</h3>
                <span style={{ fontSize: '12px', color: '#6B7280', backgroundColor: '#F3F4F6', padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>
                  Showing {filteredSubmissions.length} of {totalSubmissions} records
                </span>
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
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Teacher Name</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Category</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Location details</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Subject</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Submitted At</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600' }}>Docs Count</th>
                        <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.map((sub: any) => (
                        <tr key={sub.id} style={{ borderBottom: '1px solid #F3F4F6', transition: 'background-color 0.15s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#F9FAFB'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <td style={{ padding: '16px 24px', fontWeight: '600', color: '#002147' }}>
                            {sub.teacherName}
                            {sub.sex && <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: '500', marginLeft: '6px' }}>({sub.sex})</span>}
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', backgroundColor: sub.category === 'School' ? '#E0F2FE' : '#FEF3C7', color: sub.category === 'School' ? '#0369A1' : '#B45309' }}>
                              {sub.category}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px', color: '#4B5563', fontSize: '13px' }}>
                            {sub.category === 'School' ? (
                              <div>
                                <div style={{ fontWeight: '600', color: '#111827' }}>{sub.school}</div>
                                <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Circuit: {sub.circuit}</div>
                              </div>
                            ) : (
                              <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>GES Education Office</span>
                            )}
                          </td>
                          <td style={{ padding: '16px 24px', color: '#4B5563' }}>{sub.category === 'School' ? sub.subject : 'N/A'}</td>
                          <td style={{ padding: '16px 24px', color: '#4B5563', fontSize: '13px' }}>{formatTimestamp(sub.submittedAt)}</td>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{ fontWeight: '600', color: sub.documents?.length === DOCUMENTS.length ? '#047857' : '#B45309' }}>
                              {sub.documents?.length || 0} / {DOCUMENTS.length}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                            <button
                              onClick={() => setSelectedSub(sub)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', backgroundColor: '#002147', color: '#FFF', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }}
                              onMouseOver={e => e.currentTarget.style.backgroundColor = '#001530'}
                              onMouseOut={e => e.currentTarget.style.backgroundColor = '#002147'}
                            >
                              View Docs <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
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
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#002147', margin: 0 }}>Registered Portal Users</h3>
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
                    {role === 'admin' && <th style={{ padding: '16px 24px', color: '#4B5563', fontWeight: '600', textAlign: 'center' }}>Change Role</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => {
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
                          <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                            <select
                              value={u.role || 'teacher'}
                              disabled={u.id === user?.uid} // prevent self-demotion
                              onChange={e => handleRoleChange(u.id, e.target.value)}
                              style={{ padding: '6px 10px', borderRadius: '6px', border: '1.5px solid #D1D5DB', fontSize: '12px', fontWeight: '600', cursor: u.id === user?.uid ? 'not-allowed' : 'pointer', outline: 'none' }}
                            >
                              <option value="teacher">Teacher</option>
                              <option value="metro_officer">Metro Officer</option>
                              <option value="editor">Editor</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab CONTENT 3: APP ANALYTICS */}
        {activeTab === 'analytics' && (() => {
          const schoolSubs = submissions.filter((s: any) => s.category === 'School').length;
          const officeSubs = submissions.filter((s: any) => s.category === 'Education Office').length;
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
          submissions.forEach((s: any) => {
            if (s.submittedByEmail) submitterMap[s.submittedByEmail] = (submitterMap[s.submittedByEmail] || 0) + 1;
          });
          const topSubmitters = Object.entries(submitterMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
          const maxSubmitter = topSubmitters[0]?.[1] || 1;

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
                {kpiCard(<TrendingUp size={22} />, 'Total Submissions', totalSubmissions, '#002147', 'all time')}
                {kpiCard(<FileText size={22} />, 'School Records', schoolSubs, '#0369A1', `${totalSubmissions ? Math.round(schoolSubs / totalSubmissions * 100) : 0}% of total`)}
                {kpiCard(<Building2 size={22} />, 'Education Office', officeSubs, '#B45309', `${totalSubmissions ? Math.round(officeSubs / totalSubmissions * 100) : 0}% of total`)}
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
      </div>

      {/* VIEW DOCUMENTS MODAL */}
      {selectedSub && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#002147', margin: 0 }}>{selectedSub.teacherName}</h3>
                <p style={{ fontSize: '12px', color: '#6B7280', margin: '4px 0 0' }}>
                  Submitted on {formatTimestamp(selectedSub.submittedAt)}
                </p>
              </div>
              <button 
                onClick={() => setSelectedSub(null)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9CA3AF', lineHeight: '1' }}
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '12px', marginBottom: '24px', fontSize: '13px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: '600' }}>Category</span>
                  <div style={{ fontWeight: '700', color: '#002147', marginTop: '2px' }}>{selectedSub.category}</div>
                </div>
                {selectedSub.category === 'School' && (
                  <>
                    <div>
                      <span style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: '600' }}>Circuit</span>
                      <div style={{ fontWeight: '700', color: '#002147', marginTop: '2px' }}>{selectedSub.circuit}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: '600' }}>School</span>
                      <div style={{ fontWeight: '700', color: '#002147', marginTop: '2px' }}>{selectedSub.school}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: '600' }}>Subject</span>
                      <div style={{ fontWeight: '700', color: '#002147', marginTop: '2px' }}>{selectedSub.subject}</div>
                    </div>
                  </>
                )}
                <div>
                  <span style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: '600' }}>Sex</span>
                  <div style={{ fontWeight: '700', color: '#002147', marginTop: '2px' }}>{selectedSub.sex || 'N/A'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: '600' }}>Submitted By Email</span>
                  <div style={{ fontWeight: '700', color: '#002147', marginTop: '2px' }}>{selectedSub.submittedByEmail || 'N/A'}</div>
                </div>
              </div>

              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#111827', margin: '0 0 12px' }}>Uploaded Documents Checklist</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {DOCUMENTS.map((docName, index) => {
                  const matchingDoc = selectedSub.documents?.find((d: any) => d.documentType === docName);
                  
                  return (
                    <div 
                      key={index} 
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                        padding: '12px 16px', borderRadius: '10px', border: '1.5px solid',
                        borderColor: matchingDoc ? '#ECFDF5' : '#F3F4F6',
                        backgroundColor: matchingDoc ? '#F0FDF4' : '#FAFAFA'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1, marginRight: '16px' }}>
                        <div style={{ 
                          width: '20px', height: '20px', borderRadius: '50%', 
                          backgroundColor: matchingDoc ? '#10B981' : '#9CA3AF',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px'
                        }}>
                          <span style={{ fontSize: '11px', color: '#FFF', fontWeight: 'bold' }}>{index + 1}</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: matchingDoc ? '#065F46' : '#4B5563', lineHeight: '1.4' }}>
                          {docName}
                        </span>
                      </div>

                      {matchingDoc ? (
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

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#F9FAFB', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
              <button 
                onClick={() => setSelectedSub(null)}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #D1D5DB', backgroundColor: '#FFFFFF', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
      <Footer theme="light" />
    </div>
  );
}
