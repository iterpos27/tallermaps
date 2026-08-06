import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ClipboardList, Edit3, Play, Search, Trash2 } from 'lucide-react';
import { api } from '../api/api';
import AlertBanner from '../components/AlertBanner';
import Modal from '../components/Modal';

const pad = (value) => String(value).padStart(2, '0');

const splitLocalDateTime = (value) => {
  const date = new Date(value);
  return {
    fecha: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    hora: `${pad(date.getHours())}:${pad(date.getMinutes())}`
  };
};

export default function MisVisitas() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [visitas, setVisitas] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [editingVisit, setEditingVisit] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [deletingVisit, setDeletingVisit] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchVisitas = async () => {
    setLoading(true);
    try {
      const data = await api.visitas.list({
        search: searchTerm,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      });
      setVisitas(data);
    } catch (requestError) {
      setError(requestError.message || 'Error al cargar sus visitas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(fetchVisitas, 300);
    return () => clearTimeout(delay);
  }, [searchTerm, fechaInicio, fechaFin]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setFechaInicio('');
    setFechaFin('');
  };

  const handlePerformVisit = (visita) => {
    navigate(`/registrar-visita?taller_id=${visita.taller_id}`);
  };

  const openEditModal = (visita) => {
    const dateTime = splitLocalDateTime(visita.fecha_visita);
    setEditingVisit(visita);
    setEditDate(dateTime.fecha);
    setEditTime(dateTime.hora);
    setError('');
    setSuccess('');
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editingVisit || !editDate || !editTime) return;

    setActionLoading(true);
    setError('');
    try {
      await api.visitas.updateDateTime(editingVisit.id, { fecha: editDate, hora: editTime });
      setEditingVisit(null);
      setSuccess('Fecha y hora de la visita actualizadas correctamente.');
      await fetchVisitas();
    } catch (requestError) {
      setError(requestError.message || 'No se pudo actualizar la visita.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingVisit) return;

    setActionLoading(true);
    setError('');
    try {
      await api.visitas.delete(deletingVisit.id);
      setVisitas((current) => current.filter((visita) => visita.id !== deletingVisit.id));
      setSuccess(`La visita a ${deletingVisit.taller_nombre} fue eliminada.`);
      setDeletingVisit(null);
    } catch (requestError) {
      setError(requestError.message || 'No se pudo eliminar la visita.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mis visitas</h1>
          <p className="page-subtitle">Consulte y administre sus visitas realizadas</p>
        </div>
      </div>

      <AlertBanner type="success" style={{ marginBottom: '20px' }}>{success}</AlertBanner>
      <AlertBanner style={{ marginBottom: '20px' }}>{!editingVisit && !deletingVisit ? error : ''}</AlertBanner>

      <div className="filter-bar glass-panel">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Buscar taller</label>
          <div className="input-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
            <input type="text" className="form-input" placeholder="Nombre del taller..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} style={{ paddingLeft: '40px' }} />
            <Search size={18} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Desde</label>
          <input type="date" className="form-input" value={fechaInicio} onChange={(event) => setFechaInicio(event.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Hasta</label>
          <input type="date" className="form-input" value={fechaFin} onChange={(event) => setFechaFin(event.target.value)} />
        </div>
        <button type="button" onClick={handleResetFilters} className="btn btn-secondary" style={{ height: '50px' }}>Limpiar</button>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner"></div><p>Cargando visitas...</p></div>
      ) : visitas.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <ClipboardList size={56} style={{ marginBottom: '16px', opacity: 0.4 }} />
          <h3>No se encontraron visitas</h3>
          <p style={{ marginTop: '8px' }}>Cambie los filtros o registre una nueva visita.</p>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="premium-table visits-data-table">
            <thead>
              <tr>
                <th>Taller</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visitas.map((visita) => {
                const outsideGeofence = visita.fuera_rango === true;
                return (
                  <tr key={visita.id}>
                    <td><strong>{visita.taller_nombre}</strong></td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}>
                        <Calendar size={16} color="var(--primary)" />
                        {new Date(visita.fecha_visita).toLocaleDateString('es-EC')}
                      </div>
                    </td>
                    <td>
                      <span className={`visit-status-badge ${outsideGeofence ? 'outside' : 'completed'}`}>
                        {outsideGeofence ? 'FUERA DE GEOCERCA' : 'REALIZADA'}
                      </span>
                    </td>
                    <td>
                      <div className="visit-table-actions">
                        <button type="button" className="btn btn-primary" onClick={() => handlePerformVisit(visita)} title="Realizar visita" aria-label={`Realizar visita en ${visita.taller_nombre}`}>
                          <Play size={16} />
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => openEditModal(visita)} title="Editar fecha y hora" aria-label={`Editar visita a ${visita.taller_nombre}`}>
                          <Edit3 size={16} />
                        </button>
                        <button type="button" className="btn btn-danger" onClick={() => { setDeletingVisit(visita); setError(''); setSuccess(''); }} title="Eliminar visita" aria-label={`Eliminar visita a ${visita.taller_nombre}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingVisit && (
        <Modal onClose={() => !actionLoading && setEditingVisit(null)} labelledBy="edit-visit-date-title" maxWidth="440px">
          <h2 id="edit-visit-date-title" style={{ color: 'var(--primary)', fontSize: '1.15rem', marginBottom: '6px' }}>Editar fecha y hora</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginBottom: '18px' }}>{editingVisit.taller_nombre}</p>
          <AlertBanner style={{ marginBottom: '16px' }}>{error}</AlertBanner>
          <form onSubmit={handleEditSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input type="date" className="form-input" value={editDate} onChange={(event) => setEditDate(event.target.value)} required disabled={actionLoading} />
              </div>
              <div className="form-group">
                <label className="form-label">Hora</label>
                <input type="time" className="form-input" value={editTime} onChange={(event) => setEditTime(event.target.value)} required disabled={actionLoading} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setEditingVisit(null)} disabled={actionLoading}>Cancelar</button>
              <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {deletingVisit && (
        <Modal onClose={() => !actionLoading && setDeletingVisit(null)} labelledBy="delete-visit-title" maxWidth="440px">
          <h2 id="delete-visit-title" style={{ color: 'var(--danger)', fontSize: '1.15rem', marginBottom: '10px' }}>¿Eliminar visita?</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '18px' }}>
            Se eliminará la visita a <strong style={{ color: 'var(--text-dark)' }}>{deletingVisit.taller_nombre}</strong>. Si estaba vinculada a una programación, volverá a quedar pendiente.
          </p>
          <AlertBanner style={{ marginBottom: '16px' }}>{error}</AlertBanner>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setDeletingVisit(null)} disabled={actionLoading}>Cancelar</button>
            <button type="button" className="btn btn-danger" style={{ width: 'auto' }} onClick={handleDelete} disabled={actionLoading}>
              <Trash2 size={16} />{actionLoading ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
