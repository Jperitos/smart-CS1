const React = require('react');
const { useState, useEffect } = require('react');

const BackupDashboard = () => {
  const [backups, setBackups] = useState([]);
  const [stats, setStats] = useState(null);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [backupsRes, statsRes, schedulerRes] = await Promise.all([
        fetch('/api/backup/list?limit=20'),
        fetch('/api/backup/stats'),
        fetch('/api/backup/scheduler/status')
      ]);

      const [backupsData, statsData, schedulerData] = await Promise.all([
        backupsRes.json(),
        statsRes.json(),
        schedulerRes.json()
      ]);

      if (backupsData.success) setBackups(backupsData.data.backups);
      if (statsData.success) setStats(statsData.data);
      if (schedulerData.success) setSchedulerStatus(schedulerData.data);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async (type = 'manual') => {
    try {
      const response = await fetch('/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Backup created successfully!');
        loadDashboardData();
      } else {
        alert('Backup creation failed: ' + result.message);
      }
    } catch (err) {
      alert('Error creating backup: ' + err.message);
    }
  };

  const restoreBackup = async (backupId) => {
    if (!confirm('Are you sure you want to restore this backup? This will overwrite current data!')) {
      return;
    }

    try {
      const response = await fetch(`/api/backup/${backupId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restoreFirestore: true,
          restoreRealtime: true,
          dryRun: false
        })
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Data restored successfully!');
      } else {
        alert('Restore failed: ' + result.message);
      }
    } catch (err) {
      alert('Error restoring backup: ' + err.message);
    }
  };

  const deleteBackup = async (backupId) => {
    if (!confirm('Are you sure you want to delete this backup?')) {
      return;
    }

    try {
      const response = await fetch(`/api/backup/${backupId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Backup deleted successfully!');
        loadDashboardData();
      } else {
        alert('Delete failed: ' + result.message);
      }
    } catch (err) {
      alert('Error deleting backup: ' + err.message);
    }
  };

  const testBackup = async () => {
    try {
      const response = await fetch('/api/backup/test', {
        method: 'POST'
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Backup test completed successfully!');
      } else {
        alert('Backup test failed: ' + result.message);
      }
    } catch (err) {
      alert('Error testing backup: ' + err.message);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="backup-dashboard">
        <div className="loading">Loading backup dashboard...</div>
      </div>
    );
  }

  return (
    <div className="backup-dashboard">
      <div className="dashboard-header">
        <h1>🔄 Firebase Backup Management</h1>
        <div className="action-buttons">
          <button onClick={() => createBackup('manual')} className="btn btn-primary">
            Create Manual Backup
          </button>
          <button onClick={testBackup} className="btn btn-secondary">
            Test Backup
          </button>
          <button onClick={loadDashboardData} className="btn btn-outline">
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Backups</h3>
            <div className="stat-value">{stats.totalBackups}</div>
          </div>
          <div className="stat-card">
            <h3>Total Size</h3>
            <div className="stat-value">{stats.totalSizeMB} MB</div>
          </div>
          <div className="stat-card">
            <h3>Oldest Backup</h3>
            <div className="stat-value">
              {stats.oldestBackup ? formatDate(stats.oldestBackup) : 'N/A'}
            </div>
          </div>
          <div className="stat-card">
            <h3>Newest Backup</h3>
            <div className="stat-value">
              {stats.newestBackup ? formatDate(stats.newestBackup) : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Scheduler Status */}
      {schedulerStatus && (
        <div className="scheduler-status">
          <h2>📅 Scheduler Status</h2>
          <div className={`status-indicator ${schedulerStatus.isRunning ? 'running' : 'stopped'}`}>
            {schedulerStatus.isRunning ? '🟢 Running' : '🔴 Stopped'}
          </div>
          <div className="scheduler-jobs">
            {Object.entries(schedulerStatus.jobs).map(([jobName, job]) => (
              <div key={jobName} className="job-item">
                <span className="job-name">{jobName}</span>
                <span className={`job-status ${job.enabled ? 'enabled' : 'disabled'}`}>
                  {job.enabled ? '✅' : '❌'}
                </span>
                <span className="job-cron">{job.cron}</span>
                <span className="job-retention">{job.retention} days</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backups List */}
      <div className="backups-section">
        <h2>📦 Recent Backups</h2>
        <div className="backups-table">
          <table>
            <thead>
              <tr>
                <th>Backup ID</th>
                <th>Type</th>
                <th>Size</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.id}>
                  <td className="backup-id">{backup.id}</td>
                  <td>
                    <span className={`backup-type ${backup.type}`}>
                      {backup.type}
                    </span>
                  </td>
                  <td>{formatFileSize(backup.size)}</td>
                  <td>{formatDate(backup.created)}</td>
                  <td className="actions">
                    <button 
                      onClick={() => restoreBackup(backup.id)}
                      className="btn btn-sm btn-warning"
                      title="Restore"
                    >
                      🔄
                    </button>
                    <button 
                      onClick={() => deleteBackup(backup.id)}
                      className="btn btn-sm btn-danger"
                      title="Delete"
                    >
                      🗑️
                    </button>
                    <a 
                      href={`/api/backup/${backup.id}/download`}
                      className="btn btn-sm btn-info"
                      title="Download"
                    >
                      ⬇️
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .backup-dashboard {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e0e0e0;
        }

        .action-buttons {
          display: flex;
          gap: 10px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .btn-primary { background-color: #007bff; color: white; }
        .btn-secondary { background-color: #6c757d; color: white; }
        .btn-outline { background-color: transparent; border: 1px solid #007bff; color: #007bff; }
        .btn-warning { background-color: #ffc107; color: black; }
        .btn-danger { background-color: #dc3545; color: white; }
        .btn-info { background-color: #17a2b8; color: white; }
        .btn-sm { padding: 4px 8px; font-size: 12px; }

        .btn:hover { opacity: 0.8; }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .stat-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          border: 1px solid #e0e0e0;
        }

        .stat-card h3 {
          margin: 0 0 10px 0;
          color: #666;
          font-size: 14px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }

        .scheduler-status {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          border: 1px solid #e0e0e0;
        }

        .status-indicator {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: bold;
          margin-bottom: 15px;
        }

        .status-indicator.running { background-color: #d4edda; color: #155724; }
        .status-indicator.stopped { background-color: #f8d7da; color: #721c24; }

        .scheduler-jobs {
          display: grid;
          gap: 10px;
        }

        .job-item {
          display: grid;
          grid-template-columns: 1fr auto auto auto;
          gap: 15px;
          padding: 10px;
          background: white;
          border-radius: 4px;
          align-items: center;
        }

        .job-name { font-weight: bold; }
        .job-status.enabled { color: green; }
        .job-status.disabled { color: red; }
        .job-cron { font-family: monospace; font-size: 12px; }
        .job-retention { color: #666; }

        .backups-section {
          background: white;
          border-radius: 8px;
          padding: 20px;
          border: 1px solid #e0e0e0;
        }

        .backups-table {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e0e0e0;
        }

        th {
          background-color: #f8f9fa;
          font-weight: bold;
        }

        .backup-id {
          font-family: monospace;
          font-size: 12px;
        }

        .backup-type {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
        }

        .backup-type.manual { background-color: #e3f2fd; color: #1976d2; }
        .backup-type.daily { background-color: #f3e5f5; color: #7b1fa2; }
        .backup-type.weekly { background-color: #e8f5e8; color: #388e3c; }
        .backup-type.monthly { background-color: #fff3e0; color: #f57c00; }

        .actions {
          display: flex;
          gap: 5px;
        }

        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
          border: 1px solid #f5c6cb;
        }

        .loading {
          text-align: center;
          padding: 40px;
          font-size: 18px;
          color: #666;
        }
      `}</style>
    </div>
  );
};

module.exports = BackupDashboard;
