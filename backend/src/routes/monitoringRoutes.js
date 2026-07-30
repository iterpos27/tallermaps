const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const monitoringController = require('../controllers/monitoringController');

const router = express.Router();
router.post('/client-errors', authenticateToken, monitoringController.reportClientError);

module.exports = router;
