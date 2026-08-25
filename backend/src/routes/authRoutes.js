const express = require('express');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso. Intente nuevamente en 15 minutos.' }
});

// POST /api/auth/login
router.post('/login', loginLimiter, authController.login);
router.get('/session', authenticateToken, authController.getSession);
router.post('/logout', authController.logout);

module.exports = router;
