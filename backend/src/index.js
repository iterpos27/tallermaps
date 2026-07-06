const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS so the React app can communicate with the backend
app.use(cors());

// Parse incoming JSON payloads
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
// Accessible via http://localhost:5000/uploads/<filename>
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Mount API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/talleres', require('./routes/tallerRoutes'));
app.use('/api/visitas', require('./routes/visitaRoutes'));
app.use('/api/mapa', require('./routes/mapaRoutes'));

// Serve frontend static build files
const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendBuildPath));

// Root Endpoint for checking API health
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Fallback all other routes to index.html for React SPA Router
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
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
      console.log(`Static file uploads folder served at http://localhost:${PORT}/uploads`);
    });
  } catch (error) {
    console.error("Critical: Failed to start the server due to database error:", error);
    process.exit(1);
  }
}

startServer();
