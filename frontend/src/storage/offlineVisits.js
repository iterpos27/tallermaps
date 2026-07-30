const DB_NAME = 'tallervisitas-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_visits';
const LEGACY_KEY = 'pending_visitas';

const openDatabase = () => new Promise((resolve, reject) => {
  if (!('indexedDB' in window)) {
    reject(new Error('IndexedDB no está disponible en este navegador.'));
    return;
  }

  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const runTransaction = async (mode, operation) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;

    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('La operación offline fue cancelada.'));
    };

    result = operation(store);
  });
};

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const migrateLegacyOfflineVisits = async () => {
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return;

  let visits;
  try {
    visits = JSON.parse(legacy);
  } catch {
    localStorage.removeItem(LEGACY_KEY);
    return;
  }

  if (Array.isArray(visits)) {
    await runTransaction('readwrite', (store) => {
      visits.forEach((visit) => store.put(visit));
    });
  }
  localStorage.removeItem(LEGACY_KEY);
};

export const getPendingOfflineVisits = async () => {
  await migrateLegacyOfflineVisits();
  return runTransaction('readonly', (store) => requestResult(store.getAll()));
};

export const savePendingOfflineVisit = async (visit) => {
  const queuedVisit = {
    ...visit,
    id: visit.id || `local-${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    queuedAt: visit.queuedAt || new Date().toISOString(),
    attempts: visit.attempts || 0
  };
  await runTransaction('readwrite', (store) => store.put(queuedVisit));
  return queuedVisit;
};

export const removePendingOfflineVisit = async (id) => (
  runTransaction('readwrite', (store) => store.delete(id))
);

export const updatePendingOfflineVisit = async (visit) => (
  runTransaction('readwrite', (store) => store.put(visit))
);
