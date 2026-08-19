const express = require('express');
const controller = require('../controllers/sectorController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticateToken);
router.get('/', controller.getSectores);
router.post('/', authorizeRoles('ADMIN'), controller.createSector);
router.put('/:id', authorizeRoles('ADMIN'), controller.updateSector);

module.exports = router;
