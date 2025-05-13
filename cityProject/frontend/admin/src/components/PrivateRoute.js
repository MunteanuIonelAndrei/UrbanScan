import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Component to protect routes that require authentication
function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  // If still loading, you might want to show a spinner or loading message
  if (loading) {
    return <div>Loading...</div>;
  }
  
  // If not authenticated, redirect to login page
  // Pass the current location to the login page so it can redirect back after login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // If authenticated, render the protected component
  return children;
}

export default PrivateRoute;