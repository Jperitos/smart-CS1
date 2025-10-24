#!/usr/bin/env node

/**
 * Backup Management CLI
 * 
 * Command-line interface for managing Firebase backups
 * Usage: node backupCLI.js <command> [options]
 */

const backupService = require('../services/backupService');
const backupScheduler = require('../services/backupScheduler');

class BackupCLI {
  constructor() {
    this.commands = {
      'create': this.createBackup.bind(this),
      'list': this.listBackups.bind(this),
      'restore': this.restoreBackup.bind(this),
      'delete': this.deleteBackup.bind(this),
      'stats': this.showStats.bind(this),
      'test': this.testBackup.bind(this),
      'cleanup': this.cleanupBackups.bind(this),
      'scheduler': this.manageScheduler.bind(this),
      'help': this.showHelp.bind(this)
    };
  }

  async run() {
    const args = process.argv.slice(2);
    const command = args[0];
    const options = this.parseOptions(args.slice(1));

    if (!command || !this.commands[command]) {
      console.log('❌ Unknown command. Use "help" to see available commands.');
      process.exit(1);
    }

    try {
      await this.commands[command](options);
    } catch (error) {
      console.error('💥 Error:', error.message);
      process.exit(1);
    }
  }

  parseOptions(args) {
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (args[i].startsWith('--')) {
        const key = args[i].substring(2);
        const value = args[i + 1];
        options[key] = value === 'true' ? true : value === 'false' ? false : value;
      }
    }
    return options;
  }

  async createBackup(options) {
    const type = options.type || 'manual';
    console.log(`🔄 Creating ${type} backup...`);
    
    const result = await backupService.createFullBackup(type);
    
    if (result.success) {
      console.log('✅ Backup created successfully!');
      console.log(`   ID: ${result.backupId}`);
      console.log(`   Size: ${this.formatFileSize(result.size)}`);
      console.log(`   Path: ${result.path}`);
    } else {
      console.log('❌ Backup creation failed:', result.error);
    }
  }

  async listBackups(options) {
    const type = options.type;
    const limit = parseInt(options.limit) || 20;
    
    console.log('📦 Listing backups...');
    
    let backups = await backupService.listBackups();
    
    if (type) {
      backups = backups.filter(backup => backup.type === type);
    }
    
    backups = backups.slice(0, limit);
    
    if (backups.length === 0) {
      console.log('No backups found.');
      return;
    }
    
    console.log(`\nFound ${backups.length} backups:\n`);
    console.log('ID'.padEnd(30) + 'Type'.padEnd(10) + 'Size'.padEnd(10) + 'Created');
    console.log('-'.repeat(70));
    
    backups.forEach(backup => {
      console.log(
        backup.id.substring(0, 29).padEnd(30) +
        backup.type.padEnd(10) +
        this.formatFileSize(backup.size).padEnd(10) +
        backup.created.toLocaleString()
      );
    });
  }

  async restoreBackup(options) {
    const backupId = options.id;
    const dryRun = options.dryRun === 'true';
    const restoreFirestore = options.firestore !== 'false';
    const restoreRealtime = options.realtime !== 'false';
    
    if (!backupId) {
      console.log('❌ Backup ID is required. Use --id <backupId>');
      return;
    }
    
    console.log(`🔄 Restoring from backup: ${backupId}`);
    if (dryRun) {
      console.log('🧪 Running in dry-run mode (no actual changes will be made)');
    }
    
    const result = await backupService.restoreFromBackup(backupId, {
      restoreFirestore,
      restoreRealtime,
      dryRun
    });
    
    if (result.success) {
      console.log('✅ Restore completed successfully!');
      console.log(`   Firestore: ${result.restored.firestore ? 'Restored' : 'Skipped'}`);
      console.log(`   Realtime: ${result.restored.realtime ? 'Restored' : 'Skipped'}`);
    } else {
      console.log('❌ Restore failed:', result.error);
    }
  }

  async deleteBackup(options) {
    const backupId = options.id;
    
    if (!backupId) {
      console.log('❌ Backup ID is required. Use --id <backupId>');
      return;
    }
    
    console.log(`🗑️ Deleting backup: ${backupId}`);
    
    const backupPath = await backupService.findBackupFile(backupId);
    if (!backupPath) {
      console.log('❌ Backup not found');
      return;
    }
    
    const fs = require('fs').promises;
    await fs.unlink(backupPath);
    
    console.log('✅ Backup deleted successfully!');
  }

  async showStats(options) {
    console.log('📊 Backup Statistics\n');
    
    const stats = await backupService.getBackupStats();
    
    if (!stats) {
      console.log('❌ Unable to retrieve statistics');
      return;
    }
    
    console.log(`Total Backups: ${stats.totalBackups}`);
    console.log(`Total Size: ${stats.totalSizeMB} MB`);
    console.log(`Oldest Backup: ${stats.oldestBackup ? stats.oldestBackup.toLocaleString() : 'N/A'}`);
    console.log(`Newest Backup: ${stats.newestBackup ? stats.newestBackup.toLocaleString() : 'N/A'}`);
    
    console.log('\nBy Type:');
    Object.entries(stats.byType).forEach(([type, data]) => {
      console.log(`  ${type}: ${data.count} backups (${this.formatFileSize(data.size)})`);
    });
  }

  async testBackup(options) {
    console.log('🧪 Running backup test...\n');
    
    const result = await backupScheduler.testBackup();
    
    if (result.success) {
      console.log('✅ Backup test passed!');
      console.log(`   Backup ID: ${result.backupId}`);
      console.log(`   Validation: ${result.validation.valid ? 'Valid' : 'Invalid'}`);
    } else {
      console.log('❌ Backup test failed:', result.error);
    }
  }

  async cleanupBackups(options) {
    const retentionDays = parseInt(options.days) || 30;
    
    console.log(`🧹 Cleaning up backups older than ${retentionDays} days...`);
    
    const result = await backupService.cleanupOldBackups(retentionDays);
    
    console.log(`✅ Cleanup completed. Deleted ${result.deletedCount} old backups.`);
    
    if (result.error) {
      console.log(`⚠️ Warning: ${result.error}`);
    }
  }

  async manageScheduler(options) {
    const action = options.action;
    
    if (!action) {
      console.log('❌ Action is required. Use --action <start|stop|status|update>');
      return;
    }
    
    switch (action) {
      case 'start':
        backupScheduler.start();
        console.log('✅ Backup scheduler started');
        break;
        
      case 'stop':
        backupScheduler.stop();
        console.log('✅ Backup scheduler stopped');
        break;
        
      case 'status':
        const status = backupScheduler.getScheduleStatus();
        console.log('📅 Scheduler Status:');
        console.log(`   Running: ${status.isRunning ? 'Yes' : 'No'}`);
        console.log('\nJobs:');
        Object.entries(status.jobs).forEach(([name, job]) => {
          console.log(`   ${name}: ${job.enabled ? 'Enabled' : 'Disabled'} (${job.cron})`);
        });
        break;
        
      case 'update':
        const jobName = options.job;
        const enabled = options.enabled;
        const cron = options.cron;
        const retention = options.retention;
        
        if (!jobName) {
          console.log('❌ Job name is required. Use --job <jobName>');
          return;
        }
        
        const config = {};
        if (enabled !== undefined) config.enabled = enabled === 'true';
        if (cron) config.cron = cron;
        if (retention) config.retention = parseInt(retention);
        
        const result = backupScheduler.updateSchedule(jobName, config);
        
        if (result.success) {
          console.log(`✅ Scheduler configuration updated for ${jobName}`);
        } else {
          console.log(`❌ Failed to update scheduler: ${result.error}`);
        }
        break;
        
      default:
        console.log('❌ Unknown action. Use start, stop, status, or update');
    }
  }

  showHelp() {
    console.log(`
🔄 Firebase Backup Management CLI

USAGE:
  node backupCLI.js <command> [options]

COMMANDS:
  create                    Create a new backup
    --type <type>          Backup type (manual, daily, weekly, monthly)
    
  list                      List available backups
    --type <type>          Filter by backup type
    --limit <number>       Limit number of results (default: 20)
    
  restore                   Restore from backup
    --id <backupId>        Backup ID to restore
    --dry-run              Run in dry-run mode (no actual changes)
    --firestore <true|false> Restore Firestore (default: true)
    --realtime <true|false>  Restore Realtime DB (default: true)
    
  delete                    Delete a backup
    --id <backupId>        Backup ID to delete
    
  stats                     Show backup statistics
    
  test                      Test backup functionality
    
  cleanup                   Clean up old backups
    --days <number>        Retention period in days (default: 30)
    
  scheduler                 Manage backup scheduler
    --action <action>      Action: start, stop, status, update
    --job <jobName>        Job name (for update action)
    --enabled <true|false> Enable/disable job (for update action)
    --cron <cron>          Cron expression (for update action)
    --retention <days>     Retention days (for update action)
    
  help                      Show this help message

EXAMPLES:
  node backupCLI.js create --type manual
  node backupCLI.js list --type daily --limit 10
  node backupCLI.js restore --id backup_manual_2024-01-15T10-30-00-000Z
  node backupCLI.js restore --id backup_manual_2024-01-15T10-30-00-000Z --dry-run
  node backupCLI.js delete --id backup_manual_2024-01-15T10-30-00-000Z
  node backupCLI.js stats
  node backupCLI.js test
  node backupCLI.js cleanup --days 7
  node backupCLI.js scheduler --action status
  node backupCLI.js scheduler --action update --job daily --enabled false
    `);
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Run if called directly
if (require.main === module) {
  const cli = new BackupCLI();
  cli.run().catch(error => {
    console.error('💥 CLI crashed:', error);
    process.exit(1);
  });
}

module.exports = BackupCLI;
