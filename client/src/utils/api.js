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

export default apiClient;

