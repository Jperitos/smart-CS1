const cron = require('node-cron');
const backupService = require('./backupService');

class BackupScheduler {
  constructor() {
    this.isRunning = false;
    this.jobs = new Map();
    this.scheduleConfig = {
      hourly: {
        enabled: true,
        cron: '0 * * * *', // Every hour
        retention: 24 // Keep for 24 hours
      },
      daily: {
        enabled: true,
        cron: '0 2 * * *', // 2 AM daily
        retention: 30 // Keep for 30 days
      },
      weekly: {
        enabled: true,
        cron: '0 3 * * 0', // 3 AM every Sunday
        retention: 12 // Keep for 12 weeks
      },
      monthly: {
        enabled: true,
        cron: '0 4 1 * *', // 4 AM on 1st of every month
        retention: 12 // Keep for 12 months
      }
    };
  }

  /**
   * Start the backup scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('[BACKUP SCHEDULER] Already running');
      return;
    }

    console.log('[BACKUP SCHEDULER] Starting backup scheduler...');
    this.isRunning = true;

    // Schedule all backup jobs
    this.scheduleBackupJobs();
    
    console.log('[BACKUP SCHEDULER] Backup scheduler started successfully');
  }

  /**
   * Stop the backup scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('[BACKUP SCHEDULER] Not running');
      return;
    }

    console.log('[BACKUP SCHEDULER] Stopping backup scheduler...');
    this.isRunning = false;

    // Stop all scheduled jobs
    for (const [jobName, job] of this.jobs) {
      job.destroy();
      console.log(`[BACKUP SCHEDULER] Stopped job: ${jobName}`);
    }
    
    this.jobs.clear();
    console.log('[BACKUP SCHEDULER] Backup scheduler stopped');
  }

  /**
   * Schedule all backup jobs based on configuration
   */
  scheduleBackupJobs() {
    for (const [jobName, config] of Object.entries(this.scheduleConfig)) {
      if (config.enabled) {
        this.scheduleJob(jobName, config);
      }
    }
  }

  /**
   * Schedule a specific backup job
   */
  scheduleJob(jobName, config) {
    try {
      const job = cron.schedule(config.cron, async () => {
        console.log(`[BACKUP SCHEDULER] Running scheduled ${jobName} backup...`);
        
        try {
          const result = await backupService.createFullBackup(jobName);
          
          if (result.success) {
            console.log(`[BACKUP SCHEDULER] ${jobName} backup completed successfully: ${result.backupId}`);
            
            // Clean up old backups for this type
            if (config.retention) {
              await this.cleanupOldBackups(jobName, config.retention);
            }
          } else {
            console.error(`[BACKUP SCHEDULER] ${jobName} backup failed:`, result.error);
          }
        } catch (error) {
          console.error(`[BACKUP SCHEDULER] Error in ${jobName} backup job:`, error);
        }
      }, {
        scheduled: false,
        timezone: 'UTC'
      });

      this.jobs.set(jobName, job);
      job.start();
      
      console.log(`[BACKUP SCHEDULER] Scheduled ${jobName} backup: ${config.cron}`);
    } catch (error) {
      console.error(`[BACKUP SCHEDULER] Error scheduling ${jobName} job:`, error);
    }
  }

  /**
   * Clean up old backups for a specific type
   */
  async cleanupOldBackups(jobName, retentionDays) {
    try {
      console.log(`[BACKUP SCHEDULER] Cleaning up old ${jobName} backups (retention: ${retentionDays} days)`);
      
      const backups = await backupService.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const oldBackups = backups.filter(backup => 
        backup.type === jobName && backup.created < cutoffDate
      );
      
      let deletedCount = 0;
      for (const backup of oldBackups) {
        try {
          const fs = require('fs').promises;
          await fs.unlink(backup.path);
          deletedCount++;
          console.log(`[BACKUP SCHEDULER] Deleted old backup: ${backup.id}`);
        } catch (error) {
          console.error(`[BACKUP SCHEDULER] Error deleting backup ${backup.id}:`, error);
        }
      }
      
      console.log(`[BACKUP SCHEDULER] Cleanup completed for ${jobName}: deleted ${deletedCount} old backups`);
    } catch (error) {
      console.error(`[BACKUP SCHEDULER] Error cleaning up ${jobName} backups:`, error);
    }
  }

  /**
   * Manually trigger a backup
   */
  async triggerBackup(type = 'manual') {
    try {
      console.log(`[BACKUP SCHEDULER] Manually triggering ${type} backup...`);
      const result = await backupService.createFullBackup(type);
      
      if (result.success) {
        console.log(`[BACKUP SCHEDULER] Manual backup completed: ${result.backupId}`);
      } else {
        console.error(`[BACKUP SCHEDULER] Manual backup failed:`, result.error);
      }
      
      return result;
    } catch (error) {
      console.error(`[BACKUP SCHEDULER] Error in manual backup:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update schedule configuration
   */
  updateSchedule(jobName, config) {
    try {
      if (this.jobs.has(jobName)) {
        // Stop existing job
        this.jobs.get(jobName).destroy();
        this.jobs.delete(jobName);
      }
      
      // Update configuration
      this.scheduleConfig[jobName] = { ...this.scheduleConfig[jobName], ...config };
      
      // Schedule new job if enabled
      if (this.scheduleConfig[jobName].enabled) {
        this.scheduleJob(jobName, this.scheduleConfig[jobName]);
      }
      
      console.log(`[BACKUP SCHEDULER] Updated schedule for ${jobName}`);
      return { success: true };
    } catch (error) {
      console.error(`[BACKUP SCHEDULER] Error updating schedule for ${jobName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current schedule status
   */
  getScheduleStatus() {
    const status = {
      isRunning: this.isRunning,
      jobs: {}
    };
    
    for (const [jobName, config] of Object.entries(this.scheduleConfig)) {
      status.jobs[jobName] = {
        enabled: config.enabled,
        cron: config.cron,
        retention: config.retention,
        scheduled: this.jobs.has(jobName)
      };
    }
    
    return status;
  }

  /**
   * Get next scheduled run times
   */
  getNextRuns() {
    const nextRuns = {};
    
    for (const [jobName, job] of this.jobs) {
      try {
        // This is a simplified approach - in production you might want to use a more sophisticated method
        nextRuns[jobName] = 'Next run calculated by cron';
      } catch (error) {
        nextRuns[jobName] = 'Unable to calculate';
      }
    }
    
    return nextRuns;
  }

  /**
   * Test backup functionality
   */
  async testBackup() {
    try {
      console.log('[BACKUP SCHEDULER] Running backup test...');
      
      const result = await backupService.createFullBackup('test');
      
      if (result.success) {
        console.log('[BACKUP SCHEDULER] Backup test successful');
        
        // Validate the backup
        const validation = await backupService.validateBackup(result.backupId);
        console.log('[BACKUP SCHEDULER] Backup validation:', validation);
        
        return {
          success: true,
          backupId: result.backupId,
          validation
        };
      } else {
        console.error('[BACKUP SCHEDULER] Backup test failed:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('[BACKUP SCHEDULER] Backup test error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const backupScheduler = new BackupScheduler();

module.exports = backupScheduler;
