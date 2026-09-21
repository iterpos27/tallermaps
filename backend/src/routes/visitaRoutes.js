const { requirePermission } = require('../services/permissions');
const { validateInput, validateId } = require('../middlewares/validateInput');
const express = require('express');
const router = express.Router();
const visitaController = require('../controllers/visitaController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');
const { upload } = require('../services/storage');

// Protect all visits routes
router.use(authenticateToken);
router.use(validateInput);
router.param('id', validateId);
router.use(authorizeRoles(['ADMIN', 'VENDEDOR']));

// GET /api/visitas
router.get('/', requirePermission('history'), visitaController.getVisitas);
router.get('/reporte', authorizeRoles('ADMIN'), require('../controllers/reportController'));

// POST /api/visitas (accepts multi-part form data with field 'foto')
router.post('/', authorizeRoles('VENDEDOR'), requirePermission('register'), upload.single('foto'), visitaController.createVisita);

// PUT /api/visitas/:id/fecha (seller can edit only their own visit)
router.put('/:id/fecha', authorizeRoles('ADMIN'), visitaController.updateVisitaDateTime);

// DELETE /api/visitas/:id (seller can delete only their own visit)
router.delete('/:id', authorizeRoles('ADMIN'), visitaController.deleteVisita);

// GET /api/visitas/:id
router.get('/:id', requirePermission('history'), visitaController.getVisitaById);

module.exports = router;
