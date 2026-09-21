const DEFAULTS = {
  VENDEDOR: { route: true, schedule: true, register: true, history: true, offline: true, map: false },
  MENSAJERO: { delivery: true }
};
function effectivePermissions(user) {
  const defaults = DEFAULTS[user?.role] || {};
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, typeof user.permissions?.[key] === 'boolean' ? user.permissions[key] : value]));
}
function can(user, permission) {
  return user?.role === 'ADMIN' || effectivePermissions(user)[permission] === true;
}
function validatePermissions(role, input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('Los permisos deben ser un objeto de opciones.');
  const allowed = DEFAULTS[role] || {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(allowed, key) || typeof value !== 'boolean') throw new Error('Permiso inválido para el rol seleccionado.');
  }
  return { ...allowed, ...input };
}
const requirePermission = (...permissions) => (req, res, next) => {
  if (permissions.some(permission => can(req.user, permission))) return next();
  return res.status(403).json({ error: 'El administrador no ha habilitado esta opción para su usuario.' });
};
module.exports = { DEFAULTS, effectivePermissions, can, validatePermissions, requirePermission };
