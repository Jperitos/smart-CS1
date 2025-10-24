const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('./utils/googleAuth');
const authRouter = require('./routers/authRouter');
const staffRouter = require('./routers/staffRoutes');
const scheduleRouter = require('./routers/scheduleRouter');
const truckScheduleRoutes = require('./routers/truckScheduleRoutes');
const binRoutes = require('./routers/binRoutes');
const errorHandler = require('./middlewares/errorHandler');
const activityRoutes = require('./routers/activityRoutes');
const activityStatsRoutes = require('./routers/activityStatsRoutes');
const analyticsRoutes = require('./routers/analyticsRoutes');
const wasteRoutes = require('./routers/wasteRoutes');
const { admin, db } = require('./models/firebase');
const { sendJanitorAssignmentNotification } = require('./controllers/activityController');


const notificationRoutes = require('./routers/notificationRoutes');
const binHistoryRoutes = require('./routers/binHistoryRoutes');
const binNotificationRoutes = require('./routers/binNotificationRoutes');
const pickupRequestRoutes = require('./routers/pickupRequestRoutes');
const ratingRoutes = require('./routers/ratingRoutes');
const feedbackRoutes = require('./routers/feedbackRoutes');
const performanceRoutes = require('./routers/performanceRoutes');
const binHealthRoutes = require('./routers/binHealthRoutes');
const gpsBackupRoutes = require('./routers/gpsBackupRoutes');
const userInfoRoutes = require('./routers/userInfoRoutes');
const cacheRoutes = require('./routers/cacheRoutes');
const routeRoutes = require('./routers/routeRoutes');
const backupRoutes = require('./routers/backupRouter');
const { sendCriticalBinNotification, sendWarningBinNotification } = require('./controllers/notificationController');
const BinHistoryProcessor = require('./utils/binHistoryProcessor');
const binNotificationController = require('./controllers/binNotificationController');
const automaticTaskService = require('./services/automaticTaskService');
const binHealthMonitor = require('./services/binHealthMonitor');
const gpsBackupService = require('./services/gpsBackupService');
const smsNotificationService = require('./services/smsNotificationService');
const gsmService = require('./services/gsmService');
const backupScheduler = require('./services/backupScheduler');



const realtimeDb = admin.database();
const dataRef = realtimeDb.ref('monitoring/data');
const bin1Ref = realtimeDb.ref('monitoring/bin1');
const bin2Ref = realtimeDb.ref('monitoring/bin2');

// Throttling variables to reduce Firebase reads
let lastDataProcessTime = 0;
let lastBin1ProcessTime = 0;
let lastBin2ProcessTime = 0;
const PROCESS_THROTTLE_MS = 5000; // Process at most every 5 seconds
const GPS_PROCESS_THROTTLE_MS = 60000; // GPS processing at most every minute

// Notification flags for each bin
let criticalNotificationSent = false;
let warningNotificationSent = false;
let criticalNotificationSentBin2 = false;
let warningNotificationSentBin2 = false;


// Initialize Firebase with env variables
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.TYPE,
      project_id: process.env.PROJECT_ID,
      private_key_id: process.env.PRIVATE_KEY_ID,
      private_key: process.env.PRIVATE_KEY,
      client_email: process.env.CLIENT_EMAIL,
      client_id: process.env.CLIENT_ID,
      auth_uri: process.env.AUTH_URI,
      token_uri: process.env.TOKEN_URI,
      auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
      universe_domain: process.env.UNIVERSE_DOMAIN,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

console.log('✅ Firebase initialized successfully');

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000', // React development server
    'http://localhost:5173', // Vite development server
    'http://localhost:8081', 
    'http://localhost:8080', 
    'http://localhost:8000',
    'http://192.168.1.13:8000', // Current server IP
    'http://192.168.1.17:8000',
    'http://192.168.1.0/24', // Allow all devices on the same network
    'exp://192.168.1.17:8081', // Expo development server
    'exp://192.168.1.13:8081', // Expo development server with current IP
    'exp://localhost:8081'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));
app.use(bodyParser.json());
app.use(express.json());
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || "defaultsecret",
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRouter);
app.use('/api/staff', staffRouter);  
app.use("/api/schedules", scheduleRouter);
app.use("/api/truck-schedules", truckScheduleRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/waste", wasteRoutes);
console.log('[INDEX] Mounting binRoutes at /api');
app.use("/api", binRoutes);
console.log('[INDEX] binRoutes mounted successfully');

// Add endpoint to trigger web dashboard refresh
app.post('/api/trigger-refresh', (req, res) => {
  try {
    const { source, timestamp } = req.body;
    console.log(`[REFRESH TRIGGER] ${source} triggered refresh at ${timestamp}`);
    
    // You could implement WebSocket or SSE here for real-time updates
    // For now, we'll just log it and return success
    res.json({ 
      success: true, 
      message: 'Refresh triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[REFRESH TRIGGER] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// Manual task assignment endpoint (must be before activity routes)
app.post('/api/assign-task', async (req, res) => {
  try {
    console.log('[MANUAL ASSIGNMENT API] Request received:', {
      body: req.body,
      headers: req.headers,
      method: req.method,
      url: req.url
    });
    
    const { activityId, janitorId, janitorName, taskNote } = req.body;
    
    if (!activityId || !janitorId) {
      console.log('[MANUAL ASSIGNMENT API] Missing required fields:', { activityId, janitorId });
      return res.status(400).json({
        success: false,
        error: 'activityId and janitorId are required'
      });
    }

    console.log(`[MANUAL ASSIGNMENT API] Assigning task ${activityId} to janitor ${janitorId}`);

    // Get the activity log to extract bin information
    const activityRef = db.collection("activitylogs").doc(activityId);
    const activityDoc = await activityRef.get();
    
    if (!activityDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Activity log not found'
      });
    }

    const activityData = activityDoc.data();
    const binId = activityData.bin_id;
    const binLocation = activityData.bin_location;
    const binLevel = activityData.bin_level;

    // Update the activity log with janitor assignment
    const updateData = {
      assigned_janitor_id: janitorId,
      assigned_janitor_name: janitorName || 'Staff Assigned',
      status: 'in_progress',
      bin_status: 'in_progress',
      updated_at: new Date().toISOString(),
      assignment_type: 'manual',
      assignment_timestamp: new Date().toISOString()
    };

    await activityRef.update(updateData);

    // Send SMS notification to the assigned janitor
    try {
      await sendJanitorAssignmentNotification({
        janitorId,
        janitorName: janitorName || 'Staff Assigned',
        binId,
        binLocation: binLocation || 'Unknown Location',
        binLevel: binLevel || 0,
        taskNote: taskNote || '',
        activityType: 'manual_assignment',
        priority: binLevel >= 80 ? 'high' : binLevel >= 50 ? 'medium' : 'low',
        activityId: activityId,
        timestamp: new Date(),
        isTaskAssignment: true,
        assignmentType: 'manual' // Add indicator for manual assignment
      });

      console.log(`[MANUAL ASSIGNMENT API] ✅ Task ${activityId} assigned to janitor ${janitorId} with SMS notification`);
    } catch (smsError) {
      console.error('[MANUAL ASSIGNMENT API] SMS notification error:', smsError);
      // Don't fail the assignment if SMS fails
    }

    res.json({
      success: true,
      message: 'Task assigned successfully',
      data: {
        activityId,
        assigned_janitor_id: janitorId,
        assigned_janitor_name: janitorName || 'Staff Assigned',
        status: 'in_progress',
        assignment_type: 'manual'
      }
    });

  } catch (error) {
    console.error('[MANUAL ASSIGNMENT API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.use("/api", activityRoutes);
app.use("/api", activityStatsRoutes);

// Get available janitors for task assignment
app.get('/api/janitors/available', async (req, res) => {
  try {
    console.log('[JANITORS API] Fetching available janitors...');
    
    const janitorsRef = db.collection('users');
    const snapshot = await janitorsRef.where('role', '==', 'janitor').get();
    
    const janitors = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      janitors.push({
        id: doc.id,
        fullName: data.fullName,
        email: data.email,
        contactNumber: data.contactNumber,
        location: data.location,
        status: data.status
      });
    });
    
    console.log(`[JANITORS API] Found ${janitors.length} janitors`);
    
    res.json({
      success: true,
      janitors: janitors,
      count: janitors.length
    });
    
  } catch (error) {
    console.error('[JANITORS API] Error fetching janitors:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


app.use('/api/notifications', notificationRoutes);
app.use('/api', binHistoryRoutes);
app.use('/api', binNotificationRoutes);
app.use('/api', pickupRequestRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/bin-health', binHealthRoutes);
app.use('/api/gps-backup', gpsBackupRoutes);
app.use('/api', userInfoRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/backup', backupRoutes);

// Backup status endpoint for monitoring
app.get('/api/backup/health', (req, res) => {
  try {
    const backupScheduler = require('./services/backupScheduler');
    const status = backupScheduler.getScheduleStatus();
    
    res.json({
      status: 'healthy',
      scheduler: {
        running: status.isRunning,
        jobs: Object.keys(status.jobs).length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.use(errorHandler);

app.get('/', (req, res) => {
  res.send('API is running');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Google OAuth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/login' }),
  (req, res) => {
    res.send('Google login successful!');
  }
);

// Notification flags moved to top of file

// Quota monitoring
let firebaseOperationsCount = 0;
let lastQuotaReset = Date.now();
const QUOTA_RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

// Real-time data monitoring function
function setupRealTimeMonitoring() {
  console.log('🔍 Setting up real-time data monitoring...');
  
  // Monitor monitoring/data (original path) - OPTIMIZED WITH THROTTLING
  dataRef.on('value', async (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const now = Date.now();
      
      // Throttle processing to reduce Firebase reads
      if (now - lastDataProcessTime < PROCESS_THROTTLE_MS) {
        console.log(`[THROTTLE] Skipping data processing - too frequent (${Math.round((now - lastDataProcessTime) / 1000)}s ago)`);
        return;
      }
      
      lastDataProcessTime = now;
      
      console.log('\n === REAL-TIME DATA UPDATE (monitoring/data) ===');
      console.log(`Timestamp: ${new Date().toLocaleString()}`);
      console.log(` Weight: ${data.weight_kg || 0} kg (${data.weight_percent || 0}%)`);
      console.log(` Distance: ${data.distance_cm || 0} cm (Height: ${data.height_percent || 0}%)`);
      console.log(` Bin Level: ${data.bin_level || 0}%`);
      console.log(` GPS: ${data.latitude || 'N/A'}, ${data.longitude || 'N/A'}`);
      console.log(` Satellites: ${data.satellites || 0}`);
      console.log(` Last Active: ${data.last_active || 'Unknown'}`);
      console.log(` GPS Time: ${data.gps_timestamp || 'N/A'}`);
      console.log('==========================================\n');
       
      // Apply GPS fallback logic for monitoring/data - OPTIMIZED WITH CACHING
      try {
        // Check cache first to avoid redundant GPS processing
        const gpsCacheKey = CacheManager.generateKey('gps_data', 'data', data.latitude, data.longitude);
        let processedGPSData = CacheManager.get(gpsCacheKey);
        
        if (!processedGPSData) {
          // Rate limit GPS processing
          if (rateLimiter.isAllowed('gps_processing', 5, GPS_PROCESS_THROTTLE_MS)) {
            processedGPSData = await gpsFallbackService.processGPSData('data', {
              latitude: data.latitude,
              longitude: data.longitude,
              satellites: data.satellites || 0,
              last_active: data.last_active,
              gps_timestamp: data.gps_timestamp,
              timestamp: Date.now()
            });
            
            // Cache the result for 2 minutes
            CacheManager.set(gpsCacheKey, processedGPSData, 120);
            console.log(`[GPS FALLBACK] Data source: ${processedGPSData.coordinates_source}`);
            if (processedGPSData.coordinates_source === 'gps_fallback') {
              console.log(`[GPS FALLBACK] Using fallback coordinates: ${processedGPSData.latitude}, ${processedGPSData.longitude}`);
            }
          } else {
            console.log(`[GPS RATE LIMIT] Skipping GPS processing - rate limited`);
          }
        } else {
          console.log(`[GPS CACHE] Using cached GPS data`);
        }
      } catch (gpsError) {
        console.error('[GPS FALLBACK] Error processing GPS data:', gpsError);
      }
      
      // SMS alert logic for monitoring/data - AUTOMATIC SMS when bin exceeds 85%
      if (data.bin_level >= 85 && !smsSentData) {
        console.log(`🚨 S1BIN3 ALERT: Level ${data.bin_level}% exceeds 85% threshold!`);
        console.log('📱 Sending automatic SMS notification...');
        
        const smsMessage = `🚨 SMARTBIN ALERT 🚨\n\nBin S1Bin3 is at ${data.bin_level}% capacity!\nLocation: Central Plaza\nTime: ${new Date().toLocaleString()}\n\nPlease empty the bin immediately.`;
        
        try {
          await sendSMS('+639309096606', smsMessage);
          smsSentData = true;
          console.log('✅ AUTOMATIC SMS sent successfully for S1Bin3');
        } catch (smsError) {
          console.error('❌ FAILED to send automatic SMS for S1Bin3:', smsError);
          // Reset flag to retry on next data update
          smsSentData = false;
        }
      } else if (data.bin_level < 85) {
        smsSentData = false; // Reset flag if bin level drops below threshold
        console.log(`📊 S1Bin3 level ${data.bin_level}% is below 85% threshold - SMS flag reset`);
      }

      // Notification logic for monitoring/data
      try {
        if (data.bin_level >= 85 && !criticalNotificationSent) {
          console.log('🚨 Sending critical bin notification...');
          await sendCriticalBinNotification('S1Bin3', data.bin_level, 'Central Plaza');
          criticalNotificationSent = true;
          warningNotificationSent = false; // Reset warning flag
        } else if (data.bin_level >= 70 && data.bin_level < 85 && !warningNotificationSent) {
          console.log('⚠️ Sending warning bin notification...');
          await sendWarningBinNotification('S1Bin3', data.bin_level, 'Central Plaza');
          warningNotificationSent = true;
        } else if (data.bin_level < 70) {
          // Reset flags when bin level drops below warning threshold
          criticalNotificationSent = false;
          warningNotificationSent = false;
        }
      } catch (notifyErr) {
        console.error('Failed to send bin notification for monitoring/data:', notifyErr);
      }
    }
  });
  
  // Monitor monitoring/bin1 (new path) - OPTIMIZED WITH THROTTLING
  bin1Ref.on('value', async (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const now = Date.now();
      
      // Throttle processing to reduce Firebase reads
      if (now - lastBin1ProcessTime < PROCESS_THROTTLE_MS) {
        console.log(`[THROTTLE] Skipping bin1 processing - too frequent (${Math.round((now - lastBin1ProcessTime) / 1000)}s ago)`);
        return;
      }
      
      lastBin1ProcessTime = now;
      
      console.log('\n === REAL-TIME DATA UPDATE (monitoring/bin1) ===');
      console.log(` Timestamp: ${new Date().toLocaleString()}`);
      console.log(` Weight: ${data.weight_kg || 0} kg (${data.weight_percent || 0}%)`);
      console.log(` Distance: ${data.distance_cm || 0} cm (Height: ${data.height_percent || 0}%)`);
      console.log(` Bin Level: ${data.bin_level || 0}%`);
      console.log(` GPS: ${data.latitude || 'N/A'}, ${data.longitude || 'N/A'}`);
      console.log(` Satellites: ${data.satellites || 0}`);
      console.log(` Last Active: ${data.last_active || 'Unknown'}`);
      console.log(` GPS Time: ${data.gps_timestamp || 'N/A'}`);
      console.log('==========================================\n');
      
      // Process data through bin history system (with quota protection) - OPTIMIZED
      try {
        // Process GPS data directly from the raw data
        const processedGPSData = {
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
          gps_valid: data.gps_valid || false,
          coordinates_source: data.coordinates_source || 'unknown'
        };

        // Process bin history for significant levels to reduce Firebase calls
        if (data.bin_level >= 70 || data.bin_level <= 10) {
          const historyResult = await BinHistoryProcessor.processExistingMonitoringData({
            weight: data.weight_percent || 0,
            distance: data.height_percent || 0,
            binLevel: data.bin_level || 0,
            gps: {
              lat: processedGPSData.latitude,
              lng: processedGPSData.longitude
            },
            gpsValid: processedGPSData.gps_valid,
            satellites: data.satellites || 0,
            errorMessage: null,
            coordinatesSource: processedGPSData.coordinates_source
          });
          
          if (historyResult.success) {
            console.log(`[BIN HISTORY] Recorded monitoring data for bin1: Status=${historyResult.status}`);
          } else {
            console.error('[BIN HISTORY] Failed to record monitoring data:', historyResult.error);
          }
        } else {
          console.log(`[BIN HISTORY] Skipping database write for normal bin level: ${data.bin_level}%`);
        }

        // Check for automatic task creation and notifications for critical levels (separate from bin history processing)
        if (data.bin_level >= 85) {
          console.log(`[AUTOMATIC TASK] 🔍 Bin level ${data.bin_level}% >= 85% - checking for automatic task creation`);
          try {
            // 1. Create automatic task assignment FIRST
            const taskResult = await automaticTaskService.createAutomaticTask({
              binId: 'bin1',
              binLevel: data.bin_level || 0,
              binLocation: 'Central Plaza',
              timestamp: new Date()
            });

            if (taskResult.success) {
              console.log(`[AUTOMATIC TASK] ✅ ${taskResult.message}`);
            } else {
              console.log(`[AUTOMATIC TASK] ❌ ${taskResult.message} - ${taskResult.reason || taskResult.error}`);
            }

            // 2. Then send notifications
            const notificationResult = await binNotificationController.checkBinAndNotify({
              binId: 'bin1',
              binLevel: data.bin_level || 0,
              status: data.bin_level >= 90 ? 'critical' : 'warning',
              gps: {
                lat: data.latitude || 0,
                lng: data.longitude || 0
              },
              timestamp: new Date(),
              weight: data.weight_percent || 0,
              distance: data.height_percent || 0,
              gpsValid: data.gps_valid || false,
              satellites: data.satellites || 0,
              errorMessage: null
            });
            
            if (notificationResult.notificationSent) {
              console.log(`[BIN NOTIFICATION] Sent notification to janitor: ${notificationResult.type}`);
            }
          } catch (notifyErr) {
            console.error('[BIN NOTIFICATION] Error sending notification:', notifyErr);
          }
        }
      } catch (historyErr) {
        console.error('[BIN HISTORY] Error processing monitoring data:', historyErr);
      }
      

      // Notification logic for monitoring/bin1
      try {
        if (data.bin_level >= 85 && !criticalNotificationSent) {
          console.log('🚨 Sending critical bin1 notification...');
          
          // Automatic task creation is already handled in the main monitoring loop above
          // No need to create duplicate tasks here
          
          await sendCriticalBinNotification('Bin1', data.bin_level, 'Central Plaza');
          criticalNotificationSent = true;
          warningNotificationSent = false; // Reset warning flag
        } else if (data.bin_level >= 70 && data.bin_level < 85 && !warningNotificationSent) {
          console.log('⚠️ Sending warning bin1 notification...');
          await sendWarningBinNotification('Bin1', data.bin_level, 'Central Plaza');
          warningNotificationSent = true;
        } else if (data.bin_level < 70) {
          // Reset flags when bin level drops below warning threshold
          criticalNotificationSent = false;
          warningNotificationSent = false;
        }
      } catch (notifyErr) {
        console.error('Failed to send bin notification for monitoring/bin1:', notifyErr);
      }
    }
  });
  
  // Monitor monitoring/bin2 (new path) - OPTIMIZED WITH THROTTLING
  bin2Ref.on('value', async (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const now = Date.now();
      
      // Throttle processing to avoid excessive Firebase reads
      if (now - lastBin2ProcessTime < PROCESS_THROTTLE_MS) {
        return;
      }
      
      lastBin2ProcessTime = now;
      
      console.log('\n === REAL-TIME DATA UPDATE (monitoring/bin2) ===');
      console.log(` Timestamp: ${new Date().toLocaleString()}`);
      console.log(` Weight: ${data.weight_kg || 0} kg (${data.weight_percent || 0}%)`);
      console.log(` Distance: ${data.distance_cm || 0} cm (Height: ${data.height_percent || 0}%)`);
      console.log(` Bin Level: ${data.bin_level || 0}%`);
      console.log(` GPS: ${data.latitude || 'N/A'}, ${data.longitude || 'N/A'}`);
      console.log(` GPS Valid: ${data.gps_valid || false}`);
      console.log(` Satellites: ${data.satellites || 0}`);
      console.log(' ================================================\n');
      
      // Process bin history for bin2 (with quota protection) - OPTIMIZED
      try {
        // Process GPS data directly from the raw data
        const processedGPSData = {
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
          gps_valid: data.gps_valid || false,
          coordinates_source: data.coordinates_source || 'unknown'
        };

        // Process bin history for significant levels to reduce Firebase calls
        if (data.bin_level >= 70 || data.bin_level <= 10) {
          const historyResult = await BinHistoryProcessor.processExistingMonitoringData({
            weight: data.weight_percent || 0,
            distance: data.height_percent || 0,
            binLevel: data.bin_level || 0,
            gps: {
              lat: processedGPSData.latitude,
              lng: processedGPSData.longitude
            },
            gpsValid: processedGPSData.gps_valid,
            satellites: data.satellites || 0,
            errorMessage: null,
            coordinatesSource: processedGPSData.coordinates_source
          });
          
          if (historyResult.success) {
            console.log(`[BIN HISTORY] Processed bin2 data: ${data.bin_level}%`);
          } else {
            console.log(`[BIN HISTORY] Failed to process bin2 data: ${historyResult.error}`);
          }
        }

        // Check for automatic task creation and notifications for critical levels (separate from bin history processing)
        if (data.bin_level >= 85) {
          console.log(`[AUTOMATIC TASK] 🔍 Bin2 level ${data.bin_level}% >= 85% - checking for automatic task creation`);
          try {
            // 1. Create automatic task assignment FIRST
            const taskResult = await automaticTaskService.createAutomaticTask({
              binId: 'bin2',
              binLevel: data.bin_level || 0,
              binLocation: 'Secondary Location', // You can change this location
              timestamp: new Date()
            });

            if (taskResult.success) {
              console.log(`[AUTOMATIC TASK] ✅ ${taskResult.message}`);
            } else {
              console.log(`[AUTOMATIC TASK] ❌ ${taskResult.message} - ${taskResult.reason || taskResult.error}`);
            }

            // 2. Then send notifications
            const notificationResult = await binNotificationController.checkBinAndNotify({
              binId: 'bin2',
              binLevel: data.bin_level || 0,
              status: data.bin_level >= 90 ? 'critical' : 'warning',
              gps: {
                lat: data.latitude || 0,
                lng: data.longitude || 0
              },
              timestamp: new Date(),
              weight: data.weight_percent || 0,
              distance: data.height_percent || 0,
              gpsValid: data.gps_valid || false,
              satellites: data.satellites || 0,
              errorMessage: null
            });
            
            if (notificationResult.notificationSent) {
              console.log(`[BIN NOTIFICATION] Sent notification to janitor: ${notificationResult.type}`);
            }
          } catch (notifyErr) {
            console.error('[BIN NOTIFICATION] Error sending notification:', notifyErr);
          }
        }
      } catch (historyErr) {
        console.error('[BIN HISTORY] Error processing monitoring data:', historyErr);
      }
      

      // Notification logic for monitoring/bin2
      try {
        if (data.bin_level >= 85 && !criticalNotificationSentBin2) {
          console.log('🚨 Sending critical bin2 notification...');
          
          // Automatic task creation is already handled in the main monitoring loop above
          // Additional notification logic can be added here if needed
          
          criticalNotificationSentBin2 = true;
        } else if (data.bin_level >= 70 && data.bin_level < 85 && !warningNotificationSentBin2) {
          console.log('⚠️ Sending warning bin2 notification...');
          warningNotificationSentBin2 = true;
        } else if (data.bin_level < 70) {
          // Reset flags when bin level drops below warning threshold
          criticalNotificationSentBin2 = false;
          warningNotificationSentBin2 = false;
        }
      } catch (notifyErr) {
        console.error('Failed to send bin notification for monitoring/bin2:', notifyErr);
      }
    }
  });
  
  console.log('✅ Real-time monitoring active for monitoring/data, monitoring/bin1, and monitoring/bin2');
}

app.get('/api/bin', async (req, res) => {
  try {
    const snapshot = await dataRef.once('value');
    const data = snapshot.val();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bin data', details: err.message });
  }
});

// Test endpoint to manually trigger automatic task creation
app.post('/api/test/automatic-task', async (req, res) => {
  try {
    const { binLevel = 90, binId = 'bin1', binLocation = 'Central Plaza' } = req.body;
    
    const taskResult = await automaticTaskService.createAutomaticTask({
      binId,
      binLevel,
      binLocation,
      timestamp: new Date()
    });

    res.json({
      success: taskResult.success,
      message: taskResult.message,
      taskId: taskResult.taskId,
      taskData: taskResult.taskData
    });
  } catch (error) {
    console.error('Error testing automatic task creation:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to test automatic task creation'
    });
  }
});

// Test endpoint to manually trigger bin health check
app.post('/api/test/bin-health-check', async (req, res) => {
  try {
    console.log('[TEST] Manual bin health check triggered');
    await binHealthMonitor.manualHealthCheck();
    
    res.status(200).json({
      success: true,
      message: 'Manual bin health check completed',
      status: binHealthMonitor.getStatus()
    });
  } catch (error) {
    console.error('Error during manual bin health check:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get automatic task service status
app.get('/api/test/automatic-task/status', async (req, res) => {
  try {
    const status = automaticTaskService.getStatus();
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('Error getting automatic task status:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// Get SMS notification service status
app.get('/api/test/sms-service/status', async (req, res) => {
  try {
    const status = smsNotificationService.getHealthStatus();
    res.json({
      success: true,
      service: 'SMS Notification Service',
      status: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// SMS health check endpoint
app.get('/api/sms/health', async (req, res) => {
  try {
    const healthCheck = await smsNotificationService.performHealthCheck();
    res.json({
      success: true,
      health: healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// SMS statistics endpoint
app.get('/api/sms/stats', async (req, res) => {
  try {
    const healthStatus = smsNotificationService.getHealthStatus();
    res.json({
      success: true,
      statistics: {
        totalSmsSent: healthStatus.totalSmsSent,
        totalSmsFailed: healthStatus.totalSmsFailed,
        successRate: healthStatus.totalSmsSent + healthStatus.totalSmsFailed > 0 
          ? (healthStatus.totalSmsSent / (healthStatus.totalSmsSent + healthStatus.totalSmsFailed) * 100).toFixed(2) + '%'
          : 'N/A',
        consecutiveFailures: healthStatus.consecutiveFailures,
        isHealthy: healthStatus.isHealthy,
        lastHealthCheck: healthStatus.lastHealthCheck,
        lastError: healthStatus.lastError
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Database health check endpoint
app.get('/api/database/health', async (req, res) => {
  try {
    const { rtdb } = require('./models/firebase');
    
    if (!rtdb) {
      return res.json({
        success: false,
        database: 'Realtime Database not initialized',
        timestamp: new Date().toISOString()
      });
    }
    
    // Test database connection
    const testRef = rtdb.ref('.info/connected');
    const snapshot = await testRef.once('value');
    
    res.json({
      success: true,
      database: {
        type: 'Firebase Realtime Database',
        connected: snapshot.val(),
        healthy: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      database: {
        type: 'Firebase Realtime Database',
        healthy: false,
        error: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get GSM service status
app.get('/api/test/gsm-service/status', async (req, res) => {
  try {
    const status = gsmService.getStatus();
    res.json({
      success: true,
      service: 'GSM Service',
      status: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test GSM connection
app.get('/api/test/gsm-connection', async (req, res) => {
  try {
    const result = await gsmService.testConnection();
    res.json({
      success: true,
      message: 'GSM connection test completed',
      result: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test SMS notification endpoint
app.post('/api/test/sms-send', async (req, res) => {
  try {
    const { janitorId, taskData } = req.body;
    
    if (!janitorId) {
      return res.status(400).json({
        success: false,
        message: 'Janitor ID is required'
      });
    }

    const defaultTaskData = {
      binName: 'Test Bin',
      binLocation: 'Test Location',
      binLevel: 85,
      weight: 50,
      height: 75,
      coordinates: { latitude: 10.2105, longitude: 123.7583 },
      taskNotes: 'This is a test SMS notification',
      assignedBy: 'Test Staff'
    };

    const result = await smsNotificationService.sendManualTaskSMS(
      taskData || defaultTaskData, 
      janitorId
    );

    res.json({
      success: true,
      message: 'SMS test completed',
      result: result
    });

  } catch (error) {
    console.error('[SMS TEST] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Direct SMS test endpoint (bypasses janitor lookup)
app.post('/api/test/sms-direct', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and message are required'
      });
    }

    console.log(`[SMS DIRECT TEST] Sending SMS to ${phoneNumber}`);
    
    const result = await gsmService.sendSMSWithFallback(phoneNumber, message);

    res.json({
      success: true,
      message: 'Direct SMS test completed',
      result: result
    });

  } catch (error) {
    console.error('[SMS DIRECT TEST] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// bin1 endpoint moved to binRoutes.js

// Helper function to determine bin status
function getBinStatus(level) {
  if (level >= 85) return 'critical';
  if (level >= 70) return 'warning';
  return 'normal';
}

// Test endpoint
app.get('/api/test-locations', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

// New API endpoint for dynamic bin locations
app.get('/api/bin-locations', async (req, res) => {
  console.log('[API] bin-locations endpoint called');
  try {
    const [dataSnapshot, bin1Snapshot] = await Promise.all([
      dataRef.once('value'),
      bin1Ref.once('value')
    ]);
    
    const data = dataSnapshot.val();
    const bin1Data = bin1Snapshot.val();
    
    const binLocations = [];
    
    // Add monitoring/data bin if it has valid coordinates
    if (data && data.latitude && data.longitude && data.latitude !== 0 && data.longitude !== 0) {
      binLocations.push({
        id: 'monitoring-data',
        name: 'S1Bin3',
        position: [parseFloat(data.latitude), parseFloat(data.longitude)],
        level: parseFloat(data.bin_level) || 0,
        status: getBinStatus(parseFloat(data.bin_level) || 0),
        lastCollection: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
        route: 'Route A - Central',
        gps_valid: Boolean(data.gps_valid),
        satellites: parseInt(data.satellites) || 0
      });
    }
    
    // Add monitoring/bin1 bin if it has valid coordinates
    if (bin1Data && bin1Data.latitude && bin1Data.longitude && bin1Data.latitude !== 0 && bin1Data.longitude !== 0) {
      binLocations.push({
        id: 'monitoring-bin1',
        name: 'Central Plaza',
        position: [parseFloat(bin1Data.latitude), parseFloat(bin1Data.longitude)],
        level: parseFloat(bin1Data.bin_level) || 0,
        status: getBinStatus(parseFloat(bin1Data.bin_level) || 0),
        lastCollection: bin1Data.timestamp ? new Date(bin1Data.timestamp).toISOString() : new Date().toISOString(),
        route: 'Route A - Central',
        gps_valid: Boolean(bin1Data.gps_valid),
        satellites: parseInt(bin1Data.satellites) || 0
      });
    }
    
    console.log(`[API] Serving ${binLocations.length} dynamic bin locations`);
    res.json({
      bins: binLocations,
      center: binLocations.length > 0 ? binLocations[0].position : [10.2105, 123.7583],
      totalBins: binLocations.length,
      lastUpdate: new Date().toISOString()
    });
  } catch (err) {
    console.error('[API] Error fetching bin locations:', err);
    res.status(500).json({ error: 'Failed to fetch bin locations', details: err.message });
  }
});

app.get('/api/status', async (req, res) => {
  try {
    const [dataSnapshot, bin1Snapshot] = await Promise.all([
      dataRef.once('value'),
      bin1Ref.once('value')
    ]);
    
    const data = dataSnapshot.val();
    const bin1Data = bin1Snapshot.val();
    
    res.json({
      timestamp: new Date().toISOString(),
      monitoring_data: data,
      bin1_data: bin1Data,
      server_status: 'running'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status', details: err.message });
  }
});





// Firebase quota status
app.get('/api/quota-status', (req, res) => {
  const timeSinceReset = Date.now() - lastQuotaReset;
  const hoursSinceReset = Math.floor(timeSinceReset / (1000 * 60 * 60));
  
  res.json({
    firebaseOperations: firebaseOperationsCount,
    hoursSinceReset: hoursSinceReset,
    quotaResetIn: Math.max(0, 24 - hoursSinceReset),
    status: firebaseOperationsCount > 15000 ? 'WARNING' : 'OK',
    recommendations: [
      'Check Firebase Console for exact usage',
      'Consider upgrading to Blaze plan if needed',
      'Database writes are now optimized for critical levels only'
    ]
  });
});

// Note: The /api/bin-history endpoint is now handled by binHistoryRoutes
// which uses the binHistoryController.getAllBinHistory method

// Test endpoint to update coordinates for testing
app.post('/api/test-coordinates', async (req, res) => {
  try {
    const { latitude, longitude, binId = 'bin1' } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ 
        error: 'latitude and longitude are required',
        example: { latitude: 10.2105, longitude: 123.7583, binId: 'bin1' }
      });
    }

    const targetRef = binId === 'bin1' ? bin1Ref : dataRef;
    
    // Update coordinates in Firebase
    await targetRef.update({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      gps_valid: true,
      satellites: 8,
      timestamp: Date.now()
    });

    console.log(`[TEST COORDINATES] Updated ${binId} coordinates to: ${latitude}, ${longitude}`);
    
    res.json({
      success: true,
      message: `Updated ${binId} coordinates successfully`,
      coordinates: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        gps_valid: true,
        satellites: 8
      },
      binId: binId
    });
  } catch (err) {
    console.error('[TEST COORDINATES] Error updating coordinates:', err);
    res.status(500).json({ 
      error: 'Failed to update coordinates', 
      details: err.message 
    });
  }
});

// Start HTTP server immediately
const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server accessible at:`);
  console.log(`  - http://localhost:${PORT}`);
  console.log(`  - http://192.168.1.2:${PORT}`);
  console.log(`  - http://0.0.0.0:${PORT}`);

  // Start bin health monitoring system
  console.log('[SERVER] Starting bin health monitoring system...');
  binHealthMonitor.start();
  
  // Start backup scheduler
  console.log('[SERVER] Starting backup scheduler...');
  backupScheduler.start();
  console.log('✅ Backup scheduler started');
  
  // Initialize GPS backup service
  await gpsBackupService.initialize();
  console.log('✅ GPS backup service initialized');
  
  // Initialize SMS notification service
  await smsNotificationService.initialize();
  console.log('✅ SMS notification service initialized');
  
  // Start real-time monitoring
  setupRealTimeMonitoring();
  console.log('✅ Real-time monitoring started');
});

