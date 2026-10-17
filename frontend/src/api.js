import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:10000/api',
});

api.interceptors.request.use((config) => {
  // Търси token в localStorage (запомнен) или sessionStorage (незапомнен)
  const token =
    localStorage.getItem('domoupravitel_token') ||
    sessionStorage.getItem('domoupravitel_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('domoupravitel_token');
      localStorage.removeItem('domoupravitel_user');
      sessionStorage.removeItem('domoupravitel_token');
      sessionStorage.removeItem('domoupravitel_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;