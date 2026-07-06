const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

// Protect all user routes, only allow ADMIN
router.use(authenticateToken);
router.use(authorizeRoles('ADMIN'));

// GET /api/users
router.get('/', userController.getUsers);

// POST /api/users
router.post('/', userController.createUser);

// PUT /api/users/:id/password
router.put('/:id/password', userController.changePassword);

// PUT /api/users/:id
router.put('/:id', userController.updateUser);

module.exports = router;
