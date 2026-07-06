const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'tallervisitas_secret_key_2026_ecuador';

/**
 * Controller for handling login requests
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Por favor, proporcione su usuario/correo y contraseña.' 
    });
  }

  try {
    const identifier = email.trim().toLowerCase();
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
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return token and user metadata (excluding password hash)
    return res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ 
      error: 'Ocurrió un error en el servidor al intentar iniciar sesión.' 
    });
  }
};

module.exports = {
  login
};
