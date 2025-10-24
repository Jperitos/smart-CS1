const { rtdb } = require('../models/firebase');
const notificationController = require('../controllers/notificationController');

class BinHealthMonitor {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.lastCheckTime = null;
    this.notificationTimes = [9, 14, 19]; // 9 AM, 2 PM, 7 PM
    this.checkedToday = new Set(); // Track which times we've already checked today
  }

  /**
   * Start the bin health monitoring system
   */
  start() {
    if (this.isRunning) {
      console.log('[BIN HEALTH MONITOR] Already running');
      return;
    }

    console.log('[BIN HEALTH MONITOR] Starting bin health monitoring system...');
    this.isRunning = true;

    // Check every hour
    this.intervalId = setInterval(() => {
      this.checkBinHealth();
    }, 60 * 60 * 1000); // 1 hour

    // Initial check
    this.checkBinHealth();
  }

  /**
   * Stop the bin health monitoring system
   */
  stop() {
    if (!this.isRunning) {
      console.log('[BIN HEALTH MONITOR] Not running');
      return;
    }

    console.log('[BIN HEALTH MONITOR] Stopping bin health monitoring system...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check if it's time to run health checks based on schedule
   */
  shouldRunHealthCheck() {
    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toDateString();

    // Reset daily tracking
    if (this.lastCheckTime && this.lastCheckTime.toDateString() !== today) {
      this.checkedToday.clear();
    }

    // Check if current hour matches any of our notification times
    const shouldCheck = this.notificationTimes.includes(currentHour);
    const alreadyChecked = this.checkedToday.has(currentHour);

    return shouldCheck && !alreadyChecked;
  }

  /**
   * Main bin health check function
   */
  async checkBinHealth() {
    try {
      if (!this.shouldRunHealthCheck()) {
        return;
      }

      console.log('[BIN HEALTH MONITOR] Running scheduled bin health check...');
      this.lastCheckTime = new Date();
      this.checkedToday.add(new Date().getHours());

      // Get all bin data from realtime database
      const binData = await this.getBinData();
      
      if (!binData || Object.keys(binData).length === 0) {
        console.log('[BIN HEALTH MONITOR] No bin data found');
        return;
      }

      // Check each bin for health issues
      const healthIssues = [];
      
      for (const [binId, data] of Object.entries(binData)) {
        const issues = this.analyzeBinHealth(binId, data);
        if (issues.length > 0) {
          healthIssues.push(...issues);
        }
      }

      // Send notifications if there are health issues
      if (healthIssues.length > 0) {
        await this.sendHealthNotifications(healthIssues);
      } else {
        console.log('[BIN HEALTH MONITOR] All bins are healthy');
      }

    } catch (error) {
      console.error('[BIN HEALTH MONITOR] Error during health check:', error);
    }
  }

  /**
   * Get bin data from Firebase Realtime Database
   */
  async getBinData() {
    try {
      const bin1Ref = rtdb.ref('monitoring/bin1');
      const dataRef = rtdb.ref('monitoring/data');
      
      const [bin1Snapshot, dataSnapshot] = await Promise.all([
        bin1Ref.once('value'),
        dataRef.once('value')
      ]);

      const binData = {};
      
      if (bin1Snapshot.exists()) {
        binData['bin1'] = bin1Snapshot.val();
      }
      
      if (dataSnapshot.exists()) {
        binData['data'] = dataSnapshot.val();
      }

      return binData;
    } catch (error) {
      console.error('[BIN HEALTH MONITOR] Error getting bin data:', error);
      return {};
    }
  }

  /**
   * Analyze bin health and return issues
   */
  analyzeBinHealth(binId, data) {
    const issues = [];
    const now = new Date();
    const dataTimestamp = data.timestamp ? new Date(data.timestamp) : null;
    
    // Check GPS validity
    if (!data.gps_valid || data.gps_valid === false) {
      issues.push({
        binId,
        type: 'gps_malfunction',
        severity: 'high',
        message: `Bin ${binId} has invalid GPS coordinates`,
        details: {
          gps_valid: data.gps_valid,
          latitude: data.latitude,
          longitude: data.longitude,
          satellites: data.satellites
        }
      });
    }

    // Check if GPS coordinates are 0,0 (invalid)
    if (data.latitude === 0 && data.longitude === 0) {
      issues.push({
        binId,
        type: 'gps_zero_coordinates',
        severity: 'high',
        message: `Bin ${binId} has zero GPS coordinates (0,0)`,
        details: {
          latitude: data.latitude,
          longitude: data.longitude,
          gps_valid: data.gps_valid
        }
      });
    }

    // Check for stale data (no updates in last 2 hours)
    if (dataTimestamp) {
      const timeDiff = now - dataTimestamp;
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff > 2) {
        issues.push({
          binId,
          type: 'stale_data',
          severity: 'medium',
          message: `Bin ${binId} has not updated in ${hoursDiff.toFixed(1)} hours`,
          details: {
            lastUpdate: dataTimestamp.toISOString(),
            hoursSinceUpdate: hoursDiff.toFixed(1)
          }
        });
      }
    }

    // Check for sensor malfunction (all readings are 0)
    if (data.weight_kg === 0 && data.distance_cm === 0 && data.bin_level === 0) {
      issues.push({
        binId,
        type: 'sensor_malfunction',
        severity: 'high',
        message: `Bin ${binId} sensors appear to be malfunctioning (all readings are 0)`,
        details: {
          weight_kg: data.weight_kg,
          distance_cm: data.distance_cm,
          bin_level: data.bin_level
        }
      });
    }

    // Check for unrealistic readings
    if (data.bin_level > 100 || data.bin_level < 0) {
      issues.push({
        binId,
        type: 'invalid_reading',
        severity: 'medium',
        message: `Bin ${binId} has invalid bin level reading: ${data.bin_level}%`,
        details: {
          bin_level: data.bin_level,
          weight_kg: data.weight_kg,
          distance_cm: data.distance_cm
        }
      });
    }

    return issues;
  }

  /**
   * Send health notifications to staff
   */
  async sendHealthNotifications(issues) {
    try {
      console.log(`[BIN HEALTH MONITOR] Sending ${issues.length} health issue notifications...`);

      // Get all staff users
      const { db: firestoreDb } = require('../models/firebase');
      const staffSnapshot = await firestoreDb.collection("users")
        .where("role", "in", ["staff", "supervisor"])
        .get();

      if (staffSnapshot.empty) {
        console.log('[BIN HEALTH MONITOR] No staff users found to notify');
        return;
      }

      // Group issues by severity
      const highSeverityIssues = issues.filter(issue => issue.severity === 'high');
      const mediumSeverityIssues = issues.filter(issue => issue.severity === 'medium');

      // Create notification for each staff member
      const notificationPromises = [];
      
      staffSnapshot.forEach((doc) => {
        const staff = doc.data();
        
        // Create notification based on severity
        let notificationData;
        
        if (highSeverityIssues.length > 0) {
          notificationData = {
            type: 'bin_maintenance_urgent',
            title: 'Urgent: Bin Maintenance Required',
            message: `${highSeverityIssues.length} bin require immediate attention. Issues: ${highSeverityIssues.map(i => i.message).join(', ')}`,
            severity: 'high',
            issues: highSeverityIssues,
            timestamp: Date.now(),
            read: false,
            createdAt: new Date().toISOString()
          };
        } else if (mediumSeverityIssues.length > 0) {
          notificationData = {
            type: 'bin_maintenance',
            title: 'Bin Maintenance Alert',
            message: `${mediumSeverityIssues.length} bin need attention. Issues: ${mediumSeverityIssues.map(i => i.message).join(', ')}`,
            severity: 'medium',
            issues: mediumSeverityIssues,
            timestamp: Date.now(),
            read: false,
            createdAt: new Date().toISOString()
          };
        }

        if (notificationData) {
          notificationPromises.push(
            this.createRealtimeNotification(doc.id, notificationData).catch(err => 
              console.error(`[BIN HEALTH MONITOR] Failed to create notification for ${staff.email}:`, err)
            )
          );
        }
      });

      await Promise.all(notificationPromises);
      console.log(`[BIN HEALTH MONITOR] Successfully sent health notifications to ${staffSnapshot.size} staff members`);

    } catch (error) {
      console.error('[BIN HEALTH MONITOR] Error sending health notifications:', error);
    }
  }

  /**
   * Helper function to create notifications in Realtime Database
   */
  async createRealtimeNotification(userId, notificationData) {
    try {
      await db.ref(`notifications/${userId}`).push(notificationData);
      console.log(`[BIN HEALTH MONITOR] Created notification for user ${userId}: ${notificationData.title}`);
      return true;
    } catch (error) {
      console.error('[BIN HEALTH MONITOR] Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheckTime: this.lastCheckTime,
      notificationTimes: this.notificationTimes,
      checkedToday: Array.from(this.checkedToday)
    };
  }

  /**
   * Manually trigger a health check
   */
  async manualHealthCheck() {
    console.log('[BIN HEALTH MONITOR] Manual health check triggered');
    await this.checkBinHealth();
  }
}

// Create singleton instance
const binHealthMonitor = new BinHealthMonitor();

module.exports = binHealthMonitor;

