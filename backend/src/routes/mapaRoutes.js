const { requirePermission } = require('../services/permissions');
const express = require('express');
const router = express.Router();
const mapaController = require('../controllers/mapaController');
const { authenticateToken } = require('../middlewares/auth');

// Protect all map routes
router.use(authenticateToken, requirePermission('map'));

// GET /api/mapa/puntos
router.get('/puntos', mapaController.getPuntosMapa);
// Backward-compatible alias for older frontend builds.
router.get('/talleres', mapaController.getPuntosMapa);

// POST /api/mapa/ruta
router.post('/ruta', mapaController.getRuta);

module.exports = router;
