/**
 * AuthContext — Manages user authentication state.
 *
 * Provides: { user, login, logout, loading, isAdmin }
 * Persists JWT token + user object in localStorage.
 * On mount: restores session from localStorage if token exists.
 * On login: stores token, creates shift record on server.
 * On logout: ends shift, clears token + user from storage.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      api.setToken(token);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    api.setToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    window.dispatchEvent(new Event('auth-login'));
    return data;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // ignore
    }
    api.setToken(null);
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
