import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
// Support multiple fallback IP addresses to avoid conflicts across networks.
// Add as many as you need; the client will automatically rotate on network errors
// and also remember the last working base URL between app launches.
const CANDIDATE_BASE_URLS: string[] = __DEV__
? [
  // 'http://192.168.254.114:8000',
  // 'http://192.168.254.102:8000',
  'http://10.0.9.160:8000',
  // 'http://192.168.0.123:8000',
  // 'http://192.168.30.127:8000',
  // 'http://192.168.8.43:8000',
  'http://localhost:8000',
]
: [
  // 'http://192.168.254.102:8000',
  // 'http://192.168.8.43:8000',
  // 'http://192.168.30.127:8000',
  // 'http://192.168.0.123:8000',
  // 'http://192.168.254.114:8000',
  'http://10.0.9.160:8000',
  // You can add your production domain here as the first item when available
  // 'https://api.your-domain.com'
];

let currentBaseUrlIndex = 0;
let initializedBaseUrl = false;
const API_BASE_URL = CANDIDATE_BASE_URLS[currentBaseUrlIndex];
  
// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // Lazy-initialize baseURL from storage (remember last good URL)
      if (!initializedBaseUrl) {
        const stored = await AsyncStorage.getItem('apiBaseUrl');
        const idx = stored ? CANDIDATE_BASE_URLS.indexOf(stored) : -1;
        if (idx >= 0) {
          currentBaseUrlIndex = idx;
          apiClient.defaults.baseURL = CANDIDATE_BASE_URLS[currentBaseUrlIndex];
        }
        initializedBaseUrl = true;
      }

      const token = await AsyncStorage.getItem('authToken');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // Silently handle auth token error
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    // Handle 401 unauthorized errors
    if (error.response?.status === 401) {
      try {
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('userData');
        // Session expired, user will be redirected to login
      } catch (storageError) {
        // Silently handle storage clearing error
      }
    }

    // Network error: try next base URL and retry the request (once per URL)
    const isNetworkError = !error.response;
    const originalRequest = error.config as InternalAxiosRequestConfig & { __retryCount?: number };
    if (isNetworkError && originalRequest) {
      const retryCount = originalRequest.__retryCount ?? 0;
      if (retryCount < CANDIDATE_BASE_URLS.length - 1) {
        // Rotate to next base URL
        currentBaseUrlIndex = (currentBaseUrlIndex + 1) % CANDIDATE_BASE_URLS.length;
        const nextBase = CANDIDATE_BASE_URLS[currentBaseUrlIndex];
        apiClient.defaults.baseURL = nextBase;
        await AsyncStorage.setItem('apiBaseUrl', nextBase);

        originalRequest.baseURL = nextBase;
        originalRequest.__retryCount = retryCount + 1;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
