import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/utils/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseBackupService, GPSBackupData } from '@/utils/firebaseConfig';

export interface BinData {
  weight_kg: number;
  weight_percent: number;
  distance_cm: number;
  height_percent: number;
  bin_level: number;
  latitude: number;
  longitude: number;
  gps_valid: boolean;
  satellites: number;
  timestamp: number;
  bin_id?: string;
  type?: string;
  name?: string;
  mainLocation?: string;
  last_active?: number;
  gps_timestamp?: number;
  // Backup coordinates from Firebase
  backup_latitude?: number;
  backup_longitude?: number;
  backup_timestamp?: string;
  backup_source?: string;
}

export interface WasteBin {
  id: string;
  location: string;
  level: number;
  status: 'normal' | 'warning' | 'critical';
  lastCollected: string;
  capacity: string;
  wasteType: string;
  nextCollection: string;
  binData?: BinData;
}

export interface LocationData {
  name: string;
  overallLevel: number;
  status: 'normal' | 'warning' | 'critical';
  lastCollected: string;
  nearlyFullCount: number;
  totalBins: number;
  bins: WasteBin[];
}

export function useRealTimeData() {
  const [binData, setBinData] = useState<BinData | null>(null);
  const [bin2Data, setBin2Data] = useState<BinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  
  // Last known GPS locations for backup (from Firebase)
  const [lastKnownGPS, setLastKnownGPS] = useState<{
    bin1: GPSBackupData | null;
    bin2: GPSBackupData | null;
  }>({
    bin1: null,
    bin2: null
  });

  // Helper function to get time ago
  const getTimeAgo = useCallback((timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }, []);

  // Helper function to get status from level
  const getStatusFromLevel = useCallback((level: number): 'normal' | 'warning' | 'critical' => {
    if (level >= 85) return 'critical';
    if (level >= 70) return 'warning';
    if (level > 0) return 'normal';
    return 'normal';
  }, []);

  // Helper function to get next collection time
  const getNextCollectionTime = useCallback((level: number): string => {
    if (level >= 85) return 'Immediate';
    if (level >= 70) return 'Today 3:00 PM';
    return 'Tomorrow 9:00 AM';
  }, []);

  // Helper function to check if GPS coordinates are valid and in correct region
  const isGPSValid = useCallback((data: BinData): boolean => {
    return firebaseBackupService.isGPSValid(data);
  }, []);

  // Helper function to update last known GPS location
  const updateLastKnownGPS = useCallback(async (binId: 'bin1' | 'bin2', data: BinData) => {
    if (isGPSValid(data)) {
      const backupData = firebaseBackupService.createBackupData(binId, data);
      
      // Save to Firebase
      const success = await firebaseBackupService.saveLastKnownGPS(binId, backupData);
      
      if (success) {
        setLastKnownGPS(prev => ({
          ...prev,
          [binId]: backupData
        }));
        
        // Also save to AsyncStorage as local backup
        await AsyncStorage.setItem(`lastKnownGPS_${binId}`, JSON.stringify(backupData));
      }
    }
  }, [isGPSValid]);

  // Helper function to get backup coordinates for a bin
  const getBackupCoordinates = useCallback((binId: 'bin1' | 'bin2', data: BinData) => {
    // First try API backup coordinates
    if (data.backup_latitude && data.backup_longitude) {
      return {
        latitude: data.backup_latitude,
        longitude: data.backup_longitude,
        source: 'API Backup'
      };
    }
    
    // Then try last known GPS location from Firebase
    const lastKnown = lastKnownGPS[binId];
    if (lastKnown) {
      return {
        latitude: lastKnown.latitude,
        longitude: lastKnown.longitude,
        source: 'Firebase Backup'
      };
    }
    
    // Finally fall back to hardcoded defaults
    const defaults = {
      bin1: { latitude: 10.24371, longitude: 123.786917 },
      bin2: { latitude: 10.25000, longitude: 123.79000 }
    };
    
    return {
      latitude: defaults[binId].latitude,
      longitude: defaults[binId].longitude,
      source: 'Default Location'
    };
  }, [lastKnownGPS]);

  // Load last known GPS locations on startup
  useEffect(() => {
    const loadLastKnownGPS = async () => {
      // Add a small delay to prevent immediate network calls on app startup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        // First try to load from AsyncStorage (faster and more reliable)
        const [bin1GPS, bin2GPS] = await Promise.all([
          AsyncStorage.getItem('lastKnownGPS_bin1'),
          AsyncStorage.getItem('lastKnownGPS_bin2')
        ]);
        
        if (bin1GPS || bin2GPS) {
          setLastKnownGPS({
            bin1: bin1GPS ? JSON.parse(bin1GPS) : null,
            bin2: bin2GPS ? JSON.parse(bin2GPS) : null
          });
        } else {
          // Only try Firebase if no local data is available
          const firebaseBackups = await firebaseBackupService.getAllBackupGPS();
          
          if (firebaseBackups.bin1 || firebaseBackups.bin2) {
            setLastKnownGPS({
              bin1: firebaseBackups.bin1 || null,
              bin2: firebaseBackups.bin2 || null
            });
          }
        }
      } catch (error) {
        // Silent error handling - no console errors
        // App will work with default coordinates
      }
    };
    
    loadLastKnownGPS();
  }, []);

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Try to get cached data first
        const cachedBin1Data = await AsyncStorage.getItem('binData');
        const cachedBin2Data = await AsyncStorage.getItem('bin2Data');
        
        if (cachedBin1Data) {
          const parsedData = JSON.parse(cachedBin1Data);
          setBinData(parsedData);
        }
        
        if (cachedBin2Data) {
          const parsedData = JSON.parse(cachedBin2Data);
          setBin2Data(parsedData);
        }

        // Fetch fresh data from API for both bins
        const [bin1Response, bin2Response] = await Promise.allSettled([
          apiClient.get('/api/bin1'),
          apiClient.get('/api/bin2')
        ]);
        
        if (bin1Response.status === 'fulfilled' && bin1Response.value.data) {
          const data = bin1Response.value.data;
          setBinData(data);
          await AsyncStorage.setItem('binData', JSON.stringify(data));
          // Update last known GPS if current data has valid GPS
          await updateLastKnownGPS('bin1', data);
        }
        
        if (bin2Response.status === 'fulfilled' && bin2Response.value.data) {
          const data = bin2Response.value.data;
          setBin2Data(data);
          await AsyncStorage.setItem('bin2Data', JSON.stringify(data));
          // Update last known GPS if current data has valid GPS
          await updateLastKnownGPS('bin2', data);
        }
        
          setLastUpdate(Date.now());
          setError(null);
      } catch (err: any) {
        // Silently handle network errors to prevent LogBox display
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [updateLastKnownGPS]);

  // Set up real-time updates using polling
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Fetch data for both bins
        const [bin1Response, bin2Response] = await Promise.allSettled([
          apiClient.get('/api/bin1'),
          apiClient.get('/api/bin2')
        ]);
        
        if (bin1Response.status === 'fulfilled' && bin1Response.value.data) {
          const data = bin1Response.value.data;
          setBinData(data);
          await AsyncStorage.setItem('binData', JSON.stringify(data));
          // Update last known GPS if current data has valid GPS
          await updateLastKnownGPS('bin1', data);
        }
        
        if (bin2Response.status === 'fulfilled' && bin2Response.value.data) {
          const data = bin2Response.value.data;
          setBin2Data(data);
          await AsyncStorage.setItem('bin2Data', JSON.stringify(data));
          // Update last known GPS if current data has valid GPS
          await updateLastKnownGPS('bin2', data);
        }
        
          setLastUpdate(Date.now());
          setError(null);
      } catch (err: any) {
        // Silently handle network errors to prevent LogBox display
        setError(err.message || 'Failed to fetch real-time data');
      }
    }, 3000); // Poll every 3 seconds for mobile optimization

    return () => clearInterval(interval);
  }, [updateLastKnownGPS]);

  // Convert Firebase data to waste bin format
  const getWasteBins = useCallback((): WasteBin[] => {
    const bins: WasteBin[] = [];
    
    // Add bin1 data
    if (binData) {
      const calculatedLevel = (binData.bin_level && binData.bin_level > 0) ? binData.bin_level : (binData.weight_percent || 0);
      
      bins.push({
        id: 'bin1',
        location: binData.name || 'Central Plaza',
        level: calculatedLevel,
        status: getStatusFromLevel(calculatedLevel),
        lastCollected: getTimeAgo(binData.timestamp),
        capacity: '500L',
        wasteType: binData.type || 'Mixed',
        nextCollection: getNextCollectionTime(calculatedLevel),
        binData: binData
      });
    }
    
    // Add bin2 data
    if (bin2Data) {
      const calculatedLevel = (bin2Data.bin_level && bin2Data.bin_level > 0) ? bin2Data.bin_level : (bin2Data.weight_percent || 0);
      
      bins.push({
        id: 'bin2',
        location: bin2Data.name || 'Secondary Location',
        level: calculatedLevel,
        status: getStatusFromLevel(calculatedLevel),
        lastCollected: getTimeAgo(bin2Data.timestamp),
        capacity: '500L',
        wasteType: bin2Data.type || 'Mixed',
        nextCollection: getNextCollectionTime(calculatedLevel),
        binData: bin2Data
      });
    }
    
    return bins;
  }, [binData, bin2Data, getStatusFromLevel, getTimeAgo, getNextCollectionTime]);

  // Get real-time location data for mobile
  const getRealTimeLocationData = useCallback((): LocationData => {
    const bins = getWasteBins();
    
    if (bins.length > 0) {
      // Calculate overall level and status for all bins
      const totalLevel = bins.reduce((sum, bin) => sum + bin.level, 0);
      const overallLevel = totalLevel / bins.length;
      const status = getStatusFromLevel(overallLevel);
      const nearlyFullCount = bins.filter(bin => bin.level >= 70).length;
      
      return {
        name: bins.length > 1 ? 'Multiple Locations' : bins[0].location,
        overallLevel: overallLevel,
        status: status,
        lastCollected: bins[0].lastCollected,
        nearlyFullCount: nearlyFullCount,
        totalBins: bins.length,
        bins: bins
      };
    }
    
    // Fallback data if no real-time data available
    return {
      name: 'Central Plaza',
      overallLevel: 50,
      status: 'normal',
      lastCollected: 'Unknown',
      nearlyFullCount: 0,
      totalBins: 0,
      bins: []
    };
  }, [getWasteBins, getStatusFromLevel]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [bin1Response, bin2Response] = await Promise.allSettled([
        apiClient.get('/api/bin1'),
        apiClient.get('/api/bin2')
      ]);
      
      if (bin1Response.status === 'fulfilled' && bin1Response.value.data) {
        const data = bin1Response.value.data;
        setBinData(data);
        await AsyncStorage.setItem('binData', JSON.stringify(data));
        // Update last known GPS if current data has valid GPS
        await updateLastKnownGPS('bin1', data);
      }
      
      if (bin2Response.status === 'fulfilled' && bin2Response.value.data) {
        const data = bin2Response.value.data;
        setBin2Data(data);
        await AsyncStorage.setItem('bin2Data', JSON.stringify(data));
        // Update last known GPS if current data has valid GPS
        await updateLastKnownGPS('bin2', data);
      }
      
        setLastUpdate(Date.now());
      setError(null);
    } catch (err: any) {
      // Silently handle network errors to prevent LogBox display
      setError(err.message || 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, [updateLastKnownGPS]);

  return {
    binData,
    bin2Data,
    wasteBins: getWasteBins(),
    realTimeLocationData: getRealTimeLocationData(),
    loading,
    error,
    lastUpdate,
    refresh,
    isGPSValid: () => {
      return binData?.gps_valid && binData?.latitude && binData?.longitude;
    },
    getCurrentGPSLocation: () => {
      return binData?.gps_valid ? binData : null;
    },
    // New helper functions for GPS backup
    isGPSValidForBin: isGPSValid,
    getBackupCoordinates,
    lastKnownGPS
  };
}

// Helper function to get status from level (exported for use in components)
export function getStatusFromLevel(level: number): 'normal' | 'warning' | 'critical' {
  if (level >= 85) return 'critical';
  if (level >= 70) return 'warning';
  if (level > 0) return 'normal';
  return 'normal';
}

// Helper function to get fill color based on level
export function getFillColor(level: number): string {
  if (level <= 50) return '#4caf50';
  if (level <= 80) return '#ff9800';
  return '#f44336';
}

// Helper function to get status color
export function getStatusColor(status: string): string {
  switch (status) {
    case 'normal': return '#4caf50';
    case 'warning': return '#ff9800';
    case 'critical': return '#f44336';
    default: return '#4caf50';
  }
}
