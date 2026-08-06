import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { getPhotoUrl, handlePhotoError } from '../utils/photo';
import { Search, MapPin, Calendar, User, Edit, FileText, CheckCircle, AlertTriangle, X, Trash2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from '../components/Modal';
import AlertBanner from '../components/AlertBanner';

const PAGE_SIZE = 12;

export default function GestionTalleres() {
  const [talleres, setTalleres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);

  // Edit Modal States
  const [editingTaller, setEditingTaller] = useState(null);
  const [editNombre, setEditNombre] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editPropietario, setEditPropietario] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editCorreo, setEditCorreo] = useState('');
  const [editObservaciones, setEditObservaciones] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // History Modal States
  const [historyTaller, setHistoryTaller] = useState(null);
  const [historyVisits, setHistoryVisits] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Delete Modal States
  const [deletingTaller, setDeletingTaller] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchTalleres = async () => {
    try {
      setLoading(true);
      const data = await api.talleres.list({ includeDeleted: showArchived });
      setTalleres(data);
    } catch {
      setError('Error al obtener la lista de talleres.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTalleres();
  }, [showArchived]);

  const handleEditClick = (taller) => {
    setEditingTaller(taller);
    setEditNombre(taller.nombre);
    setEditLat(taller.latitud);
    setEditLng(taller.longitud);
    setEditPropietario(taller.propietario || '');
    setEditTelefono(taller.telefono || '');
    setEditDireccion(taller.direccion || '');
    setEditCorreo(taller.correo || '');
    setEditObservaciones(taller.observaciones || '');
    setError('');
    setSuccess('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editNombre.trim() || editLat === '' || editLng === '') {
      setError('Por favor complete el nombre y las coordenadas GPS.');
      return;
    }

    setEditLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.talleres.update(editingTaller.id, {
        nombre: editNombre.trim(),
        latitud: parseFloat(editLat),
        longitud: parseFloat(editLng),
        propietario: editPropietario.trim(),
        telefono: editTelefono.trim(),
        direccion: editDireccion.trim(),
        correo: editCorreo.trim(),
        observaciones: editObservaciones.trim(),
        tipo: 'TALLER',
        radio_geocerca_metros: Number(editingTaller.radio_geocerca_metros || 100)
      });
      setSuccess('¡Taller actualizado exitosamente!');
      setTimeout(() => {
        setEditingTaller(null);
        fetchTalleres();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Error al actualizar el taller.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleHistoryClick = async (taller) => {
    setHistoryTaller(taller);
    setHistoryLoading(true);
    setHistoryVisits([]);
    try {
      const data = await api.talleres.visitas(taller.id);
      setHistoryVisits(data);
    } catch (err) {
      console.error('Error fetching workshop visits history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTaller) return;

    setDeleteLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.talleres.delete(deletingTaller.id);
      setTalleres((current) => current.filter((taller) => taller.id !== deletingTaller.id));
      setSuccess(`El taller "${deletingTaller.nombre}" fue eliminado del sistema y del mapa.`);
      setDeletingTaller(null);
    } catch (err) {
      setError(err.message || 'Error al eliminar el taller.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRestore = async (taller) => {
    setError('');
    setSuccess('');
    try {
      await api.talleres.restore(taller.id);
      setSuccess(`El taller "${taller.nombre}" fue restaurado y volverá a aparecer en el mapa.`);
      await fetchTalleres();
    } catch (err) {
      setError(err.message || 'Error al restaurar el taller.');
    }
  };

  const filteredTalleres = talleres.filter((t) =>
    t.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredTalleres.length / PAGE_SIZE));
  const paginatedTalleres = filteredTalleres.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Gestión de Talleres</h1>
          <p className="page-subtitle">Monitoree, corrija y audite los talleres registrados en Ecuador</p>
        </div>
      </div>

      {!editingTaller && <AlertBanner type="success" style={{ marginBottom: '20px' }}>{success}</AlertBanner>}
      {!editingTaller && <AlertBanner style={{ marginBottom: '20px' }}>{error}</AlertBanner>}

      {/* Filter bar */}
      <div className="filter-bar glass-panel" style={{ marginBottom: '24px', padding: '16px 20px', display: 'flex', alignItems: 'end', gap: '20px', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0, width: '100%', maxWidth: '400px' }}>
          <label className="form-label">Buscar Taller</label>
          <div className="input-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Escriba el nombre..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              style={{ paddingLeft: '40px' }}
            />
            <Search size={18} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
          </div>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', paddingBottom: '10px' }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => { setShowArchived(event.target.checked); setPage(1); }}
          />
          <span>Mostrar talleres eliminados</span>
        </label>
      </div>

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Cargando talleres...</p>
        </div>
      ) : filteredTalleres.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <MapPin size={56} style={{ marginBottom: '16px', opacity: '0.4' }} />
          <h3>No se encontraron talleres registrados</h3>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '16px' }}>Nombre del Taller</th>
                <th style={{ padding: '16px' }}>Ultimo Vendedor</th>
                <th style={{ padding: '16px' }}>Coordenadas GPS</th>
                <th style={{ padding: '16px' }}>Fecha Creación</th>
                <th style={{ padding: '16px', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTalleres.map((taller) => (
                <tr key={taller.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: taller.is_active === false ? 0.65 : 1 }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-dark)', fontSize: '0.95rem', marginBottom: '4px' }}>
                      {taller.nombre}
                      <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '999px', background: '#e0f2fe', color: '#0369a1', fontSize: '0.68rem' }}>{taller.tipo || 'TALLER'}</span>
                      {taller.is_active === false && (
                        <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '999px', background: '#f1f5f9', color: '#64748b', fontSize: '0.7rem' }}>Eliminado</span>
                      )}
                    </div>
                    {(taller.propietario || taller.direccion || taller.telefono || taller.correo || taller.observaciones) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {taller.propietario && (
                          <div>Propietario: <strong style={{ color: 'var(--text-main)' }}>{taller.propietario}</strong></div>
                        )}
                        {taller.direccion && (
                          <div>Dirección: <span>{taller.direccion}</span></div>
                        )}
                        {(taller.telefono || taller.correo) && (
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {taller.telefono && <div>Telf: <span>{taller.telefono}</span></div>}
                            {taller.correo && <div>Correo: <span>{taller.correo}</span></div>}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {taller.ultimo_vendedor_nombre ? (
                      <>
                        <strong style={{ color: 'var(--text-main)' }}>{taller.ultimo_vendedor_nombre}</strong>
                        <br />
                        {new Date(taller.ultima_fecha_visita).toLocaleDateString('es-EC')}
                      </>
                    ) : (
                      <span>Sin visitas</span>
                    )}
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Lat: {parseFloat(taller.latitud).toFixed(6)} <br />
                    Lng: {parseFloat(taller.longitud).toFixed(6)}
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {new Date(taller.created_at).toLocaleDateString('es-EC')}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => handleHistoryClick(taller)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
                        title="Ver Historial"
                      >
                        <FileText size={14} />
                        <span>Historial</span>
                      </button>
                      {taller.is_active === false ? (
                        <button onClick={() => handleRestore(taller)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }} title="Restaurar Taller">
                          <RotateCcw size={14} />
                          <span>Restaurar</span>
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditClick(taller)}
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
                            title="Editar Taller"
                          >
                            <Edit size={14} />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => {
                              setDeletingTaller(taller);
                              setError('');
                              setSuccess('');
                            }}
                            className="btn btn-danger"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
                            title="Eliminar Taller"
                          >
                            <Trash2 size={14} />
                            <span>Eliminar</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filteredTalleres.length > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '18px' }}>
          <button type="button" className="btn btn-secondary" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
            <ChevronLeft size={16} /> Anterior
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Página {page} de {totalPages}</span>
          <button type="button" className="btn btn-secondary" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Edit Workshop Modal */}
      {editingTaller && (
        <Modal onClose={() => !editLoading && setEditingTaller(null)} labelledBy="edit-taller-title" maxWidth="580px">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 id="edit-taller-title" style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)' }}>Editar Taller</h3>
              <button onClick={() => setEditingTaller(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre del Taller</label>
                <input
                  type="text"
                  className="form-input"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  disabled={editLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nombre del Propietario</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej. Carlos Mendoza"
                  value={editPropietario}
                  onChange={(e) => setEditPropietario(e.target.value)}
                  disabled={editLoading}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej. 0987654321"
                    value={editTelefono}
                    onChange={(e) => setEditTelefono(e.target.value)}
                    disabled={editLoading}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Correo Electrónico</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Ej. taller@correo.com"
                    value={editCorreo}
                    onChange={(e) => setEditCorreo(e.target.value)}
                    disabled={editLoading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Dirección Física</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej. Av. América N31-115 y San Gabriel"
                  value={editDireccion}
                  onChange={(e) => setEditDireccion(e.target.value)}
                  disabled={editLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Observaciones / Notas Adicionales</label>
                <textarea
                  className="form-input"
                  placeholder="Escriba datos del local, horarios, referencias, etc..."
                  value={editObservaciones}
                  onChange={(e) => setEditObservaciones(e.target.value)}
                  disabled={editLoading}
                  style={{ minHeight: '70px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Latitud</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    disabled={editLoading}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Longitud</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    disabled={editLoading}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingTaller(null)}
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '10px 16px' }}
                  disabled={editLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '10px 24px' }}
                  disabled={editLoading}
                >
                  {editLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
        </Modal>
      )}

      {/* Delete Workshop Modal */}
      {deletingTaller && (
        <Modal onClose={() => !deleteLoading && setDeletingTaller(null)} labelledBy="delete-taller-title" maxWidth="460px">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '18px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', background: '#fef2f2' }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 id="delete-taller-title" style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                  ¿Eliminar este taller?
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-main)' }}>{deletingTaller.nombre}</strong> desaparecerá del sistema y del mapa. Sus visitas, fotografías y programaciones se conservarán para auditoría y podrá restaurarse después.
                </p>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingTaller(null)}
                className="btn btn-secondary"
                style={{ width: 'auto', padding: '10px 16px' }}
                disabled={deleteLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="btn btn-danger"
                style={{ width: 'auto', padding: '10px 16px' }}
                disabled={deleteLoading}
              >
                <Trash2 size={16} />
                <span>{deleteLoading ? 'Eliminando...' : 'Sí, eliminar'}</span>
              </button>
            </div>
        </Modal>
      )}

      {/* History Modal */}
      {historyTaller && (
        <Modal onClose={() => setHistoryTaller(null)} labelledBy="history-taller-title" maxWidth="650px">
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(90vh - 48px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h3 id="history-taller-title" style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)' }}>Historial de Visitas</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Taller: {historyTaller.nombre}</p>
              </div>
              <button onClick={() => setHistoryTaller(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '4px' }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="spinner" style={{ margin: '0 auto 10px' }}></div>
                  <p>Cargando historial...</p>
                </div>
              ) : historyVisits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <Calendar size={40} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <p>Este taller aún no registra visitas.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {historyVisits.map((v) => (
                    <div 
                      key={v.id} 
                      style={{ 
                        display: 'flex', 
                        gap: '16px', 
                        padding: '14px', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '8px', 
                        background: '#f8fafc',
                        alignItems: 'center'
                      }}
                    >
                      {/* Image Thumbnail */}
                      <div style={{ width: '80px', height: '80px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#000' }}>
                        <img 
                          src={getPhotoUrl(v.foto_url)}
                          alt="Visita" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={handlePhotoError}
                        />
                      </div>

                      {/* Info */}
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <User size={14} color="var(--primary)" />
                            {v.vendedor_nombre}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={12} />
                            {new Date(v.fecha_visita).toLocaleString('es-EC')}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} />
                          <span>Lat: {parseFloat(v.latitud).toFixed(6)}, Lng: {parseFloat(v.longitud).toFixed(6)}</span>
                        </div>

                        {v.observacion && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginBottom: '6px' }}>
                            Observacion: {v.observacion}
                          </div>
                        )}

                        {/* Geofencing Badge */}
                        {v.fuera_rango ? (
                          <span 
                            style={{ 
                              display: 'inline-flex', 
                              padding: '2px 6px', 
                              fontSize: '0.7rem', 
                              fontWeight: '700', 
                              borderRadius: '4px',
                              gap: '4px',
                              alignItems: 'center',
                              color: '#ef4444',
                              background: '#fef2f2',
                              border: '1px solid #fee2e2'
                            }}
                          >
                            <AlertTriangle size={10} />
                            Fuera de Rango ({Math.round(v.distancia_metros)}m)
                          </span>
                        ) : (
                          v.distancia_metros > 0 && (
                            <span 
                              style={{ 
                                display: 'inline-flex', 
                                padding: '2px 6px', 
                                fontSize: '0.7rem', 
                                fontWeight: '700', 
                                borderRadius: '4px',
                                gap: '4px',
                                alignItems: 'center',
                                color: '#10b981',
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0'
                              }}
                            >
                              <CheckCircle size={10} />
                              En el taller ({Math.round(v.distancia_metros)}m)
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setHistoryTaller(null)} className="btn btn-secondary" style={{ width: 'auto', padding: '8px 20px' }}>
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
