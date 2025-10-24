const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Simple staff authentication middleware for backup routes
const requireStaff = (req, res, next) => {
  // For now, allow all authenticated users to access backup routes
  // In production, you might want to add role-based access control
  if (req.user) {
    next();
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }
};

// Apply authentication to all backup routes
router.use(authMiddleware);
router.use(requireStaff);

// Backup management routes
router.post('/create', backupController.createBackup);
router.get('/list', backupController.listBackups);
router.get('/stats', backupController.getBackupStats);
router.post('/cleanup', backupController.cleanupBackups);

// Individual backup operations
router.get('/:backupId', backupController.getBackupDetails);
router.post('/:backupId/restore', backupController.restoreBackup);
router.delete('/:backupId', backupController.deleteBackup);
router.get('/:backupId/download', backupController.downloadBackup);

// Scheduler management
router.get('/scheduler/status', backupController.getSchedulerStatus);
router.put('/scheduler/update', backupController.updateScheduler);

// Testing and maintenance
router.post('/test', backupController.testBackup);

module.exports = router;
