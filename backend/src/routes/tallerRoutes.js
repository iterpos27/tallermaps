const express = require('express');
const router = express.Router();
const tallerController = require('../controllers/tallerController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

// Protect all workshop routes
router.use(authenticateToken);

// GET /api/talleres
router.get('/', tallerController.getTalleres);

// POST /api/talleres
router.post('/', tallerController.createTaller);

// GET /api/talleres/:id
router.get('/:id', tallerController.getTallerById);

// PUT /api/talleres/:id (Only ADMIN can edit workshop details)
router.put('/:id', authorizeRoles('ADMIN'), tallerController.updateTaller);

// GET /api/talleres/:id/visitas (List visits history for a single workshop)
router.get('/:id/visitas', tallerController.getTallerVisitas);

module.exports = router;
