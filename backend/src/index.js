const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./db');
const db = require('./db');
const { uploadDir } = require('./services/storage');
const { requestLogger } = require('./middlewares/requestLogger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const railwayOrigin = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : null;
const productionOrigins = railwayOrigin
  ? Array.from(new Set([...allowedOrigins, railwayOrigin]))
  : allowedOrigins;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(requestLogger);

// Enable CORS so the React app can communicate with the backend.
app.use(cors({
  origin: (origin, callback) => {
    if (!isProduction || !origin || productionOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (productionOrigins.length === 0) {
      return callback(null, false);
    }

    return callback(new Error('Origen no permitido por CORS.'));
  }
}));

// Parse incoming JSON payloads
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve uploaded images statically.
const uploadsPath = uploadDir;
app.use('/uploads', express.static(uploadsPath));

// Mount API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/talleres', require('./routes/tallerRoutes'));
app.use('/api/visitas', require('./routes/visitaRoutes'));
app.use('/api/mapa', require('./routes/mapaRoutes'));
app.use('/api/programaciones', require('./routes/programacionRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));
app.use('/api/monitoring', require('./routes/monitoringRoutes'));
app.use('/api/entregas', require('./routes/entregaRoutes'));

// Serve frontend static build files
const frontendBuildPath = process.env.FRONTEND_DIST_DIR || path.resolve(__dirname, '../../frontend/dist');
const frontendIndexPath = path.join(frontendBuildPath, 'index.html');

app.use(express.static(frontendBuildPath, {
  fallthrough: true,
  index: false
}));

app.get('/assets/*', (req, res) => {
  res.status(404).json({ error: 'Asset no encontrado en el build del frontend.' });
});

// Root Endpoint for checking API health
const healthCheck = async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'healthy', database: 'connected', uptimeSeconds: Math.round(process.uptime()), timestamp: new Date() });
  } catch {
    res.status(503).json({ status: 'unhealthy', database: 'unavailable', requestId: req.requestId, timestamp: new Date() });
  }
};
app.get('/api/health', healthCheck);
app.get('/health', healthCheck);

// Fallback all other routes to index.html for React SPA Router
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }

  if (!fs.existsSync(frontendIndexPath)) {
    return res.status(503).json({
      error: 'El build del frontend no esta disponible. Verifique que npm run build haya generado frontend/dist.'
    });
  }

  res.sendFile(frontendIndexPath, (err) => {
    if (err) {
      next();
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);
  res.status(500).json({ 
    error: isProduction ? 'Ocurrió un error inesperado en el servidor.' : (err.message || 'Ocurrió un error inesperado en el servidor.'),
    requestId: req.requestId
  });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log("Initializing database connection...");
    await initDatabase();
    console.log("Database initialized successfully.");

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Static file uploads folder served from ${uploadsPath}`);
      console.log(`Frontend build served from ${frontendBuildPath}`);
    });
  } catch (error) {
    console.error("Critical: Failed to start the server due to database error:", error);
    process.exit(1);
  }
}

startServer();
