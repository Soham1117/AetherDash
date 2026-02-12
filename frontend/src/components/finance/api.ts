import axios from 'axios';

// Create generic axios instance
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', // Backend routes are at root (e.g. /accounts/)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to inject auth token
api.interceptors.request.use((config) => {
  // Tokens are stored as JSON object in 'authTokens' key
  const storedTokens = localStorage.getItem('authTokens');
  if (storedTokens) {
    try {
      const tokens = JSON.parse(storedTokens);
      if (tokens.access) {
        config.headers.Authorization = `Bearer ${tokens.access}`;
      }
    } catch (e) {
      console.error('Error parsing auth tokens:', e);
    }
  }
  return config;
});

// Add response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      localStorage.removeItem('authTokens');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
