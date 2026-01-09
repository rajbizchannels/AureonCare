require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'medflow_app',
  password: 'MedFlow2024!',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Explicitly set search_path to ensure tables are found
  options: '-c search_path=public',
});

// Make pool available to routes
app.locals.pool = pool;

// Redis connection - disabled for development
// Redis is optional and not required for core functionality
let redisClient = null;

// Uncomment below to enable Redis
/*
const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    reconnectStrategy: () => false
  }
};

if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

redisClient = redis.createClient(redisConfig);
redisClient.on('error', (err) => console.log('Redis Error:', err.message));
redisClient.on('connect', () => console.log('✓ Redis Connected'));
*/

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    let redisStatus = 'not configured';
    if (redisClient) {
      try {
        await redisClient.ping();
        redisStatus = 'connected';
      } catch (err) {
        redisStatus = 'disconnected';
      }
    }
    res.json({
      status: 'healthy',
      database: 'connected',
      redis: redisStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// API routes
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'MedFlow API is running!',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Import and use routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/appointment-types', require('./routes/appointment-types'));
app.use('/api/waitlist', require('./routes/waitlist'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/claims', require('./routes/claims'));
app.use('/api/preapprovals', require('./routes/preapprovals'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/payment-postings', require('./routes/payment-postings'));
app.use('/api/denials', require('./routes/denials'));
app.use('/api/edi', require('./routes/edi'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/users', require('./routes/users'));
app.use('/api/providers', require('./routes/providers'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/telehealth', require('./routes/telehealth'));
app.use('/api/telehealth-settings', require('./routes/telehealthSettings'));
app.use('/api/vendor-integration-settings', require('./routes/vendorIntegrationSettings'));
app.use('/api/integrations/oauth', require('./routes/integrationOAuth'));
app.use('/api/backup-providers', require('./routes/backupProviders'));
app.use('/api/clinic-settings', require('./routes/clinicSettings'));
app.use('/api/notification-preferences', require('./routes/notificationPreferences'));
app.use('/api/fhir', require('./routes/fhir'));
app.use('/api/fhir-tracking', require('./routes/fhir-tracking'));
app.use('/api/patient-portal', require('./routes/patient-portal'));
app.use('/api/medical-records', require('./routes/medical-records'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/lab-orders', require('./routes/lab-orders'));
app.use('/api/diagnosis', require('./routes/diagnosis'));
app.use('/api/medications', require('./routes/medications'));
app.use('/api/pharmacies', require('./routes/pharmacies'));
app.use('/api/laboratories', require('./routes/laboratories'));
app.use('/api/scheduling', require('./routes/scheduling'));
app.use('/api/offerings', require('./routes/offerings'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/calendar-sync', require('./routes/calendar-sync'));
app.use('/api/medical-codes', require('./routes/medical-codes'));
app.use('/api/insurance-payers', require('./routes/insurance-payers'));
app.use('/api/intake-forms', require('./routes/intake-forms'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/archive', require('./routes/archive'));
app.use('/api/archive-rules', require('./routes/archiveRules'));
app.use('/api/audit', require('./routes/audit'));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
async function startServer() {
  console.log('========================================');
  console.log('MedFlow Backend Server Starting...');
  console.log('========================================');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Port: ${PORT}`);
  console.log(`Database: ${process.env.DB_NAME || 'medflow'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
  console.log('========================================\n');

  try {
    // Test database connection
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✓ Database connected successfully');

    // Try to connect Redis (optional)
    let redisConnected = false;
    if (redisClient) {
      try {
        console.log('Attempting Redis connection...');
        await redisClient.connect();
        console.log('✓ Redis connected');
        redisConnected = true;
      } catch (redisError) {
        console.log('⚠️  Redis not available (continuing without cache)');
        console.log('   Redis error:', redisError.message);
      }
    } else {
      console.log('⚠️  Redis not configured (continuing without cache)');
    }

    // Start Archive Scheduler
    let stopScheduler = null;
    try {
      const { startScheduler } = require('./services/archiveScheduler');
      stopScheduler = startScheduler();
      console.log('✓ Archive scheduler started');
    } catch (schedulerError) {
      console.log('⚠️  Archive scheduler not started:', schedulerError.message);
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`\n=================================`);
      console.log(`🚀 MedFlow Backend Server Running`);
      console.log(`=================================`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`🗄️  Database: ${process.env.DB_NAME}`);
      console.log(`⚡ Redis: ${redisConnected ? 'Connected' : 'Not available'}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=================================\n`);
    });
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ FAILED TO START SERVER');
    console.error('========================================');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n🔴 PostgreSQL Database Connection Failed');
      console.error('   - Make sure PostgreSQL is running');
      console.error('   - Check database credentials in .env file');
      console.error('   - Verify database exists and is accessible');
      console.error(`   - Connection string: ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    }

    console.error('\nFull error stack:');
    console.error(error.stack);
    console.error('========================================\n');
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pool.end();
  if (redisClient) {
    await redisClient.quit();
  }
  process.exit(0);
});