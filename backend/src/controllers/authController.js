const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'tallervisitas_secret_key_2026_ecuador';
const AUTH_COOKIE = 'taller_session';
const AUTH_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio en production.');
}

/**
 * Controller for handling login requests
 */
const login = async (req, res) => {
  const { email, username, usuario, identifier: rawIdentifier, password } = req.body;
  const loginIdentifier = rawIdentifier || usuario || username || email;

  if (!loginIdentifier || !password) {
    return res.status(400).json({ 
      error: 'Por favor, proporcione su usuario/correo y contraseña.' 
    });
  }

  try {
    const identifier = loginIdentifier.trim().toLowerCase();
    // Look up user by email OR username
    const result = await db.query(
      'SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1', 
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas. Verifique el usuario o contraseña.' 
      });
    }

    const user = result.rows[0];

    // Check if user account is active
    if (user.is_active === false) {
      return res.status(403).json({
        error: 'Su cuenta ha sido desactivada. Comuníquese con el administrador.'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas. Verifique el usuario o contraseña.' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        username: user.username,
        role: user.role,
        session_version: user.session_version
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: AUTH_COOKIE_MAX_AGE,
      path: '/'
    });

    // The JWT remains inaccessible to JavaScript; only safe user metadata is returned.
    return res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      }
    });

  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ 
      error: 'Ocurrió un error en el servidor al intentar iniciar sesión.' 
    });
  }
};

const getSession = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, username, role, is_active, permissions
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user || user.is_active === false) {
      res.clearCookie(AUTH_COOKIE, { path: '/' });
      return res.status(401).json({ error: 'La sesión ya no está disponible.' });
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.error('Error restoring session:', error);
    return res.status(500).json({ error: 'No se pudo restaurar la sesión.' });
  }
};

const logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  return res.status(200).json({ message: 'Sesión cerrada exitosamente.' });
};

module.exports = {
  login,
  getSession,
  logout
};
