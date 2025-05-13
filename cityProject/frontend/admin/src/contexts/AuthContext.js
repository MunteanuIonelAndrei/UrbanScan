import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

// Configure axios defaults
axios.defaults.baseURL = 'http://localhost:8000';

// Add a function to get the API URL for files
export const getApiUrl = (path) => {
  return `${axios.defaults.baseURL}${path}`;
};

// Create the auth context
const AuthContext = createContext(null);

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Check if token is expired
  const isTokenExpired = (token) => {
    if (!token) return true;
    
    try {
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      
      return decoded.exp < currentTime;
    } catch (error) {
      console.error('Error decoding token:', error);
      return true;
    }
  };

  // Set token in axios headers and localStorage
  const setAuthToken = (token) => {
    if (token) {
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  // Login function
  const login = async (username, password) => {
    try {
      setError('');
      
      // Create form data (application/x-www-form-urlencoded format)
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      
      const response = await axios.post('/api/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      const { access_token } = response.data;
      
      setToken(access_token);
      setAuthToken(access_token);
      
      // Fetch user profile after successful login
      try {
        const userResponse = await axios.get('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });
        setCurrentUser(userResponse.data);
      } catch (profileError) {
        console.error('Error fetching user profile:', profileError);
      }
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      setError(error.response?.data?.detail || 'Failed to login');
      return false;
    }
  };

  // Logout function
  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    setAuthToken(null);
  };

  // Effect to check token on startup
  useEffect(() => {
    const initAuth = async () => {
      if (token && !isTokenExpired(token)) {
        setAuthToken(token);
        
        try {
          // Fetch user profile
          const response = await axios.get('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          setCurrentUser(response.data);
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
          setToken(null);
          setAuthToken(null);
        }
      } else if (token) {
        // Token is expired
        console.log('Token is expired');
        setToken(null);
        setAuthToken(null);
      }
      
      setLoading(false);
    };
    
    initAuth();
  }, [token]);

  // Provide auth context
  const value = {
    currentUser,
    token,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!token && !isTokenExpired(token),
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;