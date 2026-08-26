// API Client Wrapper for TallerVisitas Pro
import {
  getPendingOfflineVisits,
  savePendingOfflineVisit,
  removePendingOfflineVisit,
  updatePendingOfflineVisit
} from '../storage/offlineVisits';

// Use an explicit API URL only when the deployment requires one. In local
// development Vite proxies /api and /uploads to the backend, so the browser
// stays on one origin and does not depend on a hard-coded port.
const getBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }

  return window.location.origin;
};

export const API_BASE_URL = getBaseUrl();
const API_URL = `${API_BASE_URL}/api`;

/**
 * Browser sessions use an HttpOnly cookie. This helper now reports whether
 * user metadata is available without exposing the credential to JavaScript.
 */
export const hasSession = () => Boolean(sessionStorage.getItem('user'));

/**
 * Helper to save auth session
 */
export const setSession = (user) => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.setItem('user', JSON.stringify(user));
};

/**
 * Helper to clear auth session
 */
export const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
};

/**
 * Helper to get the logged-in user info
 */
export const getUser = () => {
  const userStr = sessionStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    sessionStorage.removeItem('user');
    return null;
  }
};

/**
 * Core request wrapper
 */
const makeRequest = async (endpoint, options = {}) => {
  const { skipAuthRedirect = false, ...fetchOptions } = options;
  const headers = {
    ...fetchOptions.headers
  };

  // Do not set Content-Type header if body is FormData (let browser set it with boundary)
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include'
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Error del servidor (${response.status})`;
    const requestError = new Error(errorMsg);
    requestError.status = response.status;
    requestError.data = data;
    
    // Auto logout if token expires or is invalid
    if (response.status === 401 && !skipAuthRedirect && getUser()) {
      clearSession();
      window.location.href = '/login?expired=true';
    }
    
    throw requestError;
  }

  return data;
};

/**
 * API endpoints
 */
export const api = {
  auth: {
    login: (identifier, password) => 
      makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
        skipAuthRedirect: true
      }),
    session: () => makeRequest('/auth/session', { method: 'GET', skipAuthRedirect: true }),
    logout: () => makeRequest('/auth/logout', { method: 'POST', skipAuthRedirect: true })
  },
  
  users: {
    list: () => 
      makeRequest('/users', { method: 'GET' }),
    create: (userData) => 
      makeRequest('/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      }),
    changePassword: (id, password) => 
      makeRequest(`/users/${id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password })
      }),
    update: (id, userData) => 
      makeRequest(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData)
      })
  },
  
  talleres: {
    list: ({ includeDeleted = false, tipo = '' } = {}) => {
      const params = new URLSearchParams();
      if (includeDeleted) params.append('include_deleted', 'true');
      if (tipo) params.append('tipo', tipo);
      const query = params.toString() ? `?${params.toString()}` : '';
      return makeRequest(`/talleres${query}`, { method: 'GET' });
    },
    get: (id) => 
      makeRequest(`/talleres/${id}`, { method: 'GET' }),
    create: (tallerData) => 
      makeRequest('/talleres', {
        method: 'POST',
        body: JSON.stringify(tallerData)
      }),
    update: (id, tallerData) => 
      makeRequest(`/talleres/${id}`, {
        method: 'PUT',
        body: JSON.stringify(tallerData)
      }),
    delete: (id) =>
      makeRequest(`/talleres/${id}`, { method: 'DELETE' }),
    restore: (id) =>
      makeRequest(`/talleres/${id}/restore`, { method: 'POST' }),
    visitas: (id) => 
      makeRequest(`/talleres/${id}/visitas`, { method: 'GET' })
  },
  
  visitas: {
    list: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.vendedor_id) params.append('vendedor_id', filters.vendedor_id);
      if (filters.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
      if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
      
      const query = params.toString() ? `?${params.toString()}` : '';
      return makeRequest(`/visitas${query}`, { method: 'GET' });
    },
    get: (id) => 
      makeRequest(`/visitas/${id}`, { method: 'GET' }),
    updateDateTime: (id, data) =>
      makeRequest(`/visitas/${id}/fecha`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    delete: (id) =>
      makeRequest(`/visitas/${id}`, { method: 'DELETE' }),
    create: (formData) => {
      // expects FormData containing: taller_id or taller_nombre, latitud, longitud, and foto
      return makeRequest('/visitas', {
        method: 'POST',
        body: formData
      });
    }
  },

  programaciones: {
    list: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.vendedor_id) params.append('vendedor_id', filters.vendedor_id);
      if (filters.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
      if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
      if (filters.estado) params.append('estado', filters.estado);

      const query = params.toString() ? `?${params.toString()}` : '';
      return makeRequest(`/programaciones${query}`, { method: 'GET' });
    },
    create: (data) =>
      makeRequest('/programaciones', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    createBatch: (items) =>
      makeRequest('/programaciones/batch', {
        method: 'POST',
        body: JSON.stringify({ items })
      }),
    update: (id, data) =>
      makeRequest(`/programaciones/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    optimizeToday: (data) =>
      makeRequest('/programaciones/ruta-hoy/optimizar', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    reporte: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.vendedor_id) params.append('vendedor_id', filters.vendedor_id);
      if (filters.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
      if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);

      const query = params.toString() ? `?${params.toString()}` : '';
      return makeRequest(`/programaciones/reporte${query}`, { method: 'GET' });
    }
  },
  
  mapa: {
    puntos: () =>
      makeRequest('/mapa/puntos', { method: 'GET' }),
    talleres: () =>
      makeRequest('/mapa/talleres', { method: 'GET' }),
    ruta: (origen, destino) =>
      makeRequest('/mapa/ruta', {
        method: 'POST',
        body: JSON.stringify({ origen, destino })
      })
  },

  audit: {
    list: ({ page = 1, limit = 25 } = {}) =>
      makeRequest(`/audit?page=${page}&limit=${limit}`, { method: 'GET' })
  },

  sectores: {
    list: () => makeRequest('/sectores', { method: 'GET' }),
    create: (data) => makeRequest('/sectores', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => makeRequest(`/sectores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  entregas: {
    position: ({ latitud, longitud, accuracy }) =>
      makeRequest('/entregas/position', {
        method: 'POST',
        body: JSON.stringify({ latitud, longitud, accuracy })
      }),
    complete: ({ latitud, longitud, accuracy }) =>
      makeRequest('/entregas/complete', {
        method: 'POST',
        body: JSON.stringify({ latitud, longitud, accuracy })
      }),
    status: () => makeRequest('/entregas/status', { method: 'GET' }),
    list: () => makeRequest('/entregas', { method: 'GET' })
  }
};

/**
 * Offline Mode Caching and Sync Utilities
 */
export const offlineStorage = {
  getPendingVisits: getPendingOfflineVisits,
  savePendingVisit: savePendingOfflineVisit,
  removePendingVisit: removePendingOfflineVisit,

  syncPendingVisits: async (onProgress, { force = false } = {}) => {
    const pending = await offlineStorage.getPendingVisits();
    if (pending.length === 0) return { syncedCount: 0, conflictCount: 0 };

    let syncedCount = 0;
    let conflictCount = 0;
    let deferredCount = 0;

    for (const visit of pending) {
      if (!force && visit.nextRetryAt && new Date(visit.nextRetryAt).getTime() > Date.now()) {
        deferredCount++;
        continue;
      }
      try {
        if (onProgress) onProgress(`Sincronizando: ${visit.taller_nombre || 'Visita'}`);
        
        let blob = visit.photoBlob;
        if (!blob && visit.fotoBase64) {
          const responseBlob = await fetch(visit.fotoBase64);
          blob = await responseBlob.blob();
        }
        if (!blob) throw new Error('La foto pendiente no está disponible.');
        const file = new File([blob], `visita-offline-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

        const formData = new FormData();
        if (visit.taller_id) {
          formData.append('taller_id', visit.taller_id);
        } else {
          formData.append('taller_nombre', visit.taller_nombre);
          if (visit.sector_id) formData.append('sector_id', visit.sector_id);
        }
        formData.append('latitud', visit.latitud);
        formData.append('longitud', visit.longitud);
        if (visit.observacion) {
          formData.append('observacion', visit.observacion);
        }
        if (visit.programacion_id) {
          formData.append('programacion_id', visit.programacion_id);
        }
        formData.append('foto', file);

        // Upload to backend
        await api.visitas.create(formData);
        
        // Remove from pending
        await offlineStorage.removePendingVisit(visit.id);
        syncedCount++;
      } catch (err) {
        console.error('Error syncing visit:', visit, err);
        const isConflict = [400, 404, 409].includes(err.status);
        const attempts = (visit.attempts || 0) + 1;
        const retryDelayMinutes = Math.min(30, 2 ** Math.min(attempts, 5));
        await updatePendingOfflineVisit({
          ...visit,
          attempts,
          lastError: err.message,
          lastAttemptAt: new Date().toISOString(),
          nextRetryAt: isConflict ? null : new Date(Date.now() + retryDelayMinutes * 60 * 1000).toISOString(),
          status: isConflict ? 'needs_attention' : 'pending'
        });
        if (isConflict) {
          conflictCount++;
          if (onProgress) onProgress(`Una visita requiere revisión: ${err.message}`);
          continue;
        }
        // Stop to avoid repeatedly hitting an unavailable server.
        break;
      }
    }

    return { syncedCount, conflictCount, deferredCount };
  }
};
