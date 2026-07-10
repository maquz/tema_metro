import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Link } from 'react-router-dom';
import { Lock, Mail, Key, Eye, EyeOff, User } from 'lucide-react';
import Footer from '../components/Footer';

export default function Signup() {
  const [selectedRole, setSelectedRole] = useState<'teacher' | 'admin'>('teacher');
  const [staffId, setStaffId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [secretCode, setSecretCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);


  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Determine role
    let role = 'teacher';
    if (selectedRole === 'admin') {
      if (secretCode === '436') {
        role = 'admin';
      } else if (secretCode === 'TEMA_EDITOR_2026') {
        role = 'editor';
      } else if (secretCode === 'TEMA_METRO_2026') {
        role = 'metro_officer';
      } else {
        setError('Invalid secret code.');
        setLoading(false);
        return;
      }
    }

    try {
      const staffIdTrimmed = staffId.trim();

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Save role and staffId
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email,
        role,
        staffId: staffIdTrimmed,
        createdAt: new Date().toISOString()
      });
      // Perform a hard redirect to the correct dashboard to guarantee clean load and bypass race conditions.
      if (role === 'admin' || role === 'editor') {
        window.location.href = '/admin';
      } else if (role === 'metro_officer') {
        window.location.href = '/metro';
      } else {
        window.location.href = '/teacher';
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please log in instead.');
      } else {
        setError('Failed to sign up. Check if the email is valid and password is > 6 chars.');
      }
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#020B1E',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Ghana colour strip */}
      <div style={{ height: '4px', width: '100%', display: 'flex', flexShrink: 0 }}>
        <div style={{ flex: 1, backgroundColor: '#CE1126' }} />
        <div style={{ flex: 1, backgroundColor: '#FCD116' }} />
        <div style={{ flex: 1, backgroundColor: '#006B3F' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1.5px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '36px 32px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div
              onClick={() => (window.location.href = '/')}
              title="Click to Refresh & Return to Landing Page"
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <img src="/logo.png" alt="GES Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          </div>

          <h1 style={{ textAlign: 'center', color: '#FFFFFF', marginBottom: '8px', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em' }}>Sign Up</h1>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', marginBottom: '24px', fontSize: '14px', fontWeight: '500' }}>Teacher or Metro Staff</p>

          {error && (
            <div style={{ backgroundColor: 'rgba(206,17,38,0.15)', border: '1px solid rgba(206,17,38,0.3)', color: '#FF8A8A', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', lineHeight: '1.5', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSignup}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '6px' }}>
              <button
                type="button"
                onClick={() => { setSelectedRole('teacher'); setSecretCode(''); setError(''); }}
                style={{ flex: 1, padding: '10px 6px', borderRadius: '8px', border: selectedRole === 'teacher' ? '1.5px solid rgba(255,255,255,0.4)' : '1.5px solid transparent', backgroundColor: selectedRole === 'teacher' ? 'rgba(255,255,255,0.1)' : 'transparent', color: selectedRole === 'teacher' ? '#FFF' : 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Teacher
              </button>
              <button
                type="button"
                onClick={() => { setSelectedRole('admin'); setError(''); }}
                style={{ flex: 1, padding: '10px 6px', borderRadius: '8px', border: selectedRole === 'admin' ? '1.5px solid rgba(255,255,255,0.4)' : '1.5px solid transparent', backgroundColor: selectedRole === 'admin' ? 'rgba(255,255,255,0.1)' : 'transparent', color: selectedRole === 'admin' ? '#FFF' : 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Admin / Metro
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Staff ID</label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" value={staffId} onChange={e => setStaffId(e.target.value)} required
                  style={{ width: '100%', padding: '13px 14px 13px 42px', borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '14px', color: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                  placeholder="Enter your Staff ID" />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  style={{ width: '100%', padding: '13px 14px 13px 42px', borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '14px', color: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                  placeholder="Enter your email" />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                  style={{ width: '100%', padding: '13px 40px 13px 42px', borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '14px', color: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                  placeholder="Min 6 characters" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showPassword ? <EyeOff size={16} color="rgba(255,255,255,0.4)" /> : <Eye size={16} color="rgba(255,255,255,0.4)" />}
                </button>
              </div>
            </div>
            {selectedRole === 'admin' && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Admin / Metro Secret Code</label>
                <div style={{ position: 'relative' }}>
                  <Key size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="text" value={secretCode} onChange={e => setSecretCode(e.target.value)} required={selectedRole === 'admin'}
                    style={{ width: '100%', padding: '13px 14px 13px 42px', borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '14px', color: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                    placeholder="Enter Admin code" />
                </div>
              </div>
            )}
            <button disabled={loading}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #002147, #001530)', color: '#FFFFFF', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Creating account…' : 'Sign Up'}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#4FA3FF', fontWeight: '700', textDecoration: 'none' }}>Log In</Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
