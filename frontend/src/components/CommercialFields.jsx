import React from 'react';
export const RESULTS = { SIN_REGISTRO:'Sin registro', INTERESADO:'Interesado', SEGUIMIENTO:'Requiere seguimiento', VENTA:'Venta realizada', NO_INTERESADO:'No interesado' };
export default function CommercialFields({ value, onChange, disabled = false }) {
  const change = (key,val) => onChange({ ...value, [key]:val });
  const required = value.resultado === 'SEGUIMIENTO' || Boolean(value.compromiso || value.proxima_fecha);
  return <fieldset disabled={disabled} style={{ border:0,padding:0,marginBottom:20 }}>
    <legend className="form-label">Resultado y próxima gestión</legend>
    <label className="form-label">Resultado de la visita<select className="form-input" required value={value.resultado || ''} onChange={e=>change('resultado',e.target.value)}>
      <option value="">Seleccione un resultado</option>{Object.entries(RESULTS).filter(([key])=>key!=='SIN_REGISTRO').map(([key,label])=><option value={key} key={key}>{label}</option>)}
      {value.resultado==='SIN_REGISTRO' && <option value="SIN_REGISTRO">Sin registro (visita antigua)</option>}
    </select></label>
    <label className="form-label">Próxima gestión<input className="form-input" type="date" required={required} value={value.proxima_fecha || ''} onChange={e=>change('proxima_fecha',e.target.value)} /></label>
    <label className="form-label">Compromiso<textarea className="form-input" minLength={10} maxLength={2000} required={required} placeholder="Ej. Enviar cotización y confirmar disponibilidad" value={value.compromiso || ''} onChange={e=>change('compromiso',e.target.value)} /></label>
    <p className="field-help">El vendedor de la visita será responsable del compromiso. El seguimiento requiere fecha y descripción.</p>
  </fieldset>;
}
