const { validateInput, validateId } = require('../middlewares/validateInput');
const express = require('express');
const router = express.Router();
const programacionController = require('../controllers/programacionController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

router.use(authenticateToken);
router.use(validateInput);
router.param('id', validateId);
router.use(authorizeRoles(['ADMIN', 'VENDEDOR']));

router.get('/', programacionController.getProgramaciones);
router.post('/', programacionController.createProgramacion);
router.post('/batch', programacionController.createProgramacionesBatch);
router.get('/reporte', programacionController.getReporteProgramacion);
router.post('/ruta-hoy/optimizar', programacionController.optimizeTodayRoute);
router.put('/:id', programacionController.updateProgramacion);

module.exports = router;
