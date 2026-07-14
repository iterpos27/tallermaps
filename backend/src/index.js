const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./db');
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
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically.
const uploadsPath = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Mount API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/talleres', require('./routes/tallerRoutes'));
app.use('/api/visitas', require('./routes/visitaRoutes'));
app.use('/api/mapa', require('./routes/mapaRoutes'));
app.use('/api/programaciones', require('./routes/programacionRoutes'));

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
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

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
    error: err.message || 'Ocurrió un error inesperado en el servidor.' 
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
