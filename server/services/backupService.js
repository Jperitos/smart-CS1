const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const { db, rtdb, bucket } = require('../models/firebase');

class BackupService {
  constructor() {
    this.backupDir = path.join(__dirname, '../backups');
    this.storage = new Storage();
    this.bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'your-backup-bucket';
    this.ensureBackupDirectory();
  }

  /**
   * Ensure backup directory exists
   */
  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'firestore'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'realtime'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'daily'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'hourly'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'weekly'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'monthly'), { recursive: true });
      console.log('[BACKUP SERVICE] Backup directories initialized');
    } catch (error) {
      console.error('[BACKUP SERVICE] Error creating backup directories:', error);
    }
  }

  /**
   * Create a complete backup of both Firestore and Realtime Database
   */
  async createFullBackup(type = 'manual') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup_${type}_${timestamp}`;
    
    console.log(`[BACKUP SERVICE] Starting full backup: ${backupId}`);
    
    try {
      const backupData = {
        metadata: {
          backupId,
          type,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          databases: ['firestore', 'realtime']
        },
        firestore: {},
        realtime: {}
      };

      // Backup Firestore
      console.log('[BACKUP SERVICE] Backing up Firestore...');
      backupData.firestore = await this.backupFirestore();
      
      // Backup Realtime Database
      console.log('[BACKUP SERVICE] Backing up Realtime Database...');
      backupData.realtime = await this.backupRealtimeDatabase();

      // Save to local file
      const backupPath = path.join(this.backupDir, `${backupId}.json`);
      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
      
      // Upload to cloud storage (optional - won't fail if it doesn't work)
      try {
        await this.uploadToCloudStorage(backupPath, backupId);
      } catch (error) {
        console.log('[BACKUP SERVICE] Cloud upload skipped - continuing with local backup');
      }
      
      // Move to appropriate folder based on type
      await this.organizeBackup(backupPath, type);
      
      console.log(`[BACKUP SERVICE] Full backup completed: ${backupId}`);
      return {
        success: true,
        backupId,
        path: backupPath,
        size: (await fs.stat(backupPath)).size,
        timestamp: backupData.metadata.timestamp
      };
      
    } catch (error) {
      console.error('[BACKUP SERVICE] Full backup failed:', error);
      return {
        success: false,
        error: error.message,
        backupId
      };
    }
  }

  /**
   * Backup Firestore database
   */
  async backupFirestore() {
    try {
      const collections = await db.listCollections();
      const firestoreData = {};
      
      for (const collection of collections) {
        console.log(`[BACKUP SERVICE] Backing up collection: ${collection.id}`);
        const snapshot = await collection.get();
        firestoreData[collection.id] = {};
        
        snapshot.forEach(doc => {
          firestoreData[collection.id][doc.id] = {
            data: doc.data(),
            metadata: {
              createTime: doc.createTime?.toDate?.()?.toISOString(),
              updateTime: doc.updateTime?.toDate?.()?.toISOString()
            }
          };
        });
      }
      
      return firestoreData;
    } catch (error) {
      console.error('[BACKUP SERVICE] Firestore backup failed:', error);
      throw error;
    }
  }

  /**
   * Backup Realtime Database
   */
  async backupRealtimeDatabase() {
    try {
      const snapshot = await rtdb.ref('/').once('value');
      return snapshot.val();
    } catch (error) {
      console.error('[BACKUP SERVICE] Realtime Database backup failed:', error);
      throw error;
    }
  }

  /**
   * Upload backup to cloud storage
   */
  async uploadToCloudStorage(localPath, backupId) {
    try {
      // Skip cloud upload if no bucket is configured
      if (!this.bucketName || this.bucketName === 'your-backup-bucket') {
        console.log('[BACKUP SERVICE] Skipping cloud upload - no bucket configured');
        return null;
      }

      const bucket = this.storage.bucket(this.bucketName);
      const fileName = `backups/${backupId}.json`;
      const file = bucket.file(fileName);
      
      // Use the correct upload method for Google Cloud Storage
      await bucket.upload(localPath, {
        destination: fileName,
        metadata: {
          metadata: {
            backupId,
            timestamp: new Date().toISOString(),
            type: 'full_backup'
          }
        }
      });
      
      console.log(`[BACKUP SERVICE] Uploaded to cloud storage: ${fileName}`);
      return fileName;
    } catch (error) {
      console.error('[BACKUP SERVICE] Cloud upload failed:', error);
      // Don't throw error for cloud upload failures - local backup is still valid
      return null;
    }
  }

  /**
   * Organize backup files by type and frequency
   */
  async organizeBackup(backupPath, type) {
    try {
      // Ensure the target directory exists
      const targetDir = path.join(this.backupDir, type);
      await fs.mkdir(targetDir, { recursive: true });
      
      const fileName = path.basename(backupPath);
      const targetPath = path.join(targetDir, fileName);
      
      // Only copy if the source file exists
      try {
        await fs.access(backupPath);
        await fs.copyFile(backupPath, targetPath);
        console.log(`[BACKUP SERVICE] Backup organized in ${type} folder`);
      } catch (error) {
        console.log(`[BACKUP SERVICE] Source backup file not found, skipping organization`);
      }
    } catch (error) {
      console.error('[BACKUP SERVICE] Error organizing backup:', error);
    }
  }

  /**
   * Restore data from backup
   */
  async restoreFromBackup(backupId, options = {}) {
    try {
      console.log(`[BACKUP SERVICE] Starting restore from backup: ${backupId}`);
      
      // Find backup file
      const backupPath = await this.findBackupFile(backupId);
      if (!backupPath) {
        throw new Error(`Backup file not found: ${backupId}`);
      }
      
      // Read backup data
      const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
      
      // Restore Firestore if requested
      if (options.restoreFirestore !== false && backupData.firestore) {
        console.log('[BACKUP SERVICE] Restoring Firestore...');
        await this.restoreFirestore(backupData.firestore, options);
      }
      
      // Restore Realtime Database if requested
      if (options.restoreRealtime !== false && backupData.realtime) {
        console.log('[BACKUP SERVICE] Restoring Realtime Database...');
        await this.restoreRealtimeDatabase(backupData.realtime, options);
      }
      
      console.log(`[BACKUP SERVICE] Restore completed: ${backupId}`);
      return {
        success: true,
        backupId,
        restored: {
          firestore: options.restoreFirestore !== false,
          realtime: options.restoreRealtime !== false
        }
      };
      
    } catch (error) {
      console.error('[BACKUP SERVICE] Restore failed:', error);
      return {
        success: false,
        error: error.message,
        backupId
      };
    }
  }

  /**
   * Restore Firestore data
   */
  async restoreFirestore(firestoreData, options = {}) {
    try {
      const batch = db.batch();
      let operationCount = 0;
      const maxBatchSize = 500; // Firestore batch limit
      
      for (const [collectionId, documents] of Object.entries(firestoreData)) {
        for (const [docId, docData] of Object.entries(documents)) {
          if (operationCount >= maxBatchSize) {
            await batch.commit();
            operationCount = 0;
          }
          
          const docRef = db.collection(collectionId).doc(docId);
          batch.set(docRef, docData.data);
          operationCount++;
        }
      }
      
      if (operationCount > 0) {
        await batch.commit();
      }
      
      console.log('[BACKUP SERVICE] Firestore restore completed');
    } catch (error) {
      console.error('[BACKUP SERVICE] Firestore restore failed:', error);
      throw error;
    }
  }

  /**
   * Restore Realtime Database data
   */
  async restoreRealtimeDatabase(realtimeData, options = {}) {
    try {
      if (options.dryRun) {
        console.log('[BACKUP SERVICE] Dry run - would restore Realtime Database');
        return;
      }
      
      await rtdb.ref('/').set(realtimeData);
      console.log('[BACKUP SERVICE] Realtime Database restore completed');
    } catch (error) {
      console.error('[BACKUP SERVICE] Realtime Database restore failed:', error);
      throw error;
    }
  }

  /**
   * Find backup file by ID
   */
  async findBackupFile(backupId) {
    try {
      // First check the main backup directory
      const mainDir = this.backupDir;
      try {
        const files = await fs.readdir(mainDir);
        const backupFile = files.find(file => file.includes(backupId) && file.endsWith('.json'));
        if (backupFile) {
          return path.join(mainDir, backupFile);
        }
      } catch (error) {
        // Main directory might not exist, continue searching
      }
      
      // Search in all backup subdirectories
      const searchDirs = ['daily', 'hourly', 'weekly', 'monthly', 'firestore', 'realtime', 'test'];
      
      for (const dir of searchDirs) {
        const dirPath = path.join(this.backupDir, dir);
        try {
          const files = await fs.readdir(dirPath);
          const backupFile = files.find(file => file.includes(backupId) && file.endsWith('.json'));
          if (backupFile) {
            return path.join(dirPath, backupFile);
          }
        } catch (error) {
          // Directory might not exist, continue searching
        }
      }
      
      return null;
    } catch (error) {
      console.error('[BACKUP SERVICE] Error finding backup file:', error);
      return null;
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    try {
      const backups = [];
      const searchDirs = ['daily', 'hourly', 'weekly', 'monthly', 'firestore', 'realtime'];
      
      for (const dir of searchDirs) {
        const dirPath = path.join(this.backupDir, dir);
        try {
          const files = await fs.readdir(dirPath);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const filePath = path.join(dirPath, file);
              const stats = await fs.stat(filePath);
              backups.push({
                id: file.replace('.json', ''),
                type: dir,
                path: filePath,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
              });
            }
          }
        } catch (error) {
          // Directory might not exist, continue
        }
      }
      
      return backups.sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error('[BACKUP SERVICE] Error listing backups:', error);
      return [];
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups(retentionDays = 30) {
    try {
      console.log(`[BACKUP SERVICE] Cleaning up backups older than ${retentionDays} days`);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const backups = await this.listBackups();
      let deletedCount = 0;
      
      for (const backup of backups) {
        if (backup.created < cutoffDate) {
          await fs.unlink(backup.path);
          deletedCount++;
          console.log(`[BACKUP SERVICE] Deleted old backup: ${backup.id}`);
        }
      }
      
      console.log(`[BACKUP SERVICE] Cleanup completed. Deleted ${deletedCount} old backups`);
      return { deletedCount };
    } catch (error) {
      console.error('[BACKUP SERVICE] Cleanup failed:', error);
      return { deletedCount: 0, error: error.message };
    }
  }

  /**
   * Validate backup integrity
   */
  async validateBackup(backupId) {
    try {
      const backupPath = await this.findBackupFile(backupId);
      if (!backupPath) {
        return { valid: false, error: 'Backup file not found' };
      }
      
      const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
      
      // Check required fields
      if (!backupData.metadata || !backupData.metadata.backupId) {
        return { valid: false, error: 'Invalid backup metadata' };
      }
      
      // Check data structure
      const hasFirestore = backupData.firestore && typeof backupData.firestore === 'object';
      const hasRealtime = backupData.realtime && typeof backupData.realtime === 'object';
      
      if (!hasFirestore && !hasRealtime) {
        return { valid: false, error: 'No valid database data found' };
      }
      
      return {
        valid: true,
        metadata: backupData.metadata,
        hasFirestore,
        hasRealtime,
        size: (await fs.stat(backupPath)).size
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats() {
    try {
      const backups = await this.listBackups();
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      
      const stats = {
        totalBackups: backups.length,
        totalSize: totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
        byType: {},
        oldestBackup: null,
        newestBackup: null
      };
      
      // Group by type
      for (const backup of backups) {
        if (!stats.byType[backup.type]) {
          stats.byType[backup.type] = { count: 0, size: 0 };
        }
        stats.byType[backup.type].count++;
        stats.byType[backup.type].size += backup.size;
      }
      
      if (backups.length > 0) {
        stats.oldestBackup = backups[backups.length - 1].created;
        stats.newestBackup = backups[0].created;
      }
      
      return stats;
    } catch (error) {
      console.error('[BACKUP SERVICE] Error getting backup stats:', error);
      return null;
    }
  }
}

// Create singleton instance
const backupService = new BackupService();

module.exports = backupService;
