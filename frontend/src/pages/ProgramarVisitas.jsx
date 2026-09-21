import { businessDate } from '../utils/date';
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle, Clock3, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../api/api';

const toDateInput = (date) => businessDate(date);

const addDays = (dateValue, days) => {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInput(date);
};

const getCurrentWeekRange = () => {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  return {
    inicio: toDateInput(monday),
    fin: addDays(toDateInput(monday), 6)
  };
};

const createEmptyItem = (date) => ({
  taller_id: '',
  fecha_programada: date,
  hora_programada: '08:00',
  duracion_minutos: '30',
  observacion: ''
});

const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('es-EC', {
  weekday: 'short',
  day: '2-digit',
  month: 'short'
});

const formatTimeRange = (timeValue = '08:00', duration = 30) => {
  const [hours, minutes] = timeValue.slice(0, 5).split(':').map(Number);
  const startMinutes = (hours * 60) + minutes;
  const endMinutes = startMinutes + Number(duration || 30);
  const format = (total) => `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  return `${format(startMinutes)} – ${format(endMinutes)}`;
};

export default function ProgramarVisitas() {
  const [searchParams] = useSearchParams();
  const estadoFilter = searchParams.get('estado') === 'PENDIENTE' ? 'PENDIENTE' : '';
  const currentWeek = useMemo(() => getCurrentWeekRange(), []);
  const [talleres, setTalleres] = useState([]);
  const [programaciones, setProgramaciones] = useState([]);
  const [fechaInicio, setFechaInicio] = useState(currentWeek.inicio);
  const [fechaFin, setFechaFin] = useState(currentWeek.fin);
  const [items, setItems] = useState([createEmptyItem(currentWeek.inicio)]);
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
          fecha_fin: fechaFin,
          estado: estadoFilter
        })
      ]);
      setTalleres(talleresData);
      setProgramaciones(programacionesData);
    } catch (requestError) {
      setError(requestError.message || 'No se pudo cargar la programación.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fechaInicio, fechaFin, estadoFilter]);

  const handleWeekStartChange = (value) => {
    const newEnd = addDays(value, 6);
    setFechaInicio(value);
    setFechaFin(newEnd);
    setItems((current) => current.map((item) => ({
      ...item,
      fecha_programada: item.fecha_programada < value || item.fecha_programada > newEnd
        ? value
        : item.fecha_programada
    })));
  };

  const updateItem = (index, field, value) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const addItem = () => setItems((current) => [...current, createEmptyItem(fechaInicio)]);

  const removeItem = (index) => {
    setItems((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const incompleteItem = items.some((item) => (
      !item.taller_id || !item.fecha_programada || !item.hora_programada
      || Number(item.duracion_minutos) < 1 || Number(item.duracion_minutos) > 30
    ));
    if (incompleteItem) {
      setError('Complete taller, fecha, hora y una duración entre 1 y 30 minutos.');
      return;
    }

    if (items.some((item) => item.fecha_programada < fechaInicio || item.fecha_programada > fechaFin)) {
      setError('Todas las visitas deben estar dentro de la semana seleccionada.');
      return;
    }

    const payload = items.map((item) => ({
      taller_id: Number(item.taller_id),
      fecha_programada: item.fecha_programada,
      hora_programada: item.hora_programada,
      duracion_minutos: Number(item.duracion_minutos),
      observacion: item.observacion.trim()
    }));

    setSaving(true);
    try {
      await api.programaciones.createBatch(payload);
      setSuccess('Programación semanal guardada correctamente.');
      setItems([createEmptyItem(fechaInicio)]);
      await fetchData();
    } catch (requestError) {
      setError(requestError.message || 'Error al guardar la programación.');
    } finally {
      setSaving(false);
    }
  };

  const estadoStyles = {
    PENDIENTE: { color: '#92400e', background: '#fffbeb', border: '#fde68a' },
    EN_CAMINO: { color: '#1d5596', background: '#eff6ff', border: '#bfdbfe' },
    INICIADA: { color: '#1d5596', background: '#eff6ff', border: '#93c5fd' },
    EJECUTADA: { color: '#047857', background: '#ecfdf5', border: '#a7f3d0' },
    FALLIDA: { color: '#991b1b', background: '#fef2f2', border: '#fca5a5' },
    REPROGRAMADA: { color: '#6d28d9', background: '#f5f3ff', border: '#ddd6fe' },
    CANCELADA: { color: '#991b1b', background: '#fef2f2', border: '#fca5a5' }
  };

  return (
    <div>
      <div className="page-header field-hero">
        <div>
          <h1 className="page-title">{estadoFilter ? 'Visitas pendientes' : 'Programar visitas semanales'}</h1>
          <p className="page-subtitle">Cada visita puede durar como máximo 30 minutos</p>
        </div>
      </div>

      {error && <div className="alert alert-danger"><AlertTriangle size={18} /><span>{error}</span></div>}
      {success && <div className="alert alert-success"><CheckCircle size={18} /><span>{success}</span></div>}

      <div className="filter-bar glass-panel schedule-week-filter">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Inicio de semana</label>
          <input type="date" className="form-input" value={fechaInicio} onChange={(event) => handleWeekStartChange(event.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Fin de semana</label>
          <input type="date" className="form-input" value={fechaFin} readOnly />
        </div>
        <div className="schedule-week-caption">
          <CalendarDays size={20} />
          <span>Rango fijo de 7 días</span>
        </div>
      </div>

      <div className="schedule-split-layout">
        <form onSubmit={handleSubmit} className="glass-panel schedule-create-panel">
          <div className="schedule-panel-title">
            <div>
              <h2>Nueva visita</h2>
              <p>Seleccione taller, día y hora.</p>
            </div>
            <button type="button" onClick={addItem} className="btn btn-secondary" style={{ width: 'auto', padding: '9px 12px' }}>
              <Plus size={16} /><span>Agregar</span>
            </button>
          </div>

          <div className="schedule-items-list">
            {items.map((item, index) => (
              <div key={index} className="schedule-item-card">
                <div className="schedule-item-heading">
                  <strong>Visita {index + 1}</strong>
                  <button type="button" onClick={() => removeItem(index)} className="schedule-remove-button" disabled={saving || items.length === 1} title="Quitar visita">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Taller</label>
                  <select className="form-input form-select" value={item.taller_id} onChange={(event) => updateItem(index, 'taller_id', event.target.value)} disabled={saving} required>
                    <option value="">-- Seleccionar --</option>
                    {talleres.map((taller) => <option key={taller.id} value={taller.id}>{taller.nombre}</option>)}
                  </select>
                </div>

                <div className="schedule-item-grid">
                  <div className="form-group">
                    <label className="form-label">Fecha</label>
                    <input type="date" min={fechaInicio} max={fechaFin} className="form-input" value={item.fecha_programada} onChange={(event) => updateItem(index, 'fecha_programada', event.target.value)} disabled={saving} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hora de inicio</label>
                    <input type="time" className="form-input" value={item.hora_programada} onChange={(event) => updateItem(index, 'hora_programada', event.target.value)} disabled={saving} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duración</label>
                    <div className="input-wrapper">
                      <input type="number" min="1" max="30" step="1" className="form-input" value={item.duracion_minutos} onChange={(event) => updateItem(index, 'duracion_minutos', event.target.value)} disabled={saving} required />
                      <span className="schedule-duration-unit">min</span>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Observación</label>
                  <input type="text" className="form-input" placeholder="Motivo, pendiente o nota" value={item.observacion} onChange={(event) => updateItem(index, 'observacion', event.target.value)} disabled={saving} />
                </div>
              </div>
            ))}
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '18px' }} disabled={saving}>
            <Save size={18} /><span>{saving ? 'Guardando...' : 'Guardar programación'}</span>
          </button>
        </form>

        <section className="glass-panel schedule-list-panel">
          <div className="schedule-panel-title">
            <div>
              <h2>{estadoFilter ? 'Pendientes de la semana' : 'Programación de la semana'}</h2>
              <p>{programaciones.length} visita(s) en el rango seleccionado.</p>
            </div>
            <CalendarDays size={22} color="var(--primary)" />
          </div>

          {loading ? (
            <div className="loading-overlay"><div className="spinner"></div><p>Cargando programación...</p></div>
          ) : programaciones.length === 0 ? (
            <div className="schedule-empty-state">No hay visitas programadas en esta semana.</div>
          ) : (
            <div className="schedule-appointments">
              {programaciones.map((item) => {
                const style = estadoStyles[item.estado] || estadoStyles.PENDIENTE;
                return (
                  <article key={item.id} className="schedule-appointment-card">
                    <div className="schedule-appointment-date">
                      <CalendarDays size={17} />
                      <strong>{formatDate(item.fecha_programada)}</strong>
                    </div>
                    <h3>{item.taller_nombre}</h3>
                    <div className="schedule-appointment-time">
                      <Clock3 size={16} />
                      <span>{formatTimeRange(item.hora_programada, item.duracion_minutos)} · {item.duracion_minutos || 30} min</span>
                    </div>
                    {item.observacion && <p>{item.observacion}</p>}
                    <span className="schedule-status" style={{ color: style.color, background: style.background, borderColor: style.border }}>{item.estado}</span>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
