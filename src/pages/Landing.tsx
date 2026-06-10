import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FileText, Shield, LogOut, ArrowRight, UserCheck } from 'lucide-react';

export default function Landing() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const handleTeacherClick = () => {
    if (user) {
      navigate('/teacher');
    } else {
      navigate('/login');
    }
  };

  const handleMetroClick = () => {
    if (user) {
      if (role === 'metro_officer') {
        navigate('/metro');
      } else {
        navigate('/teacher');
      }
    } else {
      navigate('/login');
    }
  };

  const handleAdminClick = () => {
    if (user) {
      if (role === 'admin' || role === 'editor') {
        navigate('/admin');
      } else {
        alert('Access Denied: You do not have administrator permissions.');
      }
    } else {
      navigate('/login');
    }
  };

  const handleLogoRefresh = () => {
    // Perform a hard page reload to reset state and refresh the landing page
    window.location.href = '/';
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#020B1E',
      color: '#FFFFFF',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Background Decorative Glows */}
      <div style={{
        position: 'absolute',
        top: '-15%',
        left: '-10%',
        width: '50vw',
        height: '50vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 33, 71, 0.4) 0%, rgba(206, 17, 38, 0.05) 50%, rgba(0, 0, 0, 0) 100%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-10%',
        width: '60vw',
        height: '60vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(252, 209, 22, 0.06) 0%, rgba(0, 107, 63, 0.05) 50%, rgba(0, 0, 0, 0) 100%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Ghana Color Strip Accent */}
      <div style={{ height: '5px', width: '100%', display: 'flex', zIndex: 10 }}>
        <div style={{ flex: 1, backgroundColor: '#CE1126' }} />
        <div style={{ flex: 1, backgroundColor: '#FCD116' }} />
        <div style={{ flex: 1, backgroundColor: '#006B3F' }} />
      </div>

      {/* Header */}
      <header style={{
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(10px)',
        zIndex: 10
      }}>
        <div 
          onClick={handleLogoRefresh}
          style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', userSelect: 'none' }}
          title="Click to Refresh Portal"
        >
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)'
          }}>
            <img src="/logo.png" alt="GES Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ghana Education Service</div>
            <div style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: '800', lineHeight: '1.2' }}>Tema Metro Directorate</div>
          </div>
        </div>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '12px' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600' }}>{user.email}</span>
              <span style={{ color: '#FCD116', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '9px', marginTop: '2px' }}>
                Role: {role === 'metro_officer' ? 'Education Officer' : role === 'teacher' ? 'Teacher' : role}
              </span>
            </div>
            <button
              onClick={logout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(206, 17, 38, 0.15)',
                border: '1px solid rgba(206, 17, 38, 0.3)',
                borderRadius: '8px',
                color: '#FF6B6B',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(206, 17, 38, 0.25)'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(206, 17, 38, 0.15)'}
            >
              <LogOut size={13} /> Log Out
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#FFFFFF',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Log In
            </button>
            <button
              onClick={() => navigate('/signup')}
              style={{
                backgroundColor: '#002147',
                border: '1.5px solid #003366',
                borderRadius: '8px',
                color: '#FFFFFF',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#003366'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#002147'}
            >
              Sign Up
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 20px',
        zIndex: 5,
        position: 'relative'
      }}>
        {/* Portal Info Alert if refreshed */}
        <div style={{
          textAlign: 'center',
          maxWidth: '800px',
          marginBottom: '50px'
        }}>
          <span style={{
            backgroundColor: 'rgba(252, 209, 22, 0.1)',
            border: '1px solid rgba(252, 209, 22, 0.25)',
            color: '#FCD116',
            fontSize: '11px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            padding: '6px 14px',
            borderRadius: '20px',
            display: 'inline-block',
            marginBottom: '16px'
          }}>
            GES DOCUMENT SUBMISSION PORTAL
          </span>
          <h1 style={{
            fontSize: '44px',
            fontWeight: '900',
            margin: '0 0 16px',
            lineHeight: '1.15',
            background: 'linear-gradient(to right, #FFFFFF, #B9D1EC)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            GES Tema Metro Records & Filing
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#A0AEC0',
            margin: '0 auto',
            maxWidth: '600px',
            lineHeight: '1.6'
          }}>
            Submit, process, and file your professional documents securely. 
            Designed for Tema Metro teachers and administrative staff.
          </p>
        </div>

        {/* Action Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '30px',
          width: '100%',
          maxWidth: '1200px',
          marginBottom: '50px'
        }}>
          {/* Teacher Card */}
          <div 
            onClick={handleTeacherClick}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1.5px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '20px',
              padding: '32px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.borderColor = 'rgba(0, 33, 71, 0.8)';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
            }}
          >
            {/* Top-Right Ambient Glow */}
            <div style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 33, 71, 0.2)',
              filter: 'blur(20px)',
              pointerEvents: 'none'
            }} />

            <div>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                backgroundColor: 'rgba(0, 33, 71, 0.3)',
                border: '1.5px solid rgba(0, 33, 71, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4FA3FF',
                marginBottom: '24px'
              }}>
                <FileText size={26} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF', margin: '0 0 10px' }}>Teacher Portal</h2>
              <p style={{ fontSize: '14px', color: '#A0AEC0', lineHeight: '1.5', margin: '0 0 24px' }}>
                Upload or capture photos of your required document files (Appointment, Personal Record, Certificates, Promotion letters). 
                Designed for Teachers to securely file documents with the school and circuit details.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4FA3FF', fontSize: '14px', fontWeight: '700' }}>
              {user && role === 'teacher' ? 'Go to Submission Form' : 'Log In as Teacher'} 
              <ArrowRight size={16} />
            </div>
          </div>

          {/* Metro Officer Card */}
          <div 
            onClick={handleMetroClick}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1.5px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '20px',
              padding: '32px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.borderColor = 'rgba(252, 209, 22, 0.8)';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
            }}
          >
            {/* Top-Right Ambient Glow */}
            <div style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              backgroundColor: 'rgba(252, 209, 22, 0.15)',
              filter: 'blur(20px)',
              pointerEvents: 'none'
            }} />

            <div>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                backgroundColor: 'rgba(252, 209, 22, 0.15)',
                border: '1.5px solid rgba(252, 209, 22, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FCD116',
                marginBottom: '24px'
              }}>
                <FileText size={26} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF', margin: '0 0 10px' }}>Metro Officer Portal</h2>
              <p style={{ fontSize: '14px', color: '#A0AEC0', lineHeight: '1.5', margin: '0 0 24px' }}>
                Upload or capture photos of required documents specifically for the Education Office. 
                Auto-filed under the Metro Officer directory for fast processing.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FCD116', fontSize: '14px', fontWeight: '700' }}>
              {user && role === 'metro_officer' ? 'Go to Submission Form' : 'Log In as Metro Officer'} 
              <ArrowRight size={16} />
            </div>
          </div>

          {/* Admin Card */}
          <div 
            onClick={handleAdminClick}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1.5px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '20px',
              padding: '32px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.borderColor = 'rgba(206, 17, 38, 0.5)';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
            }}
          >
            {/* Top-Right Ambient Glow */}
            <div style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              backgroundColor: 'rgba(206, 17, 38, 0.1)',
              filter: 'blur(20px)',
              pointerEvents: 'none'
            }} />

            <div>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                backgroundColor: 'rgba(206, 17, 38, 0.15)',
                border: '1.5px solid rgba(206, 17, 38, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FF6B6B',
                marginBottom: '24px'
              }}>
                <Shield size={26} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF', margin: '0 0 10px' }}>Administration</h2>
              <p style={{ fontSize: '14px', color: '#A0AEC0', lineHeight: '1.5', margin: '0 0 24px' }}>
                Access the records monitor to filter, verify, and check documents submitted by teachers. 
                Manage user access levels (Admin / Editor) and export reports to CSV.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FF6B6B', fontSize: '14px', fontWeight: '700' }}>
              {user && (role === 'admin' || role === 'editor') ? 'Go to Admin Dashboard' : 'Access Administration Panel'}
              <ArrowRight size={16} />
            </div>
          </div>
        </div>

        {/* Quick Help Tip */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '16px 24px',
          maxWidth: '700px',
          textAlign: 'left',
          display: 'flex',
          gap: '14px',
          alignItems: 'center'
        }}>
          <UserCheck size={20} color="#FCD116" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: '#A0AEC0', lineHeight: '1.5' }}>
            <strong>System Tip:</strong> Clicking the <strong>GES Tema Metro Logo</strong> in the top header at any point reloads the portal and returns you to this landing screen.
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '24px 40px',
        textAlign: 'center',
        fontSize: '12px',
        color: '#718096',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        marginTop: 'auto',
        zIndex: 10
      }}>
        Ghana Education Service — Tema Metro Directorate © 2026. All rights reserved.<br/>
        Developed by Mark Anibrika ICT Coordinator (Tema Metro)
      </footer>
    </div>
  );
}
