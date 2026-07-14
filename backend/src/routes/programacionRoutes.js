const express = require('express');
const router = express.Router();
const programacionController = require('../controllers/programacionController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', programacionController.getProgramaciones);
router.post('/', programacionController.createProgramacion);
router.post('/batch', programacionController.createProgramacionesBatch);
router.get('/reporte', programacionController.getReporteProgramacion);
router.put('/:id', programacionController.updateProgramacion);

module.exports = router;
