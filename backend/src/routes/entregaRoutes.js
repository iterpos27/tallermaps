const { requirePermission } = require('../services/permissions');
const express = require('express');
const entregaController = require('../controllers/entregaController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticateToken, requirePermission('delivery'));

router.post('/position', authorizeRoles('MENSAJERO'), requirePermission('delivery'), entregaController.registerPosition);
router.post('/complete', authorizeRoles('MENSAJERO'), entregaController.completeDelivery);
router.post('/cancel', authorizeRoles('MENSAJERO'), entregaController.cancelDelivery);
router.get('/status', authorizeRoles('MENSAJERO'), entregaController.getStatus);
router.get('/', authorizeRoles('ADMIN'), entregaController.listDeliveries);

module.exports = router;
