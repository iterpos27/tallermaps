const { transaction, rejectRequest } = require('../services/transactions');
const { validateWorkshopLocation, distanceMeters } = require('../services/workshopGeofence');
const { sellerCanAccessWorkshop } = require('../services/sectorAccess');
const { storageService } = require('../services/storage');
const { isValidLatitude, isValidLongitude, isValidObservation, businessDate } = require('../utils/validation');

module.exports = async (req, res) => {
  const { taller_id, taller_nombre, latitud, longitud, observacion, programacion_id, client_request_id, captured_at } = req.body;
  const sellerId = req.user.id;
  const file = req.file;
  let committed = false;
  let replayed = false;
  let preservePhoto = false;
  try {
    if (req.user.role !== 'VENDEDOR') throw rejectRequest(403, 'Solo los vendedores pueden registrar visitas.');
    if (Number(req.body.owner_id) !== Number(sellerId)) throw rejectRequest(403, 'La visita pertenece a otro usuario. Inicie sesión con el usuario que la capturó.');
    if (!file) throw rejectRequest(400, 'La foto de la visita es requerida.');
    if (!isValidObservation(observacion)) throw rejectRequest(400, 'Las observaciones deben tener al menos 10 caracteres.');
    if (!isValidLatitude(latitud) || !isValidLongitude(longitud)) throw rejectRequest(400, 'Las coordenadas GPS no son válidas.');
    if (typeof client_request_id !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(client_request_id)) {
      throw rejectRequest(400, 'Falta el identificador de la visita. Actualice la página e intente nuevamente.');
    }
    const captured = captured_at === undefined ? new Date() : new Date(captured_at);
    if ((captured_at !== undefined && (typeof captured_at !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(captured_at)))
      || !Number.isFinite(captured.getTime()) || captured.getTime() > Date.now() + 300000) {
      throw rejectRequest(400, 'La fecha de captura no es válida o está en el futuro. Revise el reloj del dispositivo.');
    }
    for (const value of [taller_id, programacion_id]) {
      if (value != null && value !== '' && !/^[1-9]\d*$/.test(String(value))) throw rejectRequest(400, 'El identificador de taller o programación no es válido.');
    }
    const visita = await transaction(async (client) => {
      // Serialize schedule operations for the seller and retries of the same visit.
      await client.query('SELECT pg_advisory_xact_lock(74003, $1::integer)', [sellerId]);
      const previous = await client.query('SELECT * FROM visitas WHERE vendedor_id = $1 AND client_request_id = $2', [sellerId, client_request_id]);
      if (previous.rows.length) {
        replayed = true;
        return previous.rows[0];
      }
      let workshop;
      let isNew = false;
      if (taller_id) {
        if (!await sellerCanAccessWorkshop(client, sellerId, taller_id)) throw rejectRequest(403, 'El taller no está disponible para su usuario.');
        workshop = (await client.query("SELECT id, latitud, longitud, radio_geocerca_metros FROM talleres WHERE id = $1 AND tipo = 'TALLER' AND is_active = TRUE", [taller_id])).rows[0];
        if (!workshop) throw rejectRequest(404, 'Taller no encontrado.');
      } else {
        if (typeof taller_nombre !== 'string' || !taller_nombre.trim() || taller_nombre.trim().length > 255) throw rejectRequest(400, 'Ingrese un nombre de taller de hasta 255 caracteres.');
        await validateWorkshopLocation(client, latitud, longitud);
        const existing = await client.query('SELECT id FROM talleres WHERE LOWER(nombre) = LOWER($1)', [taller_nombre.trim()]);
        if (existing.rows.length) throw rejectRequest(409, 'Ya existe un taller con ese nombre. Selecciónelo en talleres existentes.');
        workshop = (await client.query(
          `INSERT INTO talleres (nombre, latitud, longitud, vendedor_asignado_id) VALUES ($1, $2, $3, $4) RETURNING id, latitud, longitud, radio_geocerca_metros`,
          [taller_nombre.trim(), latitud, longitud, sellerId]
        )).rows[0];
        isNew = true;
      }
      let scheduleId = programacion_id || null;
      if (scheduleId) {
        const schedule = (await client.query('SELECT id, taller_id, vendedor_id, estado FROM programaciones_visita WHERE id = $1 FOR UPDATE', [scheduleId])).rows[0];
        if (!schedule) throw rejectRequest(400, 'La programación seleccionada no existe.');
        if (Number(schedule.vendedor_id) !== Number(sellerId)) throw rejectRequest(403, 'La programación pertenece a otro vendedor.');
        if (Number(schedule.taller_id) !== Number(workshop.id)) throw rejectRequest(400, 'La programación no corresponde al taller.');
        if (!['PENDIENTE', 'EN_CAMINO', 'INICIADA'].includes(schedule.estado)) throw rejectRequest(409, 'La programación ya fue finalizada. Seleccione otra programación o registre una visita sin programación.');
      } else {
        const scheduled = await client.query(
          `SELECT id FROM programaciones_visita WHERE taller_id = $1 AND vendedor_id = $2
           AND fecha_programada = $3 AND estado IN ('PENDIENTE', 'EN_CAMINO', 'INICIADA')
           ORDER BY hora_programada, id LIMIT 1 FOR UPDATE`, [workshop.id, sellerId, businessDate(captured)]
        );
        scheduleId = scheduled.rows[0]?.id || null;
      }
      const distance = isNew ? 0 : distanceMeters(workshop.latitud, workshop.longitud, latitud, longitud);
      const photoUrl = await storageService.saveFile(file, req);
      const result = await client.query(
        `INSERT INTO visitas (taller_id, vendedor_id, programacion_id, foto_url, latitud, longitud, observacion,
          fuera_rango, distancia_metros, client_request_id, fecha_visita, captured_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz AT TIME ZONE 'America/Guayaquil',$11::timestamptz) RETURNING *`,
        [workshop.id, sellerId, scheduleId, photoUrl, latitud, longitud, observacion.trim(),
          distance > Number(workshop.radio_geocerca_metros || 100), distance, client_request_id, captured.toISOString()]
      );
      if (scheduleId) await client.query(
        `UPDATE programaciones_visita SET estado = 'EJECUTADA', visita_id = $1,
         finalizada_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [result.rows[0].id, scheduleId]
      );
      return result.rows[0];
    });
    committed = true;
    return res.status(replayed ? 200 : 201).json({ message: replayed ? 'La visita ya estaba registrada.' : 'Visita registrada exitosamente.', visita: { ...visita, fecha_visita: visita.captured_at || visita.fecha_visita } });
  } catch (error) {
    preservePhoto = Boolean(error.commitUncertain);
    if (!error.status) console.error('Error registering visit:', error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo registrar la visita. Puede reintentar sin duplicarla.' });
  } finally {
    if (file && !preservePhoto && (!committed || replayed)) await storageService.deleteFile(`/uploads/${file.filename}`).catch(() => {});
  }
};
