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
  user: process.env.DB_USER || 'medflow_user',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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
app.use('/api/patients', require('./routes/patients'));
app.use('/api/claims', require('./routes/claims'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/users', require('./routes/users'));
app.use('/api/providers', require('./routes/providers'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/telehealth', require('./routes/telehealth'));
app.use('/api/fhir', require('./routes/fhir'));
app.use('/api/patient-portal', require('./routes/patient-portal'));
app.use('/api/medical-records', require('./routes/medical-records'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/diagnosis', require('./routes/diagnosis'));
app.use('/api/medications', require('./routes/medications'));
app.use('/api/pharmacies', require('./routes/pharmacies'));
app.use('/api/scheduling', require('./routes/scheduling'));
app.use('/api/offerings', require('./routes/offerings'));

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
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✓ Database connected');

    // Try to connect Redis (optional)
    let redisConnected = false;
    if (redisClient) {
      try {
        await redisClient.connect();
        console.log('✓ Redis connected');
        redisConnected = true;
      } catch (redisError) {
        console.log('⚠️  Redis not available (continuing without cache)');
      }
    } else {
      console.log('⚠️  Redis not configured (continuing without cache)');
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
    console.error('Failed to start server:', error);
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