const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');
const auditController = require('../controllers/auditController');

const router = express.Router();
router.use(authenticateToken, authorizeRoles('ADMIN'));
router.get('/', auditController.getActivity);

module.exports = router;
