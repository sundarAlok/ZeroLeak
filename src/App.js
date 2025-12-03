import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import FeatureScreen from './pages/FeatureScreen';
import Login from './pages/auth/Login';
import Onboarding from './pages/auth/Onboarding';
import Chat from './pages/main/Chat';
import Moments from './pages/main/Moments';
import Profile from './pages/main/Profile';
import MainLayout from './pages/main/MainLayout';
import './App.css';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
          
            {/* Auth routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Protected main routes (each wrapped with MainLayout to show bottom tabs) */}
            <Route path="/chat" element={<ProtectedRoute><MainLayout><Chat /></MainLayout></ProtectedRoute>} />
            <Route path="/moments" element={<ProtectedRoute><MainLayout><Moments /></MainLayout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><MainLayout><Profile /></MainLayout></ProtectedRoute>} />

            {/* Root shows Feature / splash screen */}
            <Route path="/" element={<FeatureScreen />} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
