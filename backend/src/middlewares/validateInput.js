const { normalizeDate } = require('../utils/validation');

const validateInput = (req, res, next) => {
  const body = req.body || {};
  if (Array.isArray(body)) return res.status(400).json({ error: 'Los datos del formulario no son válidos.' });
  for (const field of ['name','nombre','email','username','password','role','tipo','observacion','observaciones','propietario','telefono','direccion','correo','estado','motivo_fallo']) {
    if (body[field] != null && typeof body[field] !== 'string') return res.status(400).json({ error: `El campo ${field} debe ser texto.` });
  }
  for (const field of ['name','nombre','email','propietario','direccion','correo']) {
    if (typeof body[field] === 'string' && body[field].trim().length > 255) return res.status(400).json({ error: `El campo ${field} admite hasta 255 caracteres.` });
  }
  for (const field of ['vendedor_id','taller_id','programacion_id','sector_id','vendedor_asignado_id']) {
    const value = body[field] ?? req.query[field];
    if (value != null && value !== '' && (!/^[1-9]\d*$/.test(String(value)) || Number(value) > 2147483647)) return res.status(400).json({ error: `El campo ${field} no es un identificador válido.` });
  }
  const { fecha_inicio, fecha_fin } = req.query;
  if ((fecha_inicio !== undefined && !normalizeDate(fecha_inicio)) || (fecha_fin !== undefined && !normalizeDate(fecha_fin))
    || (fecha_inicio && fecha_fin && fecha_inicio > fecha_fin)) return res.status(400).json({ error: 'Seleccione un rango de fechas válido, con inicio anterior o igual al fin.' });
  for (const field of ['search','estado']) {
    if (req.query[field] !== undefined && typeof req.query[field] !== 'string') return res.status(400).json({ error: `El filtro ${field} no es válido.` });
  }
  return next();
};
const validateId = (req, res, next, id) => {
  if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) return res.status(400).json({ error: 'Identificador inválido.' });
  return next();
};
module.exports = { validateInput, validateId };
