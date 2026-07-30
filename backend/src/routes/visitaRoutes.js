const express = require('express');
const router = express.Router();
const visitaController = require('../controllers/visitaController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');
const { upload } = require('../services/storage');

// Protect all visits routes
router.use(authenticateToken);

// GET /api/visitas
router.get('/', visitaController.getVisitas);

// POST /api/visitas (accepts multi-part form data with field 'foto')
router.post('/', upload.single('foto'), visitaController.createVisita);

// DELETE /api/visitas/:id (only administrators can permanently delete visits)
router.delete('/:id', authorizeRoles('ADMIN'), visitaController.deleteVisita);

// GET /api/visitas/:id
router.get('/:id', visitaController.getVisitaById);

module.exports = router;
