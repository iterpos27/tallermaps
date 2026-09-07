const db = require('../db');
const { transaction, rejectRequest } = require('../services/transactions');
const { normalizeDate } = require('../utils/validation');
const { sellerCanAccessWorkshop } = require('../services/sectorAccess');

const TRANSITIONS = {
  PENDIENTE: ['EN_CAMINO', 'REPROGRAMADA', 'CANCELADA'],
  EN_CAMINO: ['PENDIENTE', 'INICIADA', 'FALLIDA', 'REPROGRAMADA', 'CANCELADA'],
  INICIADA: ['FALLIDA', 'REPROGRAMADA', 'CANCELADA'],
  FALLIDA: ['REPROGRAMADA', 'PENDIENTE'], REPROGRAMADA: ['PENDIENTE'],
  EJECUTADA: [], CANCELADA: ['PENDIENTE']
};
const validateSlot = (date, time, duration) => {
  if (!normalizeDate(date) || typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    || !['number', 'string'].includes(typeof duration) || !Number.isInteger(Number(duration)) || Number(duration) < 1 || Number(duration) > 30) {
    throw rejectRequest(400, 'Ingrese una fecha válida, hora y duración entre 1 y 30 minutos.');
  }
  const [hours, minutes] = time.split(':').map(Number);
  if (hours * 60 + minutes + Number(duration) > 1440) throw rejectRequest(400, 'La visita debe finalizar dentro del mismo día.');
};
const checkConflict = async (client, sellerId, date, time, duration, excludedId = null) => {
  const result = await client.query(
    `SELECT id FROM programaciones_visita WHERE vendedor_id = $1 AND fecha_programada = $2
     AND estado <> 'CANCELADA'
     AND (fecha_programada + hora_programada) < ($2::date + $3::time + $4::integer * INTERVAL '1 minute')
     AND (fecha_programada + hora_programada + duracion_minutos * INTERVAL '1 minute') > ($2::date + $3::time)
     AND ($5::integer IS NULL OR id <> $5) LIMIT 1`, [sellerId, date, time, duration, excludedId]
  );
  if (result.rows.length) throw rejectRequest(409, 'La hora seleccionada se cruza con otra visita programada.');
};
const checkText = (value, name) => {
  if (value !== undefined && (typeof value !== 'string' || value.length > 5000)) throw rejectRequest(400, `${name} debe ser texto de hasta 5000 caracteres.`);
};
const sendError = (res, error) => {
  if (!error.status) console.error('Error saving schedule:', error);
  return res.status(error.status || (error.code === '23505' ? 409 : 500)).json({
  error: error.status ? error.message : error.code === '23505' ? 'Ya existe una programación en ese horario. Edite o reactive la existente.' : 'No se pudo guardar la programación.'
  });
};
const saveSchedules = async (req, res, batch) => {
  try {
    const sellerId = req.user.role === 'ADMIN' ? req.body.vendedor_id : req.user.id;
    if (!/^[1-9]\d*$/.test(String(sellerId))) throw rejectRequest(400, 'Seleccione un vendedor válido.');
    const items = batch ? req.body.items : [req.body];
    if (!Array.isArray(items) || !items.length || items.length > 200) throw rejectRequest(400, 'Agregue entre 1 y 200 visitas.');
    const saved = await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(74003, $1::integer)', [sellerId]);
      const seller = await client.query("SELECT id FROM users WHERE id = $1 AND role = 'VENDEDOR' AND is_active = TRUE", [sellerId]);
      if (!seller.rows.length) throw rejectRequest(400, 'El vendedor no está activo.');
      const results = [];
      for (const item of items) {
        if (!item || !/^[1-9]\d*$/.test(String(item.taller_id))) throw rejectRequest(400, 'Seleccione un taller válido.');
        validateSlot(item.fecha_programada, item.hora_programada, item.duracion_minutos);
        checkText(item.observacion, 'La observación');
        if (!await sellerCanAccessWorkshop(client, sellerId, item.taller_id)) throw rejectRequest(403, 'El taller no está disponible para el vendedor.');
        await checkConflict(client, sellerId, item.fecha_programada, item.hora_programada, item.duracion_minutos);
        const result = await client.query(
          `INSERT INTO programaciones_visita (taller_id, vendedor_id, fecha_programada, hora_programada, duracion_minutos, observacion)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [item.taller_id, sellerId, item.fecha_programada, item.hora_programada, item.duracion_minutos, item.observacion?.trim() || null]
        );
        results.push(result.rows[0]);
      }
      return results;
    });
    return res.status(201).json({ message: 'Programación guardada exitosamente.', ...(batch ? { programaciones: saved } : { programacion: saved[0] }) });
  } catch (error) { return sendError(res, error); }
};

const updateProgramacion = async (req, res) => {
  try {
    const { id } = req.params;
    const input = req.body;
    if (!/^[1-9]\d*$/.test(id)) throw rejectRequest(400, 'Identificador de programación inválido.');
    checkText(input.observacion, 'La observación');
    checkText(input.motivo_fallo, 'El motivo');
    if (input.fecha_programada !== undefined && !normalizeDate(input.fecha_programada)) throw rejectRequest(400, 'La fecha programada no es válida.');
    if (input.estado !== undefined && (typeof input.estado !== 'string' || !Object.hasOwn(TRANSITIONS, input.estado.toUpperCase()))) throw rejectRequest(400, 'Estado inválido.');
    const owner = (await db.query('SELECT vendedor_id FROM programaciones_visita WHERE id = $1', [id])).rows[0];
    if (!owner) throw rejectRequest(404, 'Programación no encontrada.');
    if (req.user.role === 'VENDEDOR' && Number(owner.vendedor_id) !== Number(req.user.id)) throw rejectRequest(403, 'No puede modificar una programación de otro vendedor.');
    const saved = await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(74003, $1::integer)', [owner.vendedor_id]);
      const current = (await client.query('SELECT *, fecha_programada::text AS date_text FROM programaciones_visita WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!current) throw rejectRequest(404, 'Programación no encontrada.');
      const state = input.estado?.toUpperCase() || current.estado;
      if (state !== current.estado && (!TRANSITIONS[current.estado].includes(state))) throw rejectRequest(409, `No se puede cambiar de ${current.estado} a ${state}. Las visitas ejecutadas se gestionan desde el registro de visitas.`);
      const failureReason = input.motivo_fallo === undefined ? current.motivo_fallo : input.motivo_fallo;
      if (state === 'FALLIDA' && (!failureReason || failureReason.trim().length < 5)) throw rejectRequest(400, 'Ingrese un motivo de al menos 5 caracteres.');
      const date = input.fecha_programada === undefined ? current.date_text : input.fecha_programada;
      const time = input.hora_programada === undefined ? String(current.hora_programada).slice(0, 5) : input.hora_programada;
      const duration = input.duracion_minutos === undefined ? current.duracion_minutos : input.duracion_minutos;
      validateSlot(date, time, duration);
      if (state !== 'CANCELADA') await checkConflict(client, owner.vendedor_id, date, time, duration, id);
      const result = await client.query(
        `UPDATE programaciones_visita SET fecha_programada=$1, hora_programada=$2, duracion_minutos=$3,
         observacion=$4, estado=$5::text, motivo_fallo=$6,
         iniciada_at=CASE WHEN $5='INICIADA' THEN COALESCE(iniciada_at,CURRENT_TIMESTAMP)
                         WHEN $5='PENDIENTE' THEN NULL ELSE iniciada_at END,
         finalizada_at=CASE WHEN $5 IN ('FALLIDA','REPROGRAMADA','CANCELADA') THEN COALESCE(finalizada_at,CURRENT_TIMESTAMP)
                           WHEN $5='EJECUTADA' THEN finalizada_at ELSE NULL END,
         updated_at=CURRENT_TIMESTAMP WHERE id=$7 RETURNING *`,
        [date, time, duration, input.observacion === undefined ? current.observacion : input.observacion.trim() || null,
          state, state === 'FALLIDA' ? failureReason.trim() : null, id]
      );
      return result.rows[0];
    });
    return res.json({ message: 'Programación actualizada exitosamente.', programacion: saved });
  } catch (error) { return sendError(res, error); }
};

module.exports = {
  createProgramacion: (req, res) => saveSchedules(req, res, false),
  createProgramacionesBatch: (req, res) => saveSchedules(req, res, true),
  updateProgramacion, validateSlot
};
