const { normalizeDate, businessDate } = require('../utils/validation');
const { rejectRequest } = require('./transactions');
function validateCommercial(body, captured) {
  const resultado = body.resultado || 'SIN_REGISTRO';
  if (!['SIN_REGISTRO','INTERESADO','SEGUIMIENTO','VENTA','NO_INTERESADO'].includes(resultado)) throw rejectRequest(400, 'Seleccione un resultado válido.');
  const fecha = body.proxima_fecha || null;
  const descripcion = body.compromiso || '';
  if (typeof descripcion !== 'string' || descripcion.length > 2000) throw rejectRequest(400, 'El compromiso admite hasta 2000 caracteres.');
  if (fecha || descripcion || resultado === 'SEGUIMIENTO') {
    if (!normalizeDate(fecha) || fecha < businessDate(captured) || descripcion.trim().length < 10) {
      throw rejectRequest(400, 'Indique un compromiso de al menos 10 caracteres y una fecha igual o posterior a la visita.');
    }
  }
  return { resultado, fecha, descripcion: descripcion.trim() };
}
module.exports = { validateCommercial };
