import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import TeacherForm from './pages/TeacherForm';
import AdminDashboard from './pages/AdminDashboard';

// Route protection for authenticated users
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, role, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Fallback to 'teacher' for legacy users who might have no role field in Firestore
  const finalRole = role || 'teacher';

  // If the route has restricted roles and the user's role is not permitted, redirect
  if (allowedRoles && !allowedRoles.includes(finalRole)) {
    if (finalRole === 'teacher') {
      return <Navigate to="/teacher" replace />;
    } else if (finalRole === 'metro_officer') {
      return <Navigate to="/metro" replace />;
    } else {
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
}

// Redirect already logged-in users away from auth pages
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();

  if (loading) return null;

  if (user) {
    // Fallback to 'teacher' for legacy users who might have no role field in Firestore
    const finalRole = role || 'teacher';
    if (finalRole === 'admin' || finalRole === 'editor') {
      return <Navigate to="/admin" replace />;
    }
    if (finalRole === 'metro_officer') {
      return <Navigate to="/metro" replace />;
    }
    return <Navigate to="/teacher" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Landing Page */}
          <Route 
            path="/" 
            element={
              <PublicRoute>
                <Landing />
              </PublicRoute>
            } 
          />

          {/* Public Authentication Routes */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          <Route 
            path="/signup" 
            element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            } 
          />

          {/* Protected Forms / App Views */}
          <Route 
            path="/teacher" 
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <TeacherForm />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/metro" 
            element={
              <ProtectedRoute allowedRoles={['metro_officer']}>
                <TeacherForm />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'editor']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Fallback Redirection */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
