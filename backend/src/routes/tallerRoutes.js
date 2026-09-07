const { validateInput, validateId } = require('../middlewares/validateInput');
const express = require('express');
const router = express.Router();
const tallerController = require('../controllers/tallerController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

// Protect all workshop routes
router.use(authenticateToken);
router.use(validateInput);
router.param('id', validateId);

// GET /api/talleres
router.get('/', tallerController.getTalleres);

// POST /api/talleres
router.post('/', tallerController.createTaller);

// GET /api/talleres/:id
router.get('/:id', tallerController.getTallerById);

// PUT /api/talleres/:id (Only ADMIN can edit workshop details)
router.put('/:id', authorizeRoles('ADMIN'), tallerController.updateTaller);

// DELETE /api/talleres/:id (Only ADMIN can permanently delete a workshop)
router.delete('/:id', authorizeRoles('ADMIN'), tallerController.deleteTaller);

// POST /api/talleres/:id/restore (Only ADMIN can restore an archived workshop)
router.post('/:id/restore', authorizeRoles('ADMIN'), tallerController.restoreTaller);

// GET /api/talleres/:id/visitas (List visits history for a single workshop)
router.get('/:id/visitas', authorizeRoles(['ADMIN', 'VENDEDOR']), tallerController.getTallerVisitas);

module.exports = router;
