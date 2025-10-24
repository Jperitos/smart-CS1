# 🔄 Firebase Backup & Disaster Recovery System

A comprehensive backup and disaster recovery solution for Firebase Firestore and Realtime Database.

## 🚀 Features

### ✅ **Multi-Layer Backup System**
- **Automatic Cloud Backup**: Scheduled backups using Cloud Scheduler
- **Manual Backup**: On-demand backup creation via API or CLI
- **Disaster Recovery**: Complete data restoration from JSON backups
- **Cloud Storage**: Automatic upload to Google Cloud Storage
- **Local Storage**: Organized local backup storage with retention policies

### ✅ **Database Support**
- **Firestore**: Complete collection and document backup/restore
- **Realtime Database**: Full database backup/restore
- **Metadata Preservation**: Maintains creation/update timestamps
- **Batch Operations**: Efficient handling of large datasets

### ✅ **Scheduling & Automation**
- **Hourly Backups**: Every hour (24-hour retention)
- **Daily Backups**: 2 AM daily (30-day retention)
- **Weekly Backups**: Sunday 3 AM (12-week retention)
- **Monthly Backups**: 1st of month 4 AM (12-month retention)
- **Configurable**: Easy schedule modification via API

### ✅ **Monitoring & Management**
- **Real-time Dashboard**: Web interface for backup management
- **CLI Tools**: Command-line interface for administrators
- **Statistics**: Comprehensive backup analytics
- **Validation**: Backup integrity verification
- **Cleanup**: Automated old backup removal

## 📁 File Structure

```
server/
├── services/
│   ├── backupService.js          # Core backup functionality
│   └── backupScheduler.js        # Automated scheduling
├── controllers/
│   └── backupController.js       # API endpoints
├── routers/
│   └── backupRouter.js           # Route definitions
├── components/
│   └── BackupDashboard.js        # Web dashboard
├── scripts/
│   ├── backupTest.js             # Testing suite
│   └── backupCLI.js              # Command-line interface
└── backups/                      # Local backup storage
    ├── daily/                    # Daily backups
    ├── hourly/                   # Hourly backups
    ├── weekly/                   # Weekly backups
    ├── monthly/                  # Monthly backups
    ├── firestore/                # Firestore-specific backups
    └── realtime/                 # Realtime DB backups
```

## 🛠️ Installation & Setup

### 1. Install Dependencies

```bash
npm install node-cron @google-cloud/storage
```

### 2. Environment Variables

Add to your `.env` file:

```env
# Firebase Configuration (already required)
FIREBASE_STORAGE_BUCKET=your-backup-bucket
PROJECT_ID=your-project-id

# Backup Configuration (optional)
BACKUP_RETENTION_DAILY=30
BACKUP_RETENTION_WEEKLY=12
BACKUP_RETENTION_MONTHLY=12
```

### 3. Google Cloud Storage Setup

1. Create a Google Cloud Storage bucket for backups
2. Ensure your Firebase service account has Storage Admin permissions
3. Update `FIREBASE_STORAGE_BUCKET` in your environment

### 4. Start the System

The backup system starts automatically with your server:

```bash
npm start
```

## 📚 API Endpoints

### Backup Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/backup/create` | Create manual backup | Staff+ |
| GET | `/api/backup/list` | List available backups | Staff+ |
| GET | `/api/backup/stats` | Get backup statistics | Staff+ |
| GET | `/api/backup/:id` | Get backup details | Staff+ |
| POST | `/api/backup/:id/restore` | Restore from backup | Staff+ |
| DELETE | `/api/backup/:id` | Delete backup | Staff+ |
| GET | `/api/backup/:id/download` | Download backup file | Staff+ |

### Scheduler Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/backup/scheduler/status` | Get scheduler status | Staff+ |
| PUT | `/api/backup/scheduler/update` | Update scheduler config | Staff+ |

### Testing & Maintenance

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/backup/test` | Test backup functionality | Staff+ |
| POST | `/api/backup/cleanup` | Clean up old backups | Staff+ |

## 🖥️ Web Dashboard

Access the backup dashboard at: `http://your-server/backup-dashboard`

### Features:
- **Real-time Statistics**: Total backups, size, oldest/newest
- **Backup List**: View, restore, delete, download backups
- **Scheduler Status**: Monitor automated backup jobs
- **One-click Actions**: Create backups, test system, cleanup

## 💻 Command Line Interface

### Basic Usage

```bash
# Create a manual backup
node server/scripts/backupCLI.js create --type manual

# List recent backups
node server/scripts/backupCLI.js list --limit 10

# Restore from backup
node server/scripts/backupCLI.js restore --id backup_manual_2024-01-15T10-30-00-000Z

# Dry run restore (test without changes)
node server/scripts/backupCLI.js restore --id backup_manual_2024-01-15T10-30-00-000Z --dry-run

# Show statistics
node server/scripts/backupCLI.js stats

# Test backup system
node server/scripts/backupCLI.js test

# Clean up old backups
node server/scripts/backupCLI.js cleanup --days 7

# Manage scheduler
node server/scripts/backupCLI.js scheduler --action status
node server/scripts/backupCLI.js scheduler --action update --job daily --enabled false
```

### Advanced Examples

```bash
# Create specific type backup
node server/scripts/backupCLI.js create --type daily

# List only daily backups
node server/scripts/backupCLI.js list --type daily --limit 5

# Restore only Firestore data
node server/scripts/backupCLI.js restore --id backup_123 --realtime false

# Update scheduler configuration
node server/scripts/backupCLI.js scheduler --action update --job hourly --cron "0 */2 * * *" --retention 12
```

## 🧪 Testing

### Run Full Test Suite

```bash
node server/scripts/backupTest.js
```

### Test Individual Components

```bash
# Test backup creation and validation
node server/scripts/backupCLI.js test

# Test scheduler functionality
node server/scripts/backupCLI.js scheduler --action status
```

## 📊 Monitoring & Alerts

### Backup Statistics

The system tracks:
- Total number of backups
- Total storage used
- Backup frequency by type
- Oldest and newest backups
- Success/failure rates

### Health Checks

- **Backup Validation**: Verifies backup integrity
- **Scheduler Status**: Monitors automated jobs
- **Storage Space**: Tracks local and cloud storage usage
- **Error Logging**: Comprehensive error tracking

## 🔧 Configuration

### Scheduler Configuration

```javascript
const scheduleConfig = {
  hourly: {
    enabled: true,
    cron: '0 * * * *',     // Every hour
    retention: 24          // Keep for 24 hours
  },
  daily: {
    enabled: true,
    cron: '0 2 * * *',     // 2 AM daily
    retention: 30          // Keep for 30 days
  },
  weekly: {
    enabled: true,
    cron: '0 3 * * 0',     // 3 AM every Sunday
    retention: 12          // Keep for 12 weeks
  },
  monthly: {
    enabled: true,
    cron: '0 4 1 * *',     // 4 AM on 1st of every month
    retention: 12          // Keep for 12 months
  }
};
```

### Backup Types

- **manual**: On-demand backups
- **hourly**: Automated hourly backups
- **daily**: Automated daily backups
- **weekly**: Automated weekly backups
- **monthly**: Automated monthly backups
- **test**: Testing backups (auto-deleted)

## 🚨 Disaster Recovery

### Complete System Restore

1. **Stop all services** to prevent data conflicts
2. **Identify the backup** to restore from
3. **Run restore command**:
   ```bash
   node server/scripts/backupCLI.js restore --id backup_daily_2024-01-15T02-00-00-000Z
   ```
4. **Verify data integrity** using validation tools
5. **Restart services** and monitor for issues

### Partial Restore

```bash
# Restore only Firestore
node server/scripts/backupCLI.js restore --id backup_123 --realtime false

# Restore only Realtime Database
node server/scripts/backupCLI.js restore --id backup_123 --firestore false
```

### Emergency Procedures

1. **Immediate Response**:
   - Stop all write operations
   - Assess data loss scope
   - Identify latest good backup

2. **Data Recovery**:
   - Restore from most recent backup
   - Validate data integrity
   - Test critical functionality

3. **System Restoration**:
   - Gradually restart services
   - Monitor for issues
   - Document lessons learned

## 🔒 Security Considerations

### Access Control
- All backup operations require staff-level authentication
- Backup files are stored with appropriate permissions
- Cloud storage uses Firebase service account credentials

### Data Protection
- Backups are encrypted in transit and at rest
- Local backup files are stored securely
- Cloud backups follow Google Cloud security best practices

### Audit Trail
- All backup operations are logged
- Restore operations require explicit confirmation
- Access to backup files is tracked

## 📈 Performance Optimization

### Backup Efficiency
- **Batch Operations**: Firestore operations use batching for efficiency
- **Throttling**: Prevents overwhelming Firebase with requests
- **Compression**: Backup files are compressed for storage efficiency

### Storage Management
- **Retention Policies**: Automatic cleanup of old backups
- **Cloud Storage**: Offsite storage for disaster recovery
- **Local Caching**: Recent backups kept locally for quick access

## 🐛 Troubleshooting

### Common Issues

1. **Backup Creation Fails**
   - Check Firebase credentials
   - Verify storage bucket permissions
   - Ensure sufficient disk space

2. **Scheduler Not Running**
   - Check server logs for errors
   - Verify cron job configuration
   - Restart the backup scheduler

3. **Restore Fails**
   - Validate backup file integrity
   - Check database permissions
   - Ensure sufficient storage space

### Debug Commands

```bash
# Check scheduler status
node server/scripts/backupCLI.js scheduler --action status

# Test backup functionality
node server/scripts/backupCLI.js test

# Validate specific backup
node server/scripts/backupCLI.js list --id backup_123
```

## 📞 Support

For issues or questions:
1. Check the logs in `server/logs/`
2. Run the test suite: `node server/scripts/backupTest.js`
3. Use the CLI for debugging: `node server/scripts/backupCLI.js help`
4. Review this documentation for configuration options

## 🔄 Updates & Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Review backup statistics and cleanup old files
2. **Monthly**: Test restore procedures with sample data
3. **Quarterly**: Review and update retention policies
4. **Annually**: Test complete disaster recovery procedures

### System Updates

When updating the backup system:
1. Stop the backup scheduler
2. Create a manual backup before changes
3. Update the system
4. Test backup functionality
5. Restart the scheduler

---

**🎉 Your Firebase data is now fully protected with enterprise-grade backup and disaster recovery capabilities!**
