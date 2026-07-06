const db = require('../db');
const bcrypt = require('bcryptjs');

/**
 * Get all users (ADMIN only)
 */
const getUsers = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, username, role, is_active, created_at FROM users ORDER BY name ASC'
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ 
      error: 'Error al obtener el listado de usuarios.' 
    });
  }
};

/**
 * Create a new user (ADMIN only)
 */
const createUser = async (req, res) => {
  const { name, email, username, password, role } = req.body;

  // Validation
  if (!name || !email || !password || !role) {
    return res.status(400).json({ 
      error: 'Todos los campos son obligatorios: nombre, correo, contraseña y rol.' 
    });
  }

  const normalizedRole = role.toUpperCase();
  if (normalizedRole !== 'ADMIN' && normalizedRole !== 'VENDEDOR') {
    return res.status(400).json({ 
      error: 'El rol debe ser ADMIN o VENDEDOR.' 
    });
  }

  try {
    // Check if email already exists
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = $1', 
      [email.toLowerCase().trim()]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'El correo electrónico ya está registrado.' 
      });
    }

    // Resolve username (fallback to email prefix if not supplied)
    let finalUsername = username ? username.toLowerCase().trim() : email.split('@')[0].toLowerCase().trim();
    
    // Check if username already exists
    const usernameCheck = await db.query(
      'SELECT id FROM users WHERE username = $1', 
      [finalUsername]
    );

    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'El nombre de usuario ya está registrado.' 
      });
    }

    // Encrypt password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (name, email, username, password_hash, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, username, role, created_at`,
      [name.trim(), email.toLowerCase().trim(), finalUsername, passwordHash, normalizedRole]
    );

    return res.status(201).json({
      message: 'Usuario creado exitosamente.',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ 
      error: 'Error al crear el usuario.' 
    });
  }
};

/**
 * Change a user's password (ADMIN only)
 */
const changePassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.trim().length < 4) {
    return res.status(400).json({ 
      error: 'La nueva contraseña debe tener al menos 4 caracteres.' 
    });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, name, email, username',
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    return res.status(200).json({
      message: 'Contraseña actualizada exitosamente.',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json({ 
      error: 'Error al actualizar la contraseña del usuario.' 
    });
  }
};

/**
 * Update a user (ADMIN only)
 */
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, username, role, is_active } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ 
      error: 'El nombre, correo y rol son campos obligatorios.' 
    });
  }

  try {
    // Check if user exists
    const checkRes = await db.query('SELECT id FROM users WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Check unique email
    const emailCheck = await db.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email.toLowerCase().trim(), id]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado por otro usuario.' });
    }

    // Resolve username (fallback to email prefix if not supplied)
    let finalUsername = username ? username.toLowerCase().trim() : email.split('@')[0].toLowerCase().trim();

    // Check unique username
    const usernameCheck = await db.query('SELECT id FROM users WHERE username = $1 AND id <> $2', [finalUsername, id]);
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado por otro usuario.' });
    }

    const result = await db.query(
      `UPDATE users 
       SET name = $1, email = $2, username = $3, role = $4, is_active = $5 
       WHERE id = $6 
       RETURNING id, name, email, username, role, is_active, created_at`,
      [name.trim(), email.toLowerCase().trim(), finalUsername, role.toUpperCase(), is_active === undefined ? true : is_active, id]
    );

    return res.status(200).json({
      message: 'Usuario actualizado exitosamente.',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Error al actualizar el usuario.' });
  }
};

module.exports = {
  getUsers,
  createUser,
  changePassword,
  updateUser
};
