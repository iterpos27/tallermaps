// API Client Wrapper for TallerVisitas Pro

// Detect server hostname to allow mobile devices on the same network to connect.
// If localhost is used in mobile, it fails, so we default to the browser's current IP.
const getBaseUrl = () => {
  const host = window.location.hostname;
  return `http://${host}:5005`;
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
    
    // Auto logout if token expires or is invalid
    if (response.status === 401 || response.status === 403) {
      if (token) {
        clearSession();
        window.location.href = '/login?expired=true';
      }
    }
    
    throw new Error(errorMsg);
  }

  return data;
};

/**
 * API endpoints
 */
export const api = {
  auth: {
    login: (email, password) => 
      makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
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
    list: () => 
      makeRequest('/talleres', { method: 'GET' }),
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
  
  mapa: {
    talleres: () => 
      makeRequest('/mapa/talleres', { method: 'GET' })
  }
};

/**
 * Offline Mode Caching and Sync Utilities
 */
export const offlineStorage = {
  getPendingVisits: () => {
    try {
      const data = localStorage.getItem('pending_visitas');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  savePendingVisit: (visit) => {
    try {
      const pending = offlineStorage.getPendingVisits();
      pending.push({
        id: `local-${Date.now()}`,
        ...visit
      });
      localStorage.setItem('pending_visitas', JSON.stringify(pending));
    } catch (e) {
      console.error('Failed to save pending visit locally:', e);
    }
  },

  removePendingVisit: (id) => {
    try {
      const pending = offlineStorage.getPendingVisits();
      const filtered = pending.filter(v => v.id !== id);
      localStorage.setItem('pending_visitas', JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to remove pending visit:', e);
    }
  },

  syncPendingVisits: async (onProgress) => {
    const pending = offlineStorage.getPendingVisits();
    if (pending.length === 0) return 0;

    let syncedCount = 0;

    for (const visit of pending) {
      try {
        if (onProgress) onProgress(`Sincronizando: ${visit.taller_nombre || 'Visita'}`);
        
        // Convert base64 dataURL back to a File object
        const responseBlob = await fetch(visit.fotoBase64);
        const blob = await responseBlob.blob();
        const file = new File([blob], `visita-offline-${Date.now()}.jpg`, { type: 'image/jpeg' });

        const formData = new FormData();
        if (visit.taller_id) {
          formData.append('taller_id', visit.taller_id);
        } else {
          formData.append('taller_nombre', visit.taller_nombre);
        }
        formData.append('latitud', visit.latitud);
        formData.append('longitud', visit.longitud);
        formData.append('foto', file);

        // Upload to backend
        await api.visitas.create(formData);
        
        // Remove from pending
        offlineStorage.removePendingVisit(visit.id);
        syncedCount++;
      } catch (err) {
        console.error('Error syncing visit:', visit, err);
        // Break loop if server is down, keeping them in cache
        break;
      }
    }

    return syncedCount;
  }
};

