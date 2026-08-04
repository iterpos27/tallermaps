import React, { useEffect, useState } from 'react';
import { Clock, Truck, AlertTriangle } from 'lucide-react';
import { api } from '../api/api';

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} h ${minutes} min`;
}

export default function ControlEntregas() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.entregas.list()
      .then(setDeliveries)
      .catch((requestError) => setError(requestError.message || 'No se pudo cargar el control de entregas.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Control de Entregas</h1><p className="page-subtitle">Tiempo desde la salida hasta la entrega confirmada por geocerca</p></div>
      </div>
      {error && <div className="alert alert-danger" style={{ marginBottom: '20px' }}><AlertTriangle size={18} /><span>{error}</span></div>}
      <section className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '18px', display: 'flex', gap: '8px', alignItems: 'center' }}><Truck size={20} /> Recorridos</h2>
        {loading ? <div className="loading-overlay"><div className="spinner" /><p>Cargando recorridos...</p></div> : (
          <div className="table-container"><table className="premium-table">
            <thead><tr><th>Mensajero</th><th>Origen</th><th>Destino</th><th>Salida</th><th>Llegada</th><th>Tiempo</th><th>Estado</th></tr></thead>
            <tbody>
              {deliveries.map((delivery) => <tr key={delivery.id}>
                <td>{delivery.mensajero_nombre}</td><td>{delivery.origen_nombre}</td><td>{delivery.destino_nombre || 'En ruta'}</td>
                <td>{new Date(delivery.salida_at).toLocaleString('es-EC')}</td>
                <td>{delivery.llegada_at ? new Date(delivery.llegada_at).toLocaleString('es-EC') : '—'}</td>
                <td><Clock size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />{formatDuration(delivery.duracion_segundos)}</td>
                <td><strong style={{ color: delivery.estado === 'ENTREGADA' ? '#10b981' : 'var(--primary)' }}>{delivery.estado}</strong></td>
              </tr>)}
              {deliveries.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay recorridos registrados.</td></tr>}
            </tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
