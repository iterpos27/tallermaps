const defaults = {
  VENDEDOR: { route: true, schedule: true, register: true, history: true, offline: true, map: false },
  MENSAJERO: { delivery: true }
};
export const permissionLabels = { route: 'Consultar mi ruta de hoy', schedule: 'Programar visitas', register: 'Registrar visitas', history: 'Consultar mis visitas', offline: 'Consultar pendientes sin conexión', map: 'Ver mapa y rutas', delivery: 'Registrar y consultar entregas' };
export const permissionsFor = user => Object.fromEntries(Object.entries(defaults[user?.role] || {}).map(([key, value]) => [key, typeof user.permissions?.[key] === 'boolean' ? user.permissions[key] : value]));
export const can = (user, key) => user?.role === 'ADMIN' || permissionsFor(user)[key] === true;
const routes = { '/mi-ruta': 'route', '/programar-visitas': 'schedule', '/registrar-visita': 'register', '/mis-visitas': 'history', '/visitas-offline': 'offline', '/mapa': 'map', '/entregas': 'delivery' };
export const canVisit = (user, path) => user?.role === 'ADMIN' || (path === '/dashboard' || (routes[path] && can(user, routes[path])));
