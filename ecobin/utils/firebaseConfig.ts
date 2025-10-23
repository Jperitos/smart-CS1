// Firebase configuration for GPS backup system
// This file handles saving and retrieving last known GPS locations

import apiClient from './apiConfig';

export interface GPSBackupData {
  latitude: number;
  longitude: number;
  timestamp: number;
  binId: string;
  source: 'gps_live' | 'manual';
}

export interface FirebaseBackupResponse {
  bin1?: GPSBackupData;
  bin2?: GPSBackupData;
}

class FirebaseBackupService {
  private baseUrl: string;
  private serverApiUrl: string;
  private useServerAPI: boolean = true; // Default to server API for better reliability
  
  constructor() {
    // Dynamic configuration based on environment
    this.baseUrl = 'https://smartbins-c724c-default-rtdb.firebaseio.com/';
    // Get server API URL from apiConfig dynamically
    this.serverApiUrl = `${apiClient.defaults.baseURL}/api`;
    this.useServerAPI = true; // Use server API by default for better reliability
  }

  // Helper method for fetch with timeout (React Native compatible)
  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeoutMs);

      fetch(url, options)
        .then(response => {
          clearTimeout(timeoutId);
          resolve(response);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  
  // Save last known GPS location for a bin
  async saveLastKnownGPS(binId: 'bin1' | 'bin2', data: GPSBackupData): Promise<boolean> {
    // Update server API URL from apiConfig before making request
    this.updateServerAPIUrl();
    
    // Try server API first, then fallback to Firebase
    if (this.useServerAPI) {
      try {
        return await this.saveViaServerAPI(binId, data);
      } catch (error) {
        // Silent fallback - no console warnings
        this.useServerAPI = false; // Switch to Firebase for next attempt
      }
    }
    
    // Fallback to direct Firebase
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/monitoring/backup/${binId}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }, 10000);
      
      if (!response.ok) {
        throw new Error(`Failed to save GPS backup: ${response.status}`);
      }
      
      return true;
    } catch (error) {
      // Silent error handling - no console errors
      return false;
    }
  }

  // Save via server API
  private async saveViaServerAPI(binId: 'bin1' | 'bin2', data: GPSBackupData): Promise<boolean> {
    const response = await this.fetchWithTimeout(`${this.serverApiUrl}/gps-backup/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        binId
      }),
    }, 10000);
    
    if (!response.ok) {
      throw new Error(`Server API failed: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.success) {
      return true;
    } else {
      throw new Error(result.message || 'Server API failed');
    }
  }
  
  // Get last known GPS location for a bin
  async getLastKnownGPS(binId: 'bin1' | 'bin2'): Promise<GPSBackupData | null> {
    // Update server API URL from apiConfig before making request
    this.updateServerAPIUrl();
    
    // Try server API first, then fallback to Firebase
    if (this.useServerAPI) {
      try {
        return await this.getViaServerAPI(binId);
      } catch (error) {
        // Silent fallback - no console warnings
        this.useServerAPI = false; // Switch to Firebase for next attempt
      }
    }
    
    // Fallback to direct Firebase
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/monitoring/backup/${binId}.json`, {}, 10000);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch GPS backup: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.latitude && data.longitude) {
        return data;
      }
      
      return null;
    } catch (error) {
      // Silent error handling - no console errors
      return null;
    }
  }

  // Get via server API
  private async getViaServerAPI(binId: 'bin1' | 'bin2'): Promise<GPSBackupData | null> {
    const response = await this.fetchWithTimeout(`${this.serverApiUrl}/gps-backup/${binId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }, 10000);
    
    if (!response.ok) {
      throw new Error(`Server API failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data && result.data.latitude && result.data.longitude) {
      return result.data;
    }
    
    return null;
  }
  
  // Get all backup GPS locations
  async getAllBackupGPS(): Promise<FirebaseBackupResponse> {
    // Update server API URL from apiConfig before making request
    this.updateServerAPIUrl();
    
    // Try server API first, then fallback to Firebase
    if (this.useServerAPI) {
      try {
        return await this.getAllViaServerAPI();
      } catch (error) {
        // Silent fallback - no console warnings
        this.useServerAPI = false; // Switch to Firebase for next attempt
      }
    }
    
    // Fallback to direct Firebase
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/monitoring/backup.json`, {}, 10000);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch all GPS backups: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data) {
        return data;
      }
      
      return {};
    } catch (error) {
      // Silent error handling - no console errors
      return {};
    }
  }

  // Get all via server API
  private async getAllViaServerAPI(): Promise<FirebaseBackupResponse> {
    const response = await this.fetchWithTimeout(`${this.serverApiUrl}/gps-backup/all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }, 10000);
    
    if (!response.ok) {
      throw new Error(`Server API failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data) {
      return result.data;
    }
    
    return {};
  }
  
  // Check if GPS data is valid and in correct region
  isGPSValid(data: { latitude: number; longitude: number; gps_valid?: boolean }): boolean {
    const isInCorrectRegion = data.latitude >= 10.0 && data.latitude <= 10.5 && 
                              data.longitude >= 123.5 && data.longitude <= 124.0;
    return data.gps_valid !== false && data.latitude !== 0 && data.longitude !== 0 && isInCorrectRegion;
  }
  
  // Create backup data from bin data
  createBackupData(binId: 'bin1' | 'bin2', binData: any): GPSBackupData {
    return {
      latitude: binData.latitude,
      longitude: binData.longitude,
      timestamp: binData.timestamp || Date.now(),
      binId: binId,
      source: 'gps_live'
    };
  }

  // Dynamic configuration methods
  setUseServerAPI(useServer: boolean) {
    this.useServerAPI = useServer;
    console.log(`🔄 Switched to ${useServer ? 'Server API' : 'Firebase Direct'} mode`);
  }

  setServerAPIUrl(url: string) {
    this.serverApiUrl = url;
    console.log(`🔄 Updated server API URL to: ${url}`);
  }

  setFirebaseUrl(url: string) {
    this.baseUrl = url;
    console.log(`🔄 Updated Firebase URL to: ${url}`);
  }

  // Update server API URL from apiConfig (call this when apiConfig changes)
  updateServerAPIUrl() {
    this.serverApiUrl = `${apiClient.defaults.baseURL}/api`;
    console.log(`🔄 Updated server API URL from apiConfig: ${this.serverApiUrl}`);
  }

  // Get current configuration
  getConfiguration() {
    return {
      useServerAPI: this.useServerAPI,
      serverApiUrl: this.serverApiUrl,
      firebaseUrl: this.baseUrl
    };
  }

  // Test connectivity
  async testConnectivity(): Promise<{ server: boolean; firebase: boolean }> {
    const results = { server: false, firebase: false };

    // Test server API
    try {
      const response = await this.fetchWithTimeout(`${this.serverApiUrl}/gps-backup/all`, {
        method: 'GET',
      }, 5000);
      results.server = response.ok;
    } catch (error) {
      // Silent test failure
    }

    // Test Firebase direct
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/monitoring/backup.json`, {}, 5000);
      results.firebase = response.ok;
    } catch (error) {
      // Silent test failure
    }

    return results;
  }

  // Get GPS backup status message for user display
  async getGPSBackupStatusMessage(): Promise<string> {
    try {
      const connectivity = await this.testConnectivity();
      
      if (connectivity.server) {
        return "GPS backup service is connected and ready";
      } else if (connectivity.firebase) {
        return "GPS backup service is connected (backup mode)";
      } else {
        return "GPS backup service is temporarily unavailable";
      }
    } catch (error) {
      return "GPS backup service is temporarily unavailable";
    }
  }

  // Check if GPS backup is available
  async isGPSBackupAvailable(): Promise<boolean> {
    try {
      const connectivity = await this.testConnectivity();
      return connectivity.server || connectivity.firebase;
    } catch (error) {
      return false;
    }
  }
}

export const firebaseBackupService = new FirebaseBackupService();
export default firebaseBackupService;

// Utility function to sync with apiConfig changes
export const syncWithApiConfig = () => {
  firebaseBackupService.updateServerAPIUrl();
  console.log('🔄 Firebase backup service synced with apiConfig');
};

// Helper function for displaying GPS backup status in UI components
export const getGPSBackupStatus = async (): Promise<{
  isAvailable: boolean;
  message: string;
  status: 'connected' | 'backup' | 'unavailable';
}> => {
  try {
    // Update server API URL from apiConfig before testing
    firebaseBackupService.updateServerAPIUrl();
    
    const isAvailable = await firebaseBackupService.isGPSBackupAvailable();
    const message = await firebaseBackupService.getGPSBackupStatusMessage();
    
    let status: 'connected' | 'backup' | 'unavailable' = 'unavailable';
    if (isAvailable) {
      const connectivity = await firebaseBackupService.testConnectivity();
      status = connectivity.server ? 'connected' : 'backup';
    }
    
    return {
      isAvailable,
      message,
      status
    };
  } catch (error) {
    return {
      isAvailable: false,
      message: "GPS backup service is temporarily unavailable",
      status: 'unavailable'
    };
  }
};
