const test=require('node:test');
const assert=require('node:assert/strict');
test('Excel conserva textos literales, totales, filtros y todas las filas',async()=>{
  const {reportWorkbook}=await import('../../frontend/src/utils/reportDocuments.mjs');
  const ExcelJS=require('../../frontend/node_modules/exceljs');
  const rows=Array.from({length:70},(_,i)=>({tipo:'VISITA',taller:i===0?'=1+1':`Taller ${i}`,fecha:'2026-09-06 12:30:00',responsable:'José',observaciones:'Revisión con acentos y "comillas"\nSegunda línea',resultado:'VENTA',compromisos:'2026-09-07: Llamar al cliente'}));
  const buffer=await reportWorkbook(rows,{fecha_inicio:'2026-09-01',fecha_fin:'2026-09-07'},[{name:'José',visitas:70,programadas:2,ejecutadas:1}]);
  const book=new ExcelJS.Workbook();await book.xlsx.load(buffer);
  const sheet=book.getWorksheet('Actividad');
  assert.equal(sheet.rowCount,74);assert.equal(sheet.getCell('B5').value,'=1+1');assert.equal(sheet.getCell('B5').type,ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('D74').value,'José');assert.equal(book.getWorksheet('Indicadores').getCell('I2').value,50);
});
test('PDF genera varias páginas y conserva el último registro',async()=>{
  const {reportPdf}=await import('../../frontend/src/utils/reportDocuments.mjs');
  const rows=Array.from({length:90},(_,i)=>({tipo:'VISITA',taller:`TALLER-${i}`,fecha:'2026-09-06',responsable:'Vendedor',observaciones:'Observaciones '.repeat(15),compromisos:'Seguimiento '.repeat(8)}));
  const buffer=Buffer.from(await reportPdf(rows,{fecha_inicio:'2026-09-01',fecha_fin:'2026-09-07'}));
  const text=buffer.toString('latin1');assert.ok(text.startsWith('%PDF'));assert.ok(text.includes('TALLER-89'));assert.ok((text.match(/\/Type \/Page\b/g)||[]).length>1);
});
