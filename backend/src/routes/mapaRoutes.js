const express = require('express');
const router = express.Router();
const mapaController = require('../controllers/mapaController');
const { authenticateToken } = require('../middlewares/auth');

// Protect all map routes
router.use(authenticateToken);

// GET /api/mapa/talleres
router.get('/talleres', mapaController.getTalleresMapa);

module.exports = router;
