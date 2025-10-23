const gpsBackupService = require('../services/gpsBackupService');

class GPSBackupController {
  // Get GPS backup service status
  static async getStatus(req, res) {
    try {
      const status = gpsBackupService.getStatus();
      res.json({
        success: true,
        status: status
      });
    } catch (error) {
      console.error('[GPS BACKUP API] Error getting status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get coordinates for display (live GPS or backup)
  static async getDisplayCoordinates(req, res) {
    try {
      const { binId } = req.params;
      const coordinates = await gpsBackupService.getDisplayCoordinates(binId);
      
      if (coordinates) {
        res.json({
          success: true,
          binId: binId,
          coordinates: coordinates
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'No coordinates found for this bin'
        });
      }
    } catch (error) {
      console.error('[GPS BACKUP API] Error getting display coordinates:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get backup coordinates for a specific bin
  static async getBackupCoordinates(req, res) {
    try {
      const { binId } = req.params;
      const backupCoordinates = await gpsBackupService.getBackupCoordinates(binId);
      
      if (backupCoordinates) {
        res.json({
          success: true,
          binId: binId,
          coordinates: backupCoordinates
        });
      } else {
        res.status(404).json({
          success: false,
          error: `No backup coordinates found for bin ${binId}`
        });
      }
    } catch (error) {
      console.error('[GPS BACKUP API] Error getting backup coordinates:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get display coordinates (backup if live GPS is invalid)
  static async getDisplayCoordinates(req, res) {
    try {
      const { binId } = req.params;
      const displayCoordinates = await gpsBackupService.getDisplayCoordinates(binId);
      
      if (displayCoordinates) {
        res.json({
          success: true,
          binId: binId,
          coordinates: displayCoordinates
        });
      } else {
        res.status(404).json({
          success: false,
          error: `No coordinates found for bin ${binId}`
        });
      }
    } catch (error) {
      console.error('[GPS BACKUP API] Error getting display coordinates:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Manually trigger backup for a specific bin
  static async triggerBackup(req, res) {
    try {
      const { binId } = req.params;
      const { latitude, longitude } = req.body;
      
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Latitude and longitude are required'
        });
      }
      
      if (!gpsBackupService.isValidCoordinates(latitude, longitude)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates provided'
        });
      }
      
      await gpsBackupService.backupValidCoordinates(binId, latitude, longitude);
      
      res.json({
        success: true,
        message: `Backup triggered for bin ${binId}`,
        coordinates: {
          latitude,
          longitude,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[GPS BACKUP API] Error triggering backup:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get all bins with their coordinate status
  static async getAllBinsStatus(req, res) {
    try {
      const { db } = require('../models/firebase');
      const snapshot = await db.collection('monitoring').get();
      
      const binsStatus = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const binId = doc.id;
        
        const hasValidLiveGPS = gpsBackupService.isValidCoordinates(data.latitude, data.longitude);
        const hasBackupCoordinates = gpsBackupService.isValidCoordinates(data.backup_latitude, data.backup_longitude);
        
        binsStatus.push({
          binId: binId,
          liveGPS: {
            latitude: data.latitude || 0,
            longitude: data.longitude || 0,
            valid: hasValidLiveGPS,
            timestamp: data.timestamp
          },
          backupGPS: {
            latitude: data.backup_latitude || 0,
            longitude: data.backup_longitude || 0,
            valid: hasBackupCoordinates,
            timestamp: data.backup_timestamp
          },
          displaySource: hasValidLiveGPS ? 'live' : (hasBackupCoordinates ? 'backup' : 'none')
        });
      });
      
      res.json({
        success: true,
        bins: binsStatus
      });
    } catch (error) {
      console.error('[GPS BACKUP API] Error getting all bins status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Force backup of current valid coordinates
  static async forceBackup(req, res) {
    try {
      await gpsBackupService.performHourlyBackup();
      
      res.json({
        success: true,
        message: 'Force backup completed',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[GPS BACKUP API] Error during force backup:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get dynamic bin status
  static async getDynamicBinStatus(req, res) {
    try {
      const { binId } = req.params;
      const status = await gpsBackupService.getDynamicBinStatus(binId);
      
      if (status) {
        res.json({
          success: true,
          binId: binId,
          status: status
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Bin not found'
        });
      }
    } catch (error) {
      console.error('[GPS BACKUP API] Error getting dynamic bin status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get all bins with dynamic status
  static async getAllBinsDynamicStatus(req, res) {
    try {
      const binsStatus = await gpsBackupService.getAllBinsDynamicStatus();
      
      res.json({
        success: true,
        bins: binsStatus
      });
    } catch (error) {
      console.error('[GPS BACKUP API] Error getting all bins dynamic status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Mobile app specific endpoints
  static async saveGPSBackup(req, res) {
    try {
      const { binId, latitude, longitude, timestamp, source } = req.body;
      
      if (!binId || !latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: binId, latitude, longitude'
        });
      }

      const backupData = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: timestamp || Date.now(),
        binId: binId,
        source: source || 'gps_live'
      };

      const result = await gpsBackupService.saveBackupCoordinates(binId, backupData);
      
      if (result) {
        res.json({
          success: true,
          message: 'GPS backup saved successfully',
          data: backupData
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to save GPS backup'
        });
      }
    } catch (error) {
      console.error('[GPS BACKUP API] Error saving GPS backup:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async getGPSBackup(req, res) {
    try {
      const { binId } = req.params;
      const backupData = await gpsBackupService.getBackupCoordinates(binId);
      
      if (backupData) {
        res.json({
          success: true,
          data: backupData
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'No GPS backup found for this bin'
        });
      }
    } catch (error) {
      console.error('[GPS BACKUP API] Error getting GPS backup:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async getAllGPSBackups(req, res) {
    try {
      const allBackups = await gpsBackupService.getAllBackupCoordinates();
      
      res.json({
        success: true,
        data: allBackups
      });
    } catch (error) {
      console.error('[GPS BACKUP API] Error getting all GPS backups:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = GPSBackupController;
