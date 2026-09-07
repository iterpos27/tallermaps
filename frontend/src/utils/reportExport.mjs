export function weekRange(day) {
  const date = new Date(`${day}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return { fecha_inicio: '', fecha_fin: '' };
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  const fecha_inicio = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  return { fecha_inicio, fecha_fin: date.toISOString().slice(0, 10) };
}

export function reportCsv(rows) {
  const cell = (value) => {
    let text = String(value ?? '');
    // Prevent user-entered values from being interpreted as spreadsheet formulas.
    if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [
    ['Tipo', 'ID taller', 'Taller', 'Observaciones', 'Fecha y hora (Ecuador)', 'Vendedor / creador', 'Resultado', 'Compromisos'],
    ...rows.map(row => [row.tipo === 'VISITA' ? 'Taller visitado' : 'Taller creado', row.taller_id,
      row.taller, row.observaciones, row.fecha, row.responsable || 'Sin registro', row.resultado, row.compromisos])
  ].map(row => row.map(cell).join(';')).join('\r\n');
}
