import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Edit, MapPinned, Plus, Power, Users, Wrench } from 'lucide-react';
import { api } from '../api/api';
import Modal from '../components/Modal';
import { analyzeSectorPolygon } from '../utils/sectorGeometry';

const SectorMapEditor = lazy(() => import('../components/SectorMapEditor'));
const EMPTY_FORM = { nombre: '', color: '#1d5596', poligono_geojson: null };

export default function GestionSectores() {
  const [sectors, setSectors] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchTerritoryData = async () => {
    try {
      const [sectorData, workshopData] = await Promise.all([
        api.sectores.list(),
        api.talleres.list()
      ]);
      setSectors(sectorData);
      setWorkshops(workshopData);
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron cargar los sectores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTerritoryData(); }, []);

  const mapAnalysis = useMemo(() => {
    const analysis = analyzeSectorPolygon(form.poligono_geojson, sectors, workshops, editing?.id);
    return editing?.is_active === false
      ? { ...analysis, overlappingSectors: [] }
      : analysis;
  }, [editing?.id, editing?.is_active, form.poligono_geojson, sectors, workshops]);

  const openCreate = () => {
    setEditing({ id: null, is_active: true });
    setForm({ ...EMPTY_FORM });
    setError('');
  };

  const openEdit = (sector) => {
    setEditing(sector);
    setForm({
      nombre: sector.nombre,
      color: sector.color,
      poligono_geojson: sector.poligono_geojson || null
    });
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        nombre: form.nombre.trim(),
        color: form.color,
        poligono_geojson: form.poligono_geojson,
        is_active: editing.is_active
      };
      const result = editing.id
        ? await api.sectores.update(editing.id, payload)
        : await api.sectores.create(payload);
      const reassigned = Number(result.talleres_reasignados || 0);
      const baseMessage = editing.id ? 'Sector actualizado.' : 'Sector creado.';
      setSuccess(reassigned > 0
        ? `${baseMessage} ${reassigned} ${reassigned === 1 ? 'taller fue reasignado' : 'talleres fueron reasignados'} automáticamente.`
        : baseMessage);
      setEditing(null);
      await fetchTerritoryData();
    } catch (requestError) {
      setError(requestError.message || 'No se pudo guardar el sector.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (sector) => {
    setError('');
    try {
      await api.sectores.update(sector.id, {
        nombre: sector.nombre,
        color: sector.color,
        poligono_geojson: sector.poligono_geojson,
        is_active: !sector.is_active
      });
      setSuccess(`Sector ${sector.is_active ? 'desactivado' : 'activado'}.`);
      await fetchTerritoryData();
    } catch (requestError) {
      setError(requestError.message || 'No se pudo cambiar el estado.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sectores</h1>
          <p className="page-subtitle">Territorios, colores y cobertura comercial</p>
        </div>
        <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={openCreate}>
          <Plus size={18} /> Nuevo sector
        </button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && !editing && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /><p>Cargando sectores...</p></div>
      ) : sectors.length === 0 ? (
        <div className="glass-panel schedule-empty-state">Cree el primer sector para organizar talleres y vendedores.</div>
      ) : (
        <div className="sector-card-grid">
          {sectors.map((sector) => (
            <article key={sector.id} className={`glass-panel sector-admin-card ${sector.is_active ? '' : 'inactive'}`}>
              <div className="sector-admin-heading">
                <span className="sector-admin-swatch" style={{ background: sector.color }} />
                <div>
                  <h2>{sector.nombre}</h2>
                  <span>{sector.is_active ? 'Activo' : 'Inactivo'}</span>
                </div>
              </div>
              <div className="sector-admin-stats">
                <span><Wrench size={16} /> {sector.talleres_count} talleres</span>
                <span><Users size={16} /> {sector.vendedores_count} vendedores</span>
                <span><MapPinned size={16} /> {sector.poligono_geojson ? 'Área delimitada' : 'Área pendiente'}</span>
              </div>
              <div className="sector-admin-actions">
                <button type="button" className="btn btn-secondary" onClick={() => openEdit(sector)}><Edit size={15} /> Editar</button>
                <button type="button" className="btn btn-secondary" onClick={() => toggleStatus(sector)}><Power size={15} /> {sector.is_active ? 'Desactivar' : 'Activar'}</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <Modal onClose={() => !saving && setEditing(null)} labelledBy="sector-form-title" maxWidth="900px">
          <h2 id="sector-form-title" style={{ marginBottom: '20px', color: 'var(--primary)' }}>
            {editing.id ? 'Editar sector' : 'Nuevo sector'}
          </h2>
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={submit}>
            <div className="sector-form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="sector-name">Nombre</label>
                <input id="sector-name" className="form-input" value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} maxLength={100} required disabled={saving} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sector-color">Color</label>
                <input id="sector-color" className="form-input sector-color-input" type="color" value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} disabled={saving} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Área del sector</label>
              <Suspense fallback={<div className="sector-map-loading"><div className="spinner" /><span>Cargando mapa...</span></div>}>
                <SectorMapEditor
                  value={form.poligono_geojson}
                  color={form.color}
                  workshops={workshops}
                  analysis={mapAnalysis}
                  disabled={saving}
                  onChange={(polygon) => setForm((current) => ({ ...current, poligono_geojson: polygon }))}
                />
              </Suspense>
              <p className="field-help">Puede guardar el sector sin área y delimitarlo después al editarlo.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving || mapAnalysis.overlappingSectors.length > 0}>{saving ? 'Guardando...' : 'Guardar sector'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
