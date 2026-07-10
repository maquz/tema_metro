import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthContextType {
  user: User | null;
  role: string | null;
  staffId: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  staffId: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<{
    user: User | null;
    role: string | null;
    staffId: string | null;
    loading: boolean;
  }>({
    user: null,
    role: null,
    staffId: null,
    loading: true,
  });

  const { user, role, staffId, loading } = authState;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Set loading back to true while fetching the new user's document/role
        setAuthState(prev => ({ ...prev, loading: true }));

        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          let fetchedRole = docSnap.exists() ? (docSnap.data().role || null) : null;
          const fetchedStaffId = docSnap.exists() ? (docSnap.data().staffId || null) : null;
          
          // Emergency restore for admin user
          if (firebaseUser.email === 'anibrika@gmail.com' && fetchedRole !== 'admin') {
            fetchedRole = 'admin';
            await setDoc(docRef, { role: 'admin' }, { merge: true });
          }

          setAuthState({
            user: firebaseUser,
            role: fetchedRole,
            staffId: fetchedStaffId,
            loading: false,
          });
        } catch (error) {
          console.error('Error fetching user document:', error);
          setAuthState({
            user: firebaseUser,
            role: null,
            staffId: null,
            loading: false,
          });
        }
      } else {
        setAuthState({
          user: null,
          role: null,
          staffId: null,
          loading: false,
        });
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Presence logic
  useEffect(() => {
    if (!user) return;

    const updatePresence = async (online: boolean) => {
      try {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, {
          isOnline: online,
          lastActive: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error('Failed to update presence status:', err);
      }
    };

    // Set online immediately
    updatePresence(true);

    const handleUnload = () => {
      // Best-effort offline update on window unload
      updatePresence(false);
    };

    window.addEventListener('beforeunload', handleUnload);

    // Heartbeat to keep active
    const intervalId = setInterval(() => {
      updatePresence(true);
    }, 120000); // every 2 minutes

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleUnload);
      updatePresence(false);
    };
  }, [user]);

  const logout = async () => {
    if (user) {
      try {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, {
          isOnline: false,
          lastActive: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error('Failed to set offline state on logout:', err);
      }
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, role, staffId, loading, logout }}>
      {loading ? (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#002147', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#FFF', gap: '16px', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
            <img src="/logo.png" alt="GES Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Loading Tema Metro Portal...</div>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};
