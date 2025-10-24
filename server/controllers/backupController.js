const backupService = require('../services/backupService');
const backupScheduler = require('../services/backupScheduler');

class BackupController {
  /**
   * Create a manual backup
   */
  async createBackup(req, res) {
    try {
      const { type = 'manual' } = req.body;
      
      console.log(`[BACKUP CONTROLLER] Creating ${type} backup...`);
      const result = await backupService.createFullBackup(type);
      
      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Backup created successfully',
          data: {
            backupId: result.backupId,
            type: result.type,
            size: result.size,
            timestamp: result.timestamp
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Backup creation failed',
          error: result.error
        });
      }
    } catch (error) {
      console.error('[BACKUP CONTROLLER] Error creating backup:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * List all available backups
   */
  async listBackups(req, res) {
    try {
      const { type, limit = 50, offset = 0 } = req.query;
      
      let backups = await backupService.listBackups();
      
      // Filter by type if specified
      if (type) {
        backups = backups.filter(backup => backup.type === type);
      }
      
      // Apply pagination
      const total = backups.length;
      const paginatedBackups = backups.slice(offset, offset + parseInt(limit));
      
      res.status(200).json({
        success: true,
        data: {
          backups: paginatedBackups,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: offset + parseInt(limit) < total
          }
        }
      });
    } catch (error) {
      console.error('[BACKUP CONTROLLER] Error listing backups:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get backup details
   */
  async getBackupDetails(req, res) {
    try {
      const { backupId } = req.params;
      
      const validation = await backupService.validateBackup(backupId);
      
      if (!validation.valid) {
        return res.status(404).json({
          success: false,
          message: 'Backup not found or invalid',
          error: validation.error
        });
      }
      
      res.status(200).json({
        success: true,
        data: {
          backupId,
          ...validation
        }
      });
    } catch (error) {
      console.error('[BACKUP CONTROLLER] Error getting backup details:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(req, res) {
    try {
      const { backupId } = req.params;
      const { 
        restoreFirestore = true, 
        restoreRealtime = true, 
        dryRun = false 
      } = req.body;
      
      // Validate backup first
      const validation = await backupService.validateBackup(backupId);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid backup',
          error: validation.error
        });
      }
      
      console.log(`[BACKUP CONTROLLER] Restoring from backup: ${backupId}`);
      
      const result = await backupService.restoreFromBackup(backupId, {
        restoreFirestore,
        restoreRealtime,
        dryRun
      });
      
      if (result.success) {
        res.status(200).json({
          success: true,
          message: dryRun ? 'Dry run completed successfully' : 'Data restored successfully',
          data: {
            backupId: result.backupId,
            restored: result.restored
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Restore failed',
          error: result.error
        });
      }
    } catch (error) {
      console.error('[BACKUP CONTROLLER] Error restoring backup:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(req, res) {
    try {
      const { backupId } = req.params;
      
      // Find backup file
      const backupPath = await backupService.findBackupFile(backupId);
      if (!backupPath) {
        return res.status(404).json({
          success: false,
          message: 'Backup not found'
        });
      }
      
      // Delete file
      const fs = require('fs').promises;
      await fs.unlink(backupPath);
      
      console.log(`[BACKUP CONTROLLER] Deleted backup: ${backupId}`);
      
      res.status(200).json({
        success: true,
        message: 'Backup deleted successfully',
        data: { backupId }
      });
    } catch (error) {
      console.error('[BACKUP CONTROLLER] Error deleting backup:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(req, res) {
    try {
      const stats = await backupService.getBackupStats();
      
      if (!stats) {
        return res.status(500).json({
          success: false,
          message: 'Unable to retrieve backup statistics'
        });
      }
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('[BACKUP CONTROLLER] Error getting backup stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupBackups(req, res) {
    try {
      const { retentionDays = 30 } = req.body;
      
      console.log(`[BACKUP CONTROLLER] Cleaning up backups older than ${retentionDays} days`);
      
      const result = await backupService.cleanupOldBackups(retentionDays);
      
      res.status(200).json({
        success: true,
        message: 'Cleanup completed',
        data: result
      });
    } catch (error) {
      console.error('[BACKUP CONTROLLER] Error cleaning up backups:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get scheduler status
   */
  async getSchedulerStatus(req, res) {
    try {
      const status = backupScheduler.getScheduleStatus();
      const nextRuns = backupScheduler.getNextRuns();
      
      res.status(200).json({
        success: true,
        data: {
          ...status,
          nextRuns
        }
      });
    } catch (error) {
      console.error('[BACKUP CONTROLLER] Error getting scheduler status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Update scheduler configuration
   */
  async updateScheduler(req, res) {
    try {
      const { jobName, config } = req.body;
      
      if (!jobName || !config) {
        return res.status(400).json({
          success: false,
          message: 'Job name and configuration are required'
        });
      }
      
      const result = backupScheduler.updateSchedule(jobName, config);
      
      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Scheduler configuration updated',
          data: { jobName, config }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update scheduler configuration',
          error: result.error
        });
      }
    } catch (error) {
      console.error('[BACKUP CONTROLLER] Error updating scheduler:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Test backup functionality
   */
  async testBackup(req, res) {
    try {
      console.log('[BACKUP CONTROLLER] Running backup test...');
      
      const result = await backupScheduler.testBackup();
      
      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Backup test completed successfully',
          data: result
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Backup test failed',
          error: result.error
        });
      }
    } catch (error) {
      console.error('[BACKUP CONTROLLER] Error testing backup:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Download backup file
   */
  async downloadBackup(req, res) {
    try {
      const { backupId } = req.params;
      
      const backupPath = await backupService.findBackupFile(backupId);
      if (!backupPath) {
        return res.status(404).json({
          success: false,
          message: 'Backup not found'
        });
      }
      
      res.download(backupPath, `${backupId}.json`, (err) => {
        if (err) {
          console.error('[BACKUP CONTROLLER] Error downloading backup:', err);
          res.status(500).json({
            success: false,
            message: 'Error downloading backup file'
          });
        }
      });
    } catch (error) {
      console.error('[BACKUP CONTROLLER] Error downloading backup:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = new BackupController();
