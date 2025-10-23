#!/usr/bin/env node

/**
 * Backup Testing and Validation Script
 * 
 * This script tests the backup and restore functionality to ensure
 * data integrity and proper operation of the backup system.
 */

const backupService = require('../services/backupService');
const backupScheduler = require('../services/backupScheduler');
const { db, rtdb } = require('../models/firebase');

class BackupTester {
  constructor() {
    this.testData = {
      firestore: {
        testCollection: {
          testDoc1: {
            data: {
              name: 'Test Document 1',
              value: 123,
              timestamp: new Date().toISOString(),
              testField: 'backup-test-data'
            },
            metadata: {
              createTime: new Date().toISOString(),
              updateTime: new Date().toISOString()
            }
          },
          testDoc2: {
            data: {
              name: 'Test Document 2',
              value: 456,
              timestamp: new Date().toISOString(),
              testField: 'backup-test-data'
            },
            metadata: {
              createTime: new Date().toISOString(),
              updateTime: new Date().toISOString()
            }
          }
        }
      },
      realtime: {
        testNode: {
          message: 'This is test data for backup validation',
          timestamp: Date.now(),
          testField: 'backup-test-data',
          nested: {
            level1: {
              level2: 'deeply nested test data'
            }
          }
        }
      }
    };
  }

  /**
   * Run comprehensive backup tests
   */
  async runTests() {
    console.log('🧪 Starting Backup System Tests...\n');
    
    try {
      // Test 1: Create test data
      console.log('📝 Test 1: Creating test data...');
      await this.createTestData();
      console.log('✅ Test data created successfully\n');
      
      // Test 2: Create backup
      console.log('💾 Test 2: Creating backup...');
      const backupResult = await backupService.createFullBackup('test');
      if (!backupResult.success) {
        throw new Error(`Backup creation failed: ${backupResult.error}`);
      }
      console.log(`✅ Backup created: ${backupResult.backupId}\n`);
      
      // Test 3: Validate backup
      console.log('🔍 Test 3: Validating backup...');
      const validation = await backupService.validateBackup(backupResult.backupId);
      if (!validation.valid) {
        throw new Error(`Backup validation failed: ${validation.error}`);
      }
      console.log('✅ Backup validation passed\n');
      
      // Test 4: Clear test data
      console.log('🗑️ Test 4: Clearing test data...');
      await this.clearTestData();
      console.log('✅ Test data cleared\n');
      
      // Test 5: Restore from backup
      console.log('🔄 Test 5: Restoring from backup...');
      const restoreResult = await backupService.restoreFromBackup(backupResult.backupId, {
        restoreFirestore: true,
        restoreRealtime: true
      });
      if (!restoreResult.success) {
        throw new Error(`Restore failed: ${restoreResult.error}`);
      }
      console.log('✅ Data restored successfully\n');
      
      // Test 6: Verify restored data
      console.log('✅ Test 6: Verifying restored data...');
      const verification = await this.verifyRestoredData();
      if (!verification.success) {
        throw new Error(`Data verification failed: ${verification.error}`);
      }
      console.log('✅ Data verification passed\n');
      
      // Test 7: Cleanup
      console.log('🧹 Test 7: Cleaning up...');
      await this.cleanup();
      console.log('✅ Cleanup completed\n');
      
      console.log('🎉 All backup tests passed successfully!');
      return { success: true, backupId: backupResult.backupId };
      
    } catch (error) {
      console.error('❌ Backup test failed:', error.message);
      await this.cleanup();
      return { success: false, error: error.message };
    }
  }

  /**
   * Create test data in both databases
   */
  async createTestData() {
    try {
      // Create Firestore test data
      const testCollection = db.collection('testCollection');
      await testCollection.doc('testDoc1').set(this.testData.firestore.testCollection.testDoc1.data);
      await testCollection.doc('testDoc2').set(this.testData.firestore.testCollection.testDoc2.data);
      
      // Create Realtime Database test data
      await rtdb.ref('testNode').set(this.testData.realtime.testNode);
      
      console.log('   - Firestore test documents created');
      console.log('   - Realtime Database test node created');
    } catch (error) {
      throw new Error(`Failed to create test data: ${error.message}`);
    }
  }

  /**
   * Clear test data from both databases
   */
  async clearTestData() {
    try {
      // Clear Firestore test data
      const testCollection = db.collection('testCollection');
      const snapshot = await testCollection.get();
      const batch = db.batch();
      
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      
      // Clear Realtime Database test data
      await rtdb.ref('testNode').remove();
      
      console.log('   - Firestore test documents deleted');
      console.log('   - Realtime Database test node deleted');
    } catch (error) {
      throw new Error(`Failed to clear test data: ${error.message}`);
    }
  }

  /**
   * Verify that restored data matches original test data
   */
  async verifyRestoredData() {
    try {
      // Verify Firestore data
      const testCollection = db.collection('testCollection');
      const snapshot = await testCollection.get();
      
      if (snapshot.empty) {
        return { success: false, error: 'No Firestore documents found after restore' };
      }
      
      const docs = {};
      snapshot.forEach(doc => {
        docs[doc.id] = doc.data();
      });
      
      // Check if test documents exist and have correct data
      if (!docs.testDoc1 || !docs.testDoc2) {
        return { success: false, error: 'Test documents not found after restore' };
      }
      
      if (docs.testDoc1.testField !== 'backup-test-data' || docs.testDoc2.testField !== 'backup-test-data') {
        return { success: false, error: 'Test document data is incorrect after restore' };
      }
      
      // Verify Realtime Database data
      const realtimeSnapshot = await rtdb.ref('testNode').once('value');
      const realtimeData = realtimeSnapshot.val();
      
      if (!realtimeData || realtimeData.testField !== 'backup-test-data') {
        return { success: false, error: 'Realtime Database data is incorrect after restore' };
      }
      
      console.log('   - Firestore documents verified');
      console.log('   - Realtime Database data verified');
      
      return { success: true };
    } catch (error) {
      return { success: false, error: `Verification failed: ${error.message}` };
    }
  }

  /**
   * Clean up test data and backup files
   */
  async cleanup() {
    try {
      // Clear test data
      await this.clearTestData();
      
      // Clean up test backup files
      const backups = await backupService.listBackups();
      const testBackups = backups.filter(backup => backup.id.includes('test'));
      
      for (const backup of testBackups) {
        try {
          const fs = require('fs').promises;
          await fs.unlink(backup.path);
          console.log(`   - Deleted test backup: ${backup.id}`);
        } catch (error) {
          console.log(`   - Could not delete test backup ${backup.id}: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`   - Cleanup warning: ${error.message}`);
    }
  }

  /**
   * Test backup scheduler functionality
   */
  async testScheduler() {
    console.log('⏰ Testing Backup Scheduler...\n');
    
    try {
      // Test scheduler status
      const status = backupScheduler.getScheduleStatus();
      console.log('📊 Scheduler Status:', status);
      
      // Test manual backup trigger
      console.log('🔄 Testing manual backup trigger...');
      const result = await backupScheduler.triggerBackup('test');
      if (result.success) {
        console.log('✅ Manual backup trigger successful');
      } else {
        console.log('❌ Manual backup trigger failed:', result.error);
      }
      
      // Test backup test functionality
      console.log('🧪 Testing backup test functionality...');
      const testResult = await backupScheduler.testBackup();
      if (testResult.success) {
        console.log('✅ Backup test functionality working');
      } else {
        console.log('❌ Backup test functionality failed:', testResult.error);
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ Scheduler test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test backup statistics and monitoring
   */
  async testMonitoring() {
    console.log('📊 Testing Backup Monitoring...\n');
    
    try {
      // Get backup statistics
      const stats = await backupService.getBackupStats();
      console.log('📈 Backup Statistics:', stats);
      
      // List recent backups
      const backups = await backupService.listBackups();
      console.log(`📦 Found ${backups.length} backups`);
      
      // Test backup validation
      if (backups.length > 0) {
        const latestBackup = backups[0];
        const validation = await backupService.validateBackup(latestBackup.id);
        console.log(`🔍 Latest backup validation: ${validation.valid ? 'Valid' : 'Invalid'}`);
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ Monitoring test failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Main execution
async function main() {
  const tester = new BackupTester();
  
  console.log('🚀 Firebase Backup System Test Suite');
  console.log('=====================================\n');
  
  // Run main backup tests
  const backupTestResult = await tester.runTests();
  
  if (backupTestResult.success) {
    console.log('\n⏰ Testing Scheduler...');
    const schedulerResult = await tester.testScheduler();
    
    console.log('\n📊 Testing Monitoring...');
    const monitoringResult = await tester.testMonitoring();
    
    console.log('\n📋 Test Summary:');
    console.log('================');
    console.log(`✅ Backup Tests: ${backupTestResult.success ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Scheduler Tests: ${schedulerResult.success ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Monitoring Tests: ${monitoringResult.success ? 'PASSED' : 'FAILED'}`);
    
    if (backupTestResult.success && schedulerResult.success && monitoringResult.success) {
      console.log('\n🎉 All tests passed! Backup system is working correctly.');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed. Please check the logs above.');
      process.exit(1);
    }
  } else {
    console.log('\n❌ Backup tests failed. Please check the logs above.');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = BackupTester;
