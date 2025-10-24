#!/usr/bin/env node

/**
 * Backup System Setup Script
 * 
 * Initializes the backup system and creates initial backup
 */

const backupService = require('../services/backupService');
const backupScheduler = require('../services/backupScheduler');
const fs = require('fs').promises;
const path = require('path');

async function setupBackupSystem() {
  console.log('🚀 Setting up Firebase Backup System...\n');
  
  try {
    // 1. Create backup directories
    console.log('📁 Creating backup directories...');
    await backupService.ensureBackupDirectory();
    console.log('✅ Backup directories created\n');
    
    // 2. Test backup functionality
    console.log('🧪 Testing backup functionality...');
    const testResult = await backupScheduler.testBackup();
    
    if (testResult.success) {
      console.log('✅ Backup test passed');
      console.log(`   Test backup ID: ${testResult.backupId}`);
    } else {
      console.log('❌ Backup test failed:', testResult.error);
      return false;
    }
    
    // 3. Create initial backup
    console.log('\n💾 Creating initial backup...');
    const initialBackup = await backupService.createFullBackup('setup');
    
    if (initialBackup.success) {
      console.log('✅ Initial backup created');
      console.log(`   Backup ID: ${initialBackup.backupId}`);
      console.log(`   Size: ${formatFileSize(initialBackup.size)}`);
    } else {
      console.log('❌ Initial backup failed:', initialBackup.error);
      return false;
    }
    
    // 4. Start backup scheduler
    console.log('\n⏰ Starting backup scheduler...');
    backupScheduler.start();
    console.log('✅ Backup scheduler started');
    
    // 5. Show system status
    console.log('\n📊 System Status:');
    const stats = await backupService.getBackupStats();
    if (stats) {
      console.log(`   Total Backups: ${stats.totalBackups}`);
      console.log(`   Total Size: ${stats.totalSizeMB} MB`);
    }
    
    const schedulerStatus = backupScheduler.getScheduleStatus();
    console.log(`   Scheduler Running: ${schedulerStatus.isRunning ? 'Yes' : 'No'}`);
    console.log(`   Active Jobs: ${Object.keys(schedulerStatus.jobs).length}`);
    
    // 6. Create setup completion marker
    const setupMarker = {
      completed: true,
      timestamp: new Date().toISOString(),
      initialBackupId: initialBackup.backupId,
      version: '1.0.0'
    };
    
    await fs.writeFile(
      path.join(__dirname, '../backups/.setup-complete'),
      JSON.stringify(setupMarker, null, 2)
    );
    
    console.log('\n🎉 Backup system setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Access the backup dashboard at /backup-dashboard');
    console.log('2. Use the CLI: node server/scripts/backupCLI.js help');
    console.log('3. Monitor backups: GET /api/backup/health');
    console.log('4. Review documentation: server/BACKUP_SYSTEM_README.md');
    
    return true;
    
  } catch (error) {
    console.error('💥 Setup failed:', error.message);
    return false;
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run if called directly
if (require.main === module) {
  setupBackupSystem().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Setup script crashed:', error);
    process.exit(1);
  });
}

module.exports = setupBackupSystem;
