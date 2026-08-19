import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ClipboardList, Clock3, PlusCircle, Route } from 'lucide-react';
import { api, getUser } from '../api/api';

export default function DashboardVendedor() {
  const user = getUser();
  const [loading, setLoading] = useState(true);
  const [programaciones, setProgramaciones] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProgramaciones = async () => {
      try {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const today = new Date(now.getTime() - offset).toISOString().slice(0, 10);
        const data = await api.programaciones.list({ fecha_inicio: today, fecha_fin: today });
        setProgramaciones(data);
      } catch (requestError) {
        setError(requestError.message || 'No se pudo cargar la programación de visitas.');
      } finally {
        setLoading(false);
      }
    };

    fetchProgramaciones();
  }, []);

  const visitasPendientes = programaciones.filter((item) => ['PENDIENTE', 'EN_CAMINO', 'INICIADA', 'REPROGRAMADA'].includes(item.estado)).length;

  const summaryCards = [
    {
      label: 'Visitas de hoy',
      value: programaciones.length,
      to: '/mi-ruta',
      icon: Route,
      iconClass: 'stat-icon-primary'
    },
    {
      label: 'Visitas pendientes',
      value: visitasPendientes,
      to: '/mi-ruta',
      icon: Clock3,
      iconClass: 'stat-icon-success'
    }
  ];

  const actions = [
    {
      label: 'Mi ruta de hoy',
      to: '/mi-ruta',
      icon: Route
    },
    {
      label: 'Programar visitas',
      to: '/programar-visitas',
      icon: CalendarDays
    },
    {
      label: 'Nueva visita',
      to: '/registrar-visita',
      icon: PlusCircle
    },
    {
      label: 'Historial de visitas',
      to: '/mis-visitas',
      icon: ClipboardList
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bienvenido, {user?.name}</h1>
          <p className="page-subtitle">Su jornada de visitas</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '24px' }}>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Cargando programación...</p>
        </div>
      ) : (
        <>
          <div className="stats-grid seller-summary-grid" style={{ marginBottom: '36px' }}>
            {summaryCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <Link
                  key={card.label}
                  to={card.to}
                  className="stat-card glass-panel seller-summary-card"
                  style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                >
                  <div className="stat-info">
                    <span className="stat-label">{card.label}</span>
                    <span className="stat-value">{card.value}</span>
                    <span className="seller-summary-link" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '14px', fontSize: '0.88rem', fontWeight: 600 }}>
                      Ver detalle <ArrowRight size={15} />
                    </span>
                  </div>
                  <div className={`stat-icon-wrapper seller-summary-icon ${card.iconClass}`}>
                    <CardIcon size={25} />
                  </div>
                </Link>
              );
            })}
          </div>

          <section>
            <h2 style={{ fontSize: '1.18rem', fontWeight: 700, marginBottom: '16px' }}>Acciones</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {actions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <Link
                    key={action.label}
                    to={action.to}
                    className="glass-panel"
                    style={{ padding: '20px', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '14px' }}
                  >
                    <div className="stat-icon-wrapper stat-icon-primary" style={{ flexShrink: 0 }}>
                      <ActionIcon size={22} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '5px' }}>{action.label}</h3>
                    </div>
                    <ArrowRight size={18} style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }} />
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
