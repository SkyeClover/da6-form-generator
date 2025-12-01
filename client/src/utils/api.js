import { supabase } from '../lib/supabase';
import axios from 'axios';

/**
 * Get the current session token from Supabase
 */
export const getSessionToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
};

/**
 * Create an axios instance with automatic token injection
 */
export const apiClient = axios.create({
  baseURL: '/api',
});

// Add request interceptor to include auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getSessionToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      // Check if we're already on the login page to avoid redirect loops
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        // Sign out and redirect to login
        await supabase.auth.signOut();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

