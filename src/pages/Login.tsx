import { useState } from 'react';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Mail, GraduationCap, Building2, ShieldCheck, ShieldAlert, Eye, EyeOff, User } from 'lucide-react';
import Footer from '../components/Footer';

type RoleOption = 'teacher' | 'metro_officer' | 'admin';

const ROLE_CONFIG: Record<RoleOption, {
  label: string;
  caption: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
}> = {
  teacher: {
    label: 'Teacher',
    caption: 'Teacher Portal',
    icon: <GraduationCap size={18} />,
    color: '#4FA3FF',
    bg: 'rgba(79,163,255,0.12)',
    border: '#4FA3FF',
  },
  metro_officer: {
    label: 'Metro Officer',
    caption: 'Metro Officer Portal',
    icon: <Building2 size={18} />,
    color: '#FCD116',
    bg: 'rgba(252,209,22,0.12)',
    border: '#FCD116',
  },
  admin: {
    label: 'Admin',
    caption: 'Administration Panel',
    icon: <ShieldCheck size={18} />,
    color: '#FF6B6B',
    bg: 'rgba(255,107,107,0.12)',
    border: '#FF6B6B',
  },
};

// Map actual Firestore roles → display labels for error messages
const ROLE_DISPLAY: Record<string, string> = {
  teacher: 'Teacher',
  metro_officer: 'Metro Officer',
  admin: 'Admin',
  editor: 'Editor (Admin)',
};

export default function Login() {
  const [searchParams] = useSearchParams();
  const initialRole = (searchParams.get('role') as RoleOption) || 'teacher';

  const [selectedRole, setSelectedRole] = useState<RoleOption>(
    Object.keys(ROLE_CONFIG).includes(initialRole) ? initialRole : 'teacher'
  );
  const [staffId, setStaffId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [secretCode, setSecretCode] = useState('');
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address above to reset your password.');
      return;
    }
    setError('');
    setResetMessage('');
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      console.error(err);
      setError('Failed to send reset email. Please try again.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (selectedRole === 'admin' && secretCode !== '436') {
        setError('Invalid secret code for Admin login.');
        setLoading(false);
        return;
      }

      // Step 1: Sign in with Firebase Auth
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const uid = credential.user.uid;

      // Step 2: Fetch Firestore role and Staff ID
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.exists() ? userDocSnap.data() : {};
      const firestoreRole: string = userData.role ?? 'teacher';
      const firestoreStaffId: string | undefined = userData.staffId;

      // Step 3: Staff ID Migration / Validation Check
      if (!firestoreStaffId) {
        // Migration: save entered staff ID
        await setDoc(userDocRef, { staffId: staffId.trim() }, { merge: true });
      } else if (firestoreStaffId !== staffId.trim()) {
        await signOut(auth);
        setError('Invalid Staff ID for this account.');
        setLoading(false);
        return;
      }

      // Step 4: Validate role vs selected portal
      const isAdminPortal = selectedRole === 'admin';
      const roleMatchesPortal =
        (selectedRole === 'teacher' && firestoreRole === 'teacher') ||
        (selectedRole === 'metro_officer' && firestoreRole === 'metro_officer') ||
        (isAdminPortal && (firestoreRole === 'admin' || firestoreRole === 'editor'));

      if (!roleMatchesPortal) {
        // Sign out immediately — wrong portal
        await signOut(auth);
        const actualLabel = ROLE_DISPLAY[firestoreRole] ?? firestoreRole;
        const expectedPortal =
          firestoreRole === 'teacher' ? 'Teacher'
          : firestoreRole === 'metro_officer' ? 'Metro Officer'
          : 'Admin';
        setError(
          `This email is registered as "${actualLabel}". Please use the ${expectedPortal} login portal instead.`
        );
        setLoading(false);
        return;
      }

      // Step 5: Sign-in is valid.
      // Perform a hard redirect using window.location.href as a secondary fail-safe.
      // This resets state, bypasses routing race conditions, and guarantees clean dashboard mounting.
      if (firestoreRole === 'admin' || firestoreRole === 'editor') {
        window.location.href = '/admin';
      } else if (firestoreRole === 'metro_officer') {
        window.location.href = '/metro';
      } else {
        window.location.href = '/teacher';
      }

    } catch (err: any) {
      console.error(err);
      setError('Failed to log in. Please check your email and password.');
      setLoading(false);
    }
  };

  const cfg = ROLE_CONFIG[selectedRole];

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

      {/* Main card area */}
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
          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div
              onClick={() => (window.location.href = '/')}
              title="Return to Landing Page"
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

          {/* Title */}
          <h1
            style={{
              textAlign: 'center',
              color: '#FFFFFF',
              margin: '0 0 6px',
              fontSize: '26px',
              fontWeight: '800',
              letterSpacing: '-0.02em',
            }}
          >
            Login
          </h1>

          {/* Dynamic caption — changes with badge selection */}
          <p
            style={{
              textAlign: 'center',
              color: cfg.color,
              marginBottom: '24px',
              fontSize: '14px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              transition: 'color 0.2s',
            }}
          >
            {cfg.caption}
          </p>

          {/* Role Badge Selector */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '24px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '12px',
              padding: '6px',
            }}
          >
            {(Object.entries(ROLE_CONFIG) as [RoleOption, typeof ROLE_CONFIG[RoleOption]][]).map(([key, conf]) => {
              const isActive = selectedRole === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedRole(key);
                    setError('');
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '10px 6px',
                    borderRadius: '8px',
                    border: isActive ? `1.5px solid ${conf.border}` : '1.5px solid transparent',
                    backgroundColor: isActive ? conf.bg : 'transparent',
                    color: isActive ? conf.color : 'rgba(255,255,255,0.4)',
                    fontSize: '11px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = conf.color;
                      e.currentTarget.style.backgroundColor = conf.bg;
                    }
                  }}
                  onMouseOut={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {conf.icon}
                  {conf.label}
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                backgroundColor: 'rgba(206,17,38,0.15)',
                border: '1px solid rgba(206,17,38,0.3)',
                color: '#FF8A8A',
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '13px',
                lineHeight: '1.5',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          {resetMessage && (
            <div
              style={{
                backgroundColor: 'rgba(0,107,63,0.15)',
                border: '1px solid rgba(0,107,63,0.3)',
                color: '#8AFFC2',
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '13px',
                lineHeight: '1.5',
                textAlign: 'center',
              }}
            >
              {resetMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Staff ID
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={staffId}
                  onChange={e => setStaffId(e.target.value)}
                  required
                  placeholder="Enter your Staff ID"
                  style={{
                    width: '100%',
                    padding: '13px 14px 13px 42px',
                    borderRadius: '10px',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    fontSize: '14px',
                    color: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = cfg.color)}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  style={{
                    width: '100%',
                    padding: '13px 14px 13px 42px',
                    borderRadius: '10px',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    fontSize: '14px',
                    color: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = cfg.color)}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Password
                </label>
                <span
                  onClick={handleResetPassword}
                  style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: cfg.color,
                    cursor: 'pointer',
                  }}
                >
                  Forgot Password?
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  style={{
                    width: '100%',
                    padding: '13px 40px 13px 42px',
                    borderRadius: '10px',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    fontSize: '14px',
                    color: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = cfg.color)}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={16} color="rgba(255,255,255,0.4)" /> : <Eye size={16} color="rgba(255,255,255,0.4)" />}
                </button>
              </div>
            </div>

            {selectedRole === 'admin' && (
              <div style={{ marginBottom: '24px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: 'rgba(255,255,255,0.5)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Admin Secret Code
                </label>
                <div style={{ position: 'relative' }}>
                  <ShieldAlert size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    value={secretCode}
                    onChange={e => setSecretCode(e.target.value)}
                    placeholder="Enter Admin code"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 40px',
                      borderRadius: '10px',
                      border: '1.5px solid rgba(255,255,255,0.1)',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      color: '#FFF',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = cfg.border;
                      e.target.style.boxShadow = `0 0 0 3px ${cfg.border}40`;
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: loading
                  ? 'rgba(255,255,255,0.1)'
                  : `linear-gradient(135deg, ${cfg.color}33, ${cfg.color}22)`,
                borderTop: `2px solid ${cfg.color}66`,
                color: loading ? 'rgba(255,255,255,0.4)' : cfg.color,
                fontSize: '15px',
                fontWeight: '800',
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.04em',
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Verifying…' : `Log In as ${cfg.label}`}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: cfg.color, fontWeight: '700', textDecoration: 'none' }}>
              Sign Up
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
