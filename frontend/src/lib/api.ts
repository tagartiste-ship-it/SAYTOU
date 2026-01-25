import axios from 'axios';

const envBase = import.meta.env.VITE_API_URL;
const API_URL = envBase
  ? (() => {
      const normalizedBase = envBase.replace(/\/+$/, '');
      return /\/api$/.test(normalizedBase) ? normalizedBase : `${normalizedBase}/api`;
    })()
  : import.meta.env.DEV
    ? '/api'
    : 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<string> | null = null;

// Intercepteur pour ajouter le token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    const headers: any = config.headers ?? {};
    if (typeof headers.set === 'function') {
      headers.set('Authorization', `Bearer ${token}`);
    } else {
      headers.Authorization = `Bearer ${token}`;
    }
    config.headers = headers;
  }
  return config;
});

// Intercepteur pour gérer le refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const reqUrl: string = originalRequest?.url ?? '';
    const isAuthEndpoint = /\/auth\/(login|refresh|logout|signup)/.test(reqUrl);

    if (error.response?.status === 401 && !originalRequest) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.replace('/login');
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !isAuthEndpoint && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.replace('/login');
          return Promise.reject(error);
        }

        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_URL}/auth/refresh`, {
              refreshToken,
            })
            .then((response) => {
              const { accessToken } = response.data;
              localStorage.setItem('accessToken', accessToken);
              return accessToken as string;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newAccessToken = await refreshPromise;

        const headers: any = originalRequest.headers ?? {};
        if (typeof headers.set === 'function') {
          headers.set('Authorization', `Bearer ${newAccessToken}`);
        } else {
          headers.Authorization = `Bearer ${newAccessToken}`;
        }
        originalRequest.headers = headers;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.replace('/login');
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.replace('/login');
    }

    return Promise.reject(error);
  }
);

export default api;
