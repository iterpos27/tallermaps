import React, { useEffect, useRef, useState } from 'react';
import { Navigation, AlertTriangle } from 'lucide-react';
import { api } from '../api/api';

const MIN_SEND_INTERVAL_MS = 10000;

export default function MessengerTracker() {
  const [message, setMessage] = useState('Activando seguimiento GPS...');
  const [hasError, setHasError] = useState(false);
  const lastSentAt = useRef(0);
  const sending = useRef(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setHasError(true);
      setMessage('Este dispositivo no permite seguimiento GPS.');
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(async (position) => {
      const now = Date.now();
      if (sending.current || now - lastSentAt.current < MIN_SEND_INTERVAL_MS) return;

      sending.current = true;
      lastSentAt.current = now;
      try {
        const data = await api.entregas.position({
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setHasError(false);
        if (data.event === 'ROUTE_STARTED') {
          setMessage(`Salida detectada desde ${data.activeRoute.origen_nombre}. Tiempo en curso.`);
          window.dispatchEvent(new CustomEvent('delivery-tracking-updated'));
        } else if (data.activeRoute) {
          setMessage(`En ruta desde ${data.activeRoute.origen_nombre}.`);
        } else if (data.insidePoint) {
          setMessage(`GPS activo dentro de ${data.insidePoint.nombre}. La salida se detectará automáticamente.`);
        } else {
          setMessage('GPS activo. Acérquese a Matriz, local o almacén para preparar una salida.');
        }
      } catch (error) {
        setHasError(true);
        setMessage(error.message || 'No se pudo actualizar la posición.');
      } finally {
        sending.current = false;
      }
    }, (error) => {
      setHasError(true);
      if (error.code === error.PERMISSION_DENIED) {
        setMessage('Active el permiso de ubicación para controlar los tiempos de entrega.');
      } else {
        setMessage('No se pudo obtener el GPS. Revise la ubicación del teléfono.');
      }
    }, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const Icon = hasError ? AlertTriangle : Navigation;
  return (
    <div className={`alert ${hasError ? 'alert-danger' : 'alert-success'}`} style={{ marginBottom: '20px' }}>
      <Icon size={18} />
      <span>{message}</span>
    </div>
  );
}
