import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Key } from 'lucide-react';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Determine role
    let role = 'teacher';
    if (secretCode) {
      if (secretCode === 'TEMA_ADMIN_2026') {
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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Save role
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email,
        role,
        createdAt: new Date().toISOString()
      });
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError('Failed to sign up. Check if the email is valid and password is > 6 chars.');
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px' }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div 
            onClick={() => window.location.href = '/'}
            style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#002147', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', cursor: 'pointer' }}
            title="Click to Refresh & Return to Landing Page"
          >
            <img src="/logo.png" alt="GES Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.5))' }} />
          </div>
        </div>
        <h2 style={{ textAlign: 'center', color: '#002147', marginBottom: '8px', fontSize: '24px', fontWeight: '800' }}>Sign Up</h2>
        <p style={{ textAlign: 'center', color: '#6B7280', marginBottom: '24px', fontSize: '14px', fontWeight: '500' }}>Teacher or Metro Staff</p>
        
        {error && <div style={{ backgroundColor: '#FEE2E2', color: '#CE1126', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}
        
        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px', textTransform: 'uppercase' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#9CA3AF" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: '10px', border: '1.5px solid #D1D5DB', fontSize: '14px', outline: 'none' }} placeholder="Enter your email" />
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px', textTransform: 'uppercase' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#9CA3AF" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: '10px', border: '1.5px solid #D1D5DB', fontSize: '14px', outline: 'none' }} placeholder="Min 6 characters" />
            </div>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px', textTransform: 'uppercase' }}>Admin Secret Code (Optional)</label>
            <div style={{ position: 'relative' }}>
              <Key size={18} color="#9CA3AF" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" value={secretCode} onChange={e => setSecretCode(e.target.value)} style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: '10px', border: '1.5px solid #D1D5DB', fontSize: '14px', outline: 'none' }} placeholder="Leave blank if you are a teacher" />
            </div>
          </div>
          <button disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #002147, #001530)', color: '#FFFFFF', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#6B7280' }}>
          Already have an account? <Link to="/login" style={{ color: '#002147', fontWeight: '600', textDecoration: 'none' }}>Log In</Link>
        </div>
      </div>
    </div>
  );
}
