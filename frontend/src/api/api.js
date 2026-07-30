// API Client Wrapper for TallerVisitas Pro
import {
  getPendingOfflineVisits,
  savePendingOfflineVisit,
  removePendingOfflineVisit,
  updatePendingOfflineVisit
} from '../storage/offlineVisits';

// Detect server hostname to allow mobile devices on the same network to connect.
// If localhost is used in mobile, it fails, so we default to the browser's current IP.
const getBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  const host = window.location.hostname;
  const port = window.location.port;
  
  // If running in development (Vite is typically on port 3000)
  if (port === '3000') {
    return `http://${host}:5000`;
  }
  
  // In production, we request from the same origin serving the app
  return window.location.origin;
};

export const API_BASE_URL = getBaseUrl();
const API_URL = `${API_BASE_URL}/api`;

/**
 * Helper to get the saved auth token
 */
export const getToken = () => localStorage.getItem('token');

/**
 * Helper to save auth session
 */
export const setSession = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

/**
 * Helper to clear auth session
 */
export const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

/**
 * Helper to get the logged-in user info
 */
export const getUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

/**
 * Core request wrapper
 */
const makeRequest = async (endpoint, options = {}) => {
  const token = getToken();
  
  const headers = {
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Do not set Content-Type header if body is FormData (let browser set it with boundary)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Error del servidor (${response.status})`;
    const requestError = new Error(errorMsg);
    requestError.status = response.status;
    requestError.data = data;
    
    // Auto logout if token expires or is invalid
    if (response.status === 401 || response.status === 403) {
      if (token) {
        clearSession();
        window.location.href = '/login?expired=true';
      }
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
        body: JSON.stringify({ identifier, password })
      })
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
    list: ({ includeDeleted = false } = {}) =>
      makeRequest(`/talleres${includeDeleted ? '?include_deleted=true' : ''}`, { method: 'GET' }),
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
    talleres: () => 
      makeRequest('/mapa/talleres', { method: 'GET' })
  },

  audit: {
    list: ({ page = 1, limit = 25 } = {}) =>
      makeRequest(`/audit?page=${page}&limit=${limit}`, { method: 'GET' })
  }
};

/**
 * Offline Mode Caching and Sync Utilities
 */
export const offlineStorage = {
  getPendingVisits: getPendingOfflineVisits,
  savePendingVisit: savePendingOfflineVisit,
  removePendingVisit: removePendingOfflineVisit,

  syncPendingVisits: async (onProgress) => {
    const pending = await offlineStorage.getPendingVisits();
    if (pending.length === 0) return { syncedCount: 0, conflictCount: 0 };

    let syncedCount = 0;
    let conflictCount = 0;

    for (const visit of pending) {
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
        await updatePendingOfflineVisit({
          ...visit,
          attempts: (visit.attempts || 0) + 1,
          lastError: err.message,
          lastAttemptAt: new Date().toISOString(),
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

    return { syncedCount, conflictCount };
  }
};
