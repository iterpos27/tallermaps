const { validateInput, validateId } = require('../middlewares/validateInput');
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

// Protect all user routes, only allow ADMIN
router.use(authenticateToken);
router.use(validateInput);
router.param('id', validateId);
router.use(authorizeRoles('ADMIN'));

router.put('/:id/permissions', async (req, res) => {
  const { transaction, rejectRequest } = require('../services/transactions');
  const { validatePermissions } = require('../services/permissions');
  try {
    const result = await transaction(async client => {
      const user = (await client.query('SELECT role, permissions FROM users WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
      if (!user) throw rejectRequest(404, 'Usuario no encontrado.');
      if (user.role === 'ADMIN') throw rejectRequest(400, 'El administrador conserva acceso completo.');
      let permissions;
      try { permissions = validatePermissions(user.role, req.body.permissions); }
      catch(e) { throw rejectRequest(400, e.message); }
      await client.query('UPDATE users SET permissions=$1, session_version=session_version+1 WHERE id=$2', [JSON.stringify(permissions), req.params.id]);
      return { permissions, previous: user.permissions };
    });
    await require('../services/audit').safeLogActivity({req, action:'PERMISOS_ACTUALIZADOS', entityType:'usuario', entityId:Number(req.params.id), details:{before:result.previous,after:result.permissions}});
    res.json({permissions:result.permissions});
  } catch(e) { res.status(e.status || 500).json({error:e.status ? e.message : 'No se pudieron guardar los permisos.'}); }
});

// GET /api/users
router.get('/', userController.getUsers);

// POST /api/users
router.post('/', userController.createUser);

// PUT /api/users/:id/password
router.put('/:id/password', userController.changePassword);

// PUT /api/users/:id
router.put('/:id', userController.updateUser);

module.exports = router;
