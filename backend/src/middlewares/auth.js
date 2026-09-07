const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'tallervisitas_secret_key_2026_ecuador';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio en production.');
}

/**
 * Middleware to authenticate requests using JWT
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.split(' ')[1];
  const cookieHeader = req.headers.cookie || '';
  const sessionCookie = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('taller_session='));
  const cookieToken = sessionCookie ? sessionCookie.slice('taller_session='.length) : null;
  // Bearer tokens remain supported for non-browser API clients.
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ 
      error: 'Acceso denegado. Token no proporcionado.' 
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(decodeURIComponent(token), JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      error: 'Token inválido o expirado.' 
    });
  }
  try {
    const result = await db.query('SELECT id, name, email, username, role, is_active, session_version FROM users WHERE id = $1', [decoded.id]);
    const user = result.rows[0];
    if (!user || !user.is_active || Number(decoded.session_version || 0) !== Number(user.session_version)) {
      return res.status(401).json({ error: 'La sesión ya no está disponible. Inicie sesión nuevamente.' });
    }
    req.user = user;
    return next();
  } catch (error) {
    return res.status(503).json({ error: 'No se pudo verificar la sesión. Intente nuevamente.' });
  }
};

/**
 * Middleware to restrict access based on roles
 * @param {string|string[]} roles - Allowed role or array of allowed roles
 */
const authorizeRoles = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Acceso no autorizado. Se requiere rol: ${allowedRoles.join(' o ')}.` 
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles
};
