const { requirePermission } = require('../services/permissions');
const { validateInput, validateId } = require('../middlewares/validateInput');
const express = require('express');
const router = express.Router();
const programacionController = require('../controllers/programacionController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

router.use(authenticateToken);
router.use(validateInput);
router.param('id', validateId);
router.use(authorizeRoles(['ADMIN', 'VENDEDOR']));

router.get('/', requirePermission('route','schedule','register'), programacionController.getProgramaciones);
router.post('/', requirePermission('schedule'), programacionController.createProgramacion);
router.post('/batch', requirePermission('schedule'), programacionController.createProgramacionesBatch);
router.get('/reporte', authorizeRoles('ADMIN'), programacionController.getReporteProgramacion);
router.post('/ruta-hoy/optimizar', authorizeRoles('ADMIN'), programacionController.optimizeTodayRoute);
router.put('/:id', authorizeRoles('ADMIN'), programacionController.updateProgramacion);

module.exports = router;
