import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle, ClipboardList, Download, Search } from 'lucide-react';
import { api } from '../api/api';

const toDateInput = (date) => date.toISOString().split('T')[0];

const getCurrentWeekRange = () => {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    inicio: toDateInput(monday),
    fin: toDateInput(sunday)
  };
};

const escapeCsv = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export default function ProgramacionAdmin() {
  const currentWeek = useMemo(() => getCurrentWeekRange(), []);
  const [programaciones, setProgramaciones] = useState([]);
  const [reporte, setReporte] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [fechaInicio, setFechaInicio] = useState(currentWeek.inicio);
  const [fechaFin, setFechaFin] = useState(currentWeek.fin);
  const [estado, setEstado] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [programacionesData, reporteData, usersData] = await Promise.all([
        api.programaciones.list({
          vendedor_id: selectedVendedor,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          estado
        }),
        api.programaciones.reporte({
          vendedor_id: selectedVendedor,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin
        }),
        api.users.list()
      ]);

      setProgramaciones(programacionesData);
      setReporte(reporteData);
      setVendedores(usersData.filter((user) => user.role === 'VENDEDOR'));
    } catch (err) {
      setError(err.message || 'No se pudo cargar la programacion.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedVendedor, fechaInicio, fechaFin, estado]);

  const handleExportExcel = () => {
    if (reporte.length === 0) return;

    const headers = ['NOMBRE TALLER', 'FECHA', 'QUIEN HIZO VISITA', 'OBSERVACION'];
    const rows = reporte.map((item) => [
      item.taller_nombre,
      item.fecha ? new Date(item.fecha).toLocaleDateString('es-EC') : '',
      item.vendedor_nombre,
      item.observacion || ''
    ]);

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(','))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `programacion_vs_visitas_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const total = programaciones.length;
    const ejecutadas = programaciones.filter((item) => item.estado === 'EJECUTADA').length;
    const pendientes = programaciones.filter((item) => item.estado === 'PENDIENTE').length;
    return { total, ejecutadas, pendientes };
  }, [programaciones]);

  const estadoStyles = {
    PENDIENTE: { color: '#92400e', background: '#fffbeb', border: '#fde68a' },
    EJECUTADA: { color: '#047857', background: '#ecfdf5', border: '#a7f3d0' },
    CANCELADA: { color: '#991b1b', background: '#fef2f2', border: '#fca5a5' }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Programacion de Visitas</h1>
          <p className="page-subtitle">Revision semanal y reporte de programacion vs visitas ejecutadas</p>
        </div>
        <button
          type="button"
          onClick={handleExportExcel}
          className="btn btn-primary"
          style={{ width: 'auto' }}
          disabled={reporte.length === 0}
        >
          <Download size={18} />
          <span>Exportar Excel</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-label">Programadas</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-icon-wrapper stat-icon-primary">
            <CalendarDays size={24} />
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-label">Ejecutadas</span>
            <span className="stat-value">{stats.ejecutadas}</span>
          </div>
          <div className="stat-icon-wrapper stat-icon-success">
            <CheckCircle size={24} />
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-label">Pendientes</span>
            <span className="stat-value">{stats.pendientes}</span>
          </div>
          <div className="stat-icon-wrapper stat-icon-accent">
            <ClipboardList size={24} />
          </div>
        </div>
      </div>

      <div className="filter-bar glass-panel">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Vendedor</label>
          <select
            className="form-input form-select"
            value={selectedVendedor}
            onChange={(e) => setSelectedVendedor(e.target.value)}
          >
            <option value="">-- Todos --</option>
            {vendedores.map((vendedor) => (
              <option key={vendedor.id} value={vendedor.id}>{vendedor.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Desde</label>
          <input type="date" className="form-input" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Hasta</label>
          <input type="date" className="form-input" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Estado</label>
          <select className="form-input form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">-- Todos --</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EJECUTADA">Ejecutada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflowX: 'auto', marginBottom: '24px' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={18} color="var(--primary)" />
          <h2 style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>Revision de programacion</h2>
        </div>

        {loading ? (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Cargando programacion...</p>
          </div>
        ) : programaciones.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No hay programaciones para los filtros seleccionados.
          </div>
        ) : (
          <table className="premium-table">
            <thead>
              <tr>
                <th>Fecha programada</th>
                <th>Taller</th>
                <th>Vendedor</th>
                <th>Observacion programada</th>
                <th>Estado</th>
                <th>Visita ejecutada</th>
              </tr>
            </thead>
            <tbody>
              {programaciones.map((item) => {
                const style = estadoStyles[item.estado] || estadoStyles.PENDIENTE;
                return (
                  <tr key={item.id}>
                    <td>{new Date(item.fecha_programada).toLocaleDateString('es-EC')}</td>
                    <td>{item.taller_nombre}</td>
                    <td>{item.vendedor_nombre}</td>
                    <td>{item.observacion || '-'}</td>
                    <td>
                      <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, color: style.color, background: style.background, border: `1px solid ${style.border}` }}>
                        {item.estado}
                      </span>
                    </td>
                    <td>
                      {item.fecha_visita ? (
                        <span>{new Date(item.fecha_visita).toLocaleString('es-EC')}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Sin ejecutar</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>Vista previa del Excel</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            El archivo exportado solo incluye: nombre taller, fecha, quien hizo visita y observacion.
          </p>
        </div>
        <table className="premium-table">
          <thead>
            <tr>
              <th>Nombre taller</th>
              <th>Fecha</th>
              <th>Quien hizo visita</th>
              <th>Observacion</th>
            </tr>
          </thead>
          <tbody>
            {reporte.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sin datos para exportar.</td>
              </tr>
            ) : (
              reporte.map((item, index) => (
                <tr key={`${item.taller_nombre}-${item.fecha}-${index}`}>
                  <td>{item.taller_nombre}</td>
                  <td>{item.fecha ? new Date(item.fecha).toLocaleDateString('es-EC') : '-'}</td>
                  <td>{item.vendedor_nombre}</td>
                  <td>{item.observacion || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
