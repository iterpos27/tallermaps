const db = require('../db');
const bcrypt = require('bcryptjs');
const {
  isNonEmptyString,
  normalizeEmail,
  isValidEmail,
  validatePassword
} = require('../utils/validation');
const { safeLogActivity } = require('../services/audit');
const { normalizeSectorIds } = require('../services/sectorAccess');

const replaceUserSectors = async (queryable, userId, role, sectorIdsInput) => {
  const sectorIds = role === 'VENDEDOR' ? normalizeSectorIds(sectorIdsInput) : [];
  if (sectorIds.length > 0) {
    const valid = await queryable.query(
      'SELECT id FROM sectores WHERE id = ANY($1::int[]) AND is_active = TRUE',
      [sectorIds]
    );
    if (valid.rows.length !== sectorIds.length) {
      throw new Error('Uno o más sectores seleccionados no están disponibles.');
    }
  }
  await queryable.query('DELETE FROM vendedor_sectores WHERE vendedor_id = $1', [userId]);
  if (sectorIds.length > 0) {
    await queryable.query(
      `INSERT INTO vendedor_sectores (vendedor_id, sector_id)
       SELECT $1, UNNEST($2::int[])`,
      [userId, sectorIds]
    );
  }
  return sectorIds;
};

/**
 * Get all users (ADMIN only)
 */
const getUsers = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id, u.name, u.email, u.username, u.role, u.is_active, u.created_at, u.permissions,
             COALESCE(ARRAY_AGG(s.id ORDER BY s.nombre) FILTER (WHERE s.id IS NOT NULL), '{}') AS sector_ids,
             COALESCE(ARRAY_AGG(s.nombre ORDER BY s.nombre) FILTER (WHERE s.id IS NOT NULL), '{}') AS sectores
      FROM users u
      LEFT JOIN vendedor_sectores vs ON vs.vendedor_id = u.id
      LEFT JOIN sectores s ON s.id = vs.sector_id
      GROUP BY u.id
      ORDER BY u.name ASC
    `);

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
  const { name, email, username, password, role, sector_ids } = req.body;
  let transactionClient;

  // Validation
  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !password || !role) {
    return res.status(400).json({ 
      error: 'Todos los campos son obligatorios: nombre, correo, contraseña y rol.' 
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Ingrese un correo electrónico válido.' });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const normalizedRole = role.toUpperCase();
  if (!['ADMIN', 'VENDEDOR', 'MENSAJERO'].includes(normalizedRole)) {
    return res.status(400).json({ 
      error: 'El rol debe ser ADMIN, VENDEDOR o MENSAJERO.'
    });
  }
  if (normalizedRole === 'VENDEDOR' && normalizeSectorIds(sector_ids).length === 0) {
    return res.status(400).json({ error: 'Asigne al menos un sector al vendedor.' });
  }

  try {
    // Check if email already exists
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = $1', 
      [normalizeEmail(email)]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'El correo electrónico ya está registrado.' 
      });
    }

    // Resolve username (fallback to email prefix if not supplied)
    const finalUsername = username ? username.toLowerCase().trim() : normalizeEmail(email).split('@')[0];

    if (!/^[a-z0-9._-]{3,50}$/.test(finalUsername)) {
      return res.status(400).json({
        error: 'El usuario debe tener entre 3 y 50 caracteres y usar solo letras, números, punto, guion o guion bajo.'
      });
    }
    
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

    transactionClient = await db.pool.connect();
    await transactionClient.query('BEGIN');
    const result = await transactionClient.query(
      `INSERT INTO users (name, email, username, password_hash, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, username, role, created_at`,
      [name.trim(), normalizeEmail(email), finalUsername, passwordHash, normalizedRole]
    );

    const assignedSectorIds = await replaceUserSectors(transactionClient, result.rows[0].id, normalizedRole, sector_ids);
    await transactionClient.query('COMMIT');
    transactionClient.release();
    transactionClient = null;
    result.rows[0].sector_ids = assignedSectorIds;

    await safeLogActivity({
      req,
      action: 'USUARIO_CREADO',
      entityType: 'usuario',
      entityId: result.rows[0].id,
      details: { username: result.rows[0].username, role: result.rows[0].role }
    });

    return res.status(201).json({
      message: 'Usuario creado exitosamente.',
      user: result.rows[0]
    });

  } catch (error) {
    if (transactionClient) {
      await transactionClient.query('ROLLBACK');
      transactionClient.release();
    }
    if (error.message.includes('sectores seleccionados')) {
      return res.status(400).json({ error: error.message });
    }
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

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(
      'UPDATE users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2 RETURNING id, name, email, username',
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    await safeLogActivity({
      req,
      action: 'CONTRASENA_ACTUALIZADA',
      entityType: 'usuario',
      entityId: result.rows[0].id,
      details: { username: result.rows[0].username }
    });

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
  const { name, email, username, role, is_active, sector_ids } = req.body;
  let transactionClient;

  if (is_active !== undefined && typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'El estado activo debe ser verdadero o falso.' });
  }

  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !role) {
    return res.status(400).json({ 
      error: 'El nombre, correo y rol son campos obligatorios.' 
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Ingrese un correo electrónico válido.' });
  }

  const normalizedRole = role.toUpperCase();
  if (!['ADMIN', 'VENDEDOR', 'MENSAJERO'].includes(normalizedRole)) {
    return res.status(400).json({ error: 'El rol debe ser ADMIN, VENDEDOR o MENSAJERO.' });
  }
  if (normalizedRole === 'VENDEDOR' && is_active !== false && normalizeSectorIds(sector_ids).length === 0) {
    return res.status(400).json({ error: 'Asigne al menos un sector al vendedor.' });
  }

  try {
    // Check if user exists
    const checkRes = await db.query('SELECT id FROM users WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Check unique email
    const emailCheck = await db.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [normalizeEmail(email), id]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado por otro usuario.' });
    }

    // Resolve username (fallback to email prefix if not supplied)
    const finalUsername = username ? username.toLowerCase().trim() : normalizeEmail(email).split('@')[0];

    if (!/^[a-z0-9._-]{3,50}$/.test(finalUsername)) {
      return res.status(400).json({
        error: 'El usuario debe tener entre 3 y 50 caracteres y usar solo letras, números, punto, guion o guion bajo.'
      });
    }

    // Check unique username
    const usernameCheck = await db.query('SELECT id FROM users WHERE username = $1 AND id <> $2', [finalUsername, id]);
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado por otro usuario.' });
    }

    transactionClient = await db.pool.connect();
    await transactionClient.query('BEGIN');
    await transactionClient.query('SELECT pg_advisory_xact_lock(74002)');
    const currentUser = (await transactionClient.query('SELECT role, is_active FROM users WHERE id = $1 FOR UPDATE', [id])).rows[0];
    const nextActive = is_active === undefined ? currentUser.is_active : is_active;
    if (currentUser.role === 'ADMIN' && currentUser.is_active && (normalizedRole !== 'ADMIN' || !nextActive)) {
      const otherAdmins = await transactionClient.query("SELECT id FROM users WHERE role = 'ADMIN' AND is_active = TRUE AND id <> $1", [id]);
      if (!otherAdmins.rows.length) {
        await transactionClient.query('ROLLBACK');
        transactionClient.release();
        transactionClient = null;
        return res.status(409).json({ error: 'Debe conservar al menos un administrador activo.' });
      }
    }
    const result = await transactionClient.query(
      `UPDATE users 
       SET name = $1, email = $2, username = $3, role = $4::text, is_active = $5::boolean,
           permissions = CASE WHEN role <> $4 THEN '{}'::jsonb ELSE permissions END,
           session_version = session_version + CASE WHEN role <> $4 OR is_active <> $5 THEN 1 ELSE 0 END
       WHERE id = $6 
       RETURNING id, name, email, username, role, is_active, created_at`,
      [name.trim(), normalizeEmail(email), finalUsername, normalizedRole, nextActive, id]
    );

    const assignedSectorIds = await replaceUserSectors(transactionClient, id, normalizedRole, sector_ids);
    await transactionClient.query('COMMIT');
    transactionClient.release();
    transactionClient = null;
    result.rows[0].sector_ids = assignedSectorIds;

    await safeLogActivity({
      req,
      action: 'USUARIO_ACTUALIZADO',
      entityType: 'usuario',
      entityId: result.rows[0].id,
      details: { username: result.rows[0].username, role: result.rows[0].role, is_active: result.rows[0].is_active }
    });

    return res.status(200).json({
      message: 'Usuario actualizado exitosamente.',
      user: result.rows[0]
    });
  } catch (error) {
    if (transactionClient) {
      await transactionClient.query('ROLLBACK');
      transactionClient.release();
    }
    if (error.message.includes('sectores seleccionados')) {
      return res.status(400).json({ error: error.message });
    }
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
