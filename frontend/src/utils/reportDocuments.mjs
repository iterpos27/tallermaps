const titles = ['Actividad','Taller','Fecha (Ecuador)','Responsable','Resultado','Observaciones','Compromisos'];
const values = row => [row.tipo==='VISITA'?'Visita':'Creación',row.taller,row.fecha,row.responsable||'Sin registro',row.resultado||'',row.observaciones||'',row.compromisos||''];
export async function reportWorkbook(rows,filters,metrics=[]) {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  book.creator='TallerVisitas Pro';
  const sheet=book.addWorksheet('Actividad');
  sheet.addRow(['TallerVisitas Pro — Reporte comercial']);
  sheet.addRow([`Del ${filters.fecha_inicio} al ${filters.fecha_fin} · ${filters.responsable_nombre || 'Todos los responsables'}`]);
  sheet.addRow([`${rows.filter(r=>r.tipo==='VISITA').length} visitas · ${rows.filter(r=>r.tipo==='CREACION').length} talleres creados`]);
  sheet.addRow(titles);
  rows.forEach(row=>sheet.addRow(values(row)));
  sheet.columns.forEach((col,i)=>{col.width=[15,28,24,25,22,65,60][i];});
  sheet.getRow(4).font={bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(4).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1D5596'}};
  sheet.views=[{state:'frozen',ySplit:4}];
  sheet.autoFilter={from:'A4',to:`G${Math.max(4,sheet.rowCount)}`};
  sheet.eachRow(row=>{row.alignment={vertical:'top',wrapText:true};});
  const summary=book.addWorksheet('Indicadores');
  summary.addRow(['Vendedor','Visitas','Talleres visitados','Nuevos','Ventas','Fuera de geocerca','Programadas','Ejecutadas','Cumplimiento %']);
  metrics.forEach(m=>summary.addRow([m.name,m.visitas,m.talleres_visitados,m.nuevos,m.ventas,m.fuera_rango,m.programadas,m.ejecutadas,m.programadas?Math.round(m.ejecutadas/m.programadas*100):null]));
  summary.columns.forEach(col=>{col.width=23;});summary.getRow(1).font={bold:true};
  return book.xlsx.writeBuffer();
}
export async function reportPdf(rows,filters) {
  const [{ jsPDF },{ autoTable }] = await Promise.all([import('jspdf'),import('jspdf-autotable')]);
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  doc.setFontSize(16);doc.text('TallerVisitas Pro — Reporte comercial',14,16);
  doc.setFontSize(10);doc.text(`Del ${filters.fecha_inicio} al ${filters.fecha_fin}`,14,24);
  doc.text(String(filters.responsable_nombre || 'Todos los responsables'),14,30);
  doc.text(`${rows.filter(r=>r.tipo==='VISITA').length} visitas / ${rows.filter(r=>r.tipo==='CREACION').length} talleres creados`,14,36);
  autoTable(doc,{startY:42,head:[titles],body:rows.map(values),styles:{fontSize:8,cellPadding:2,overflow:'linebreak'},headStyles:{fillColor:[29,85,150]},margin:{top:15,bottom:15},columnStyles:{0:{cellWidth:18},1:{cellWidth:32},2:{cellWidth:30},3:{cellWidth:29},4:{cellWidth:26},5:{cellWidth:65}}});
  const count=doc.getNumberOfPages();
  for(let n=1;n<=count;n++){doc.setPage(n);doc.setFontSize(8);doc.text(`Página ${n} de ${count} · Horario de Ecuador`,14,203);}
  return doc.output('arraybuffer');
}

