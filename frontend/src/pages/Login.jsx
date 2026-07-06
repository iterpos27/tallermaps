import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Lock, Mail, AlertTriangle } from 'lucide-react';
import { api, getToken, setSession } from '../api/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (getToken()) {
      navigate('/dashboard');
      return;
    }

    // Check if redirect due to expired session
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      setInfoMessage('Su sesión ha expirado por inactividad. Por favor, inicie sesión nuevamente.');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor, complete todos los campos.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.auth.login(email, password);
      setSession(response.token, response.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión. Inténtelo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel">
        <div className="auth-header">
          <div className="logo-icon">🚗</div>
          <h1 className="auth-title">TallerVisitas Pro</h1>
          <p className="auth-subtitle">Registro de visitas a talleres mecánicos</p>
        </div>

        {infoMessage && (
          <div 
            className="alert" 
            style={{ 
              color: '#856404', 
              backgroundColor: '#fff3cd', 
              borderColor: '#ffeeba', 
              marginBottom: '16px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              border: '1px solid #ffeeba',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '0.88rem'
            }}
          >
            <AlertTriangle size={18} />
            <span>{infoMessage}</span>
          </div>
        )}

        {error && (
          <div className="alert alert-danger">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Correo Electrónico
            </label>
            <div className="input-wrapper">
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="ejemplo@taller.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Contraseña
            </label>
            <div className="input-wrapper">
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner" style={{ width: '18px', height: '18px', borderThickness: '2px' }}></div>
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <span>Ingresar al Sistema</span>
            )}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.82rem', color: '#6b7280' }}>
          <p>Ecuador • 2026</p>
        </div>
      </div>
    </div>
  );
}
