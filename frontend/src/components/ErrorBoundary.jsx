import React from 'react';
import { API_BASE_URL, getToken } from '../api/api';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    const token = getToken();
    if (!token) return;

    fetch(`${API_BASE_URL}/api/monitoring/client-errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        path: window.location.pathname
      })
    }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error">
          <h1>Algo salió mal</h1>
          <p>El incidente fue registrado. Recargue la página para continuar.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Recargar aplicación
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
