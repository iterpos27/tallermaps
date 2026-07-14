import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle, Plus, Save, Trash2, AlertTriangle } from 'lucide-react';
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

export default function ProgramarVisitas() {
  const currentWeek = useMemo(() => getCurrentWeekRange(), []);
  const [talleres, setTalleres] = useState([]);
  const [programaciones, setProgramaciones] = useState([]);
  const [fechaInicio, setFechaInicio] = useState(currentWeek.inicio);
  const [fechaFin, setFechaFin] = useState(currentWeek.fin);
  const [items, setItems] = useState([
    { taller_id: '', fecha_programada: currentWeek.inicio, observacion: '' }
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [talleresData, programacionesData] = await Promise.all([
        api.talleres.list(),
        api.programaciones.list({
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin
        })
      ]);
      setTalleres(talleresData);
      setProgramaciones(programacionesData);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la programacion.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fechaInicio, fechaFin]);

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => (
      i === index ? { ...item, [field]: value } : item
    )));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { taller_id: '', fecha_programada: fechaInicio, observacion: '' }
    ]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const payload = items
      .filter((item) => item.taller_id && item.fecha_programada)
      .map((item) => ({
        taller_id: Number(item.taller_id),
        fecha_programada: item.fecha_programada,
        observacion: item.observacion.trim()
      }));

    if (payload.length === 0) {
      setError('Agregue al menos un taller con fecha para guardar la programacion.');
      return;
    }

    setSaving(true);
    try {
      await api.programaciones.createBatch(payload);
      setSuccess('Programacion semanal guardada correctamente.');
      setItems([{ taller_id: '', fecha_programada: fechaInicio, observacion: '' }]);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Error al guardar la programacion.');
    } finally {
      setSaving(false);
    }
  };

  const estadoStyles = {
    PENDIENTE: { color: '#92400e', background: '#fffbeb', border: '#fde68a' },
    EJECUTADA: { color: '#047857', background: '#ecfdf5', border: '#a7f3d0' },
    CANCELADA: { color: '#991b1b', background: '#fef2f2', border: '#fca5a5' }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Programar Visitas Semanales</h1>
          <p className="page-subtitle">Organice los talleres que visitara durante la semana</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircle size={18} />
          <span>{success}</span>
        </div>
      )}

      <div className="filter-bar glass-panel">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Inicio de semana</label>
          <input
            type="date"
            className="form-input"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Fin de semana</label>
          <input
            type="date"
            className="form-input"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.15rem', color: 'var(--primary)' }}>Nueva programacion</h2>
          <button type="button" onClick={addItem} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 14px' }}>
            <Plus size={16} />
            <span>Agregar taller</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item, index) => (
            <div
              key={index}
              className="schedule-form-row"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 1.4fr) minmax(150px, 0.7fr) minmax(220px, 1.2fr) auto',
                gap: '12px',
                alignItems: 'end'
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Taller</label>
                <select
                  className="form-input form-select"
                  value={item.taller_id}
                  onChange={(e) => updateItem(index, 'taller_id', e.target.value)}
                  disabled={saving}
                >
                  <option value="">-- Seleccionar --</option>
                  {talleres.map((taller) => (
                    <option key={taller.id} value={taller.id}>{taller.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Fecha</label>
                <input
                  type="date"
                  className="form-input"
                  value={item.fecha_programada}
                  onChange={(e) => updateItem(index, 'fecha_programada', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Observacion previa</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Motivo, pendiente o nota"
                  value={item.observacion}
                  onChange={(e) => updateItem(index, 'observacion', e.target.value)}
                  disabled={saving}
                />
              </div>

              <button
                type="button"
                onClick={() => removeItem(index)}
                className="btn btn-danger"
                style={{ width: '44px', height: '48px', padding: 0 }}
                disabled={saving || items.length === 1}
                title="Quitar fila"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '18px', width: 'auto' }} disabled={saving}>
          <Save size={18} />
          <span>{saving ? 'Guardando...' : 'Guardar programacion semanal'}</span>
        </button>
      </form>

      <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarDays size={18} color="var(--primary)" />
          <h2 style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>Programacion del periodo</h2>
        </div>

        {loading ? (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Cargando programacion...</p>
          </div>
        ) : programaciones.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No hay visitas programadas en este periodo.
          </div>
        ) : (
          <table className="premium-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Taller</th>
                <th>Observacion</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {programaciones.map((item) => {
                const style = estadoStyles[item.estado] || estadoStyles.PENDIENTE;
                return (
                  <tr key={item.id}>
                    <td>{new Date(item.fecha_programada).toLocaleDateString('es-EC')}</td>
                    <td>{item.taller_nombre}</td>
                    <td>{item.observacion || '-'}</td>
                    <td>
                      <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, color: style.color, background: style.background, border: `1px solid ${style.border}` }}>
                        {item.estado}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
