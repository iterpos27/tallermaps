import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, CheckCircle, AlertTriangle, RefreshCw, Upload, Sparkles, X } from 'lucide-react';
import { api, offlineStorage } from '../api/api';

export default function RegistrarVisita() {
  const navigate = useNavigate();
  
  // Form states
  const [tallerMode, setTallerMode] = useState('existente'); // 'existente' | 'nuevo'
  const [talleres, setTalleres] = useState([]);
  const [programaciones, setProgramaciones] = useState([]);
  const [selectedProgramacionId, setSelectedProgramacionId] = useState('');
  const [selectedTallerId, setSelectedTallerId] = useState('');
  const [nuevoTallerNombre, setNuevoTallerNombre] = useState('');
  const [observacion, setObservacion] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  
  // Image states
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  
  // GPS states
  const [coords, setCoords] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('loading'); // 'loading' | 'active' | 'error'
  const [gpsErrorMsg, setGpsErrorMsg] = useState('');

  // General states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Refs for inline camera
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch workshops and fetch GPS coords on mount
  useEffect(() => {
    fetchTalleres();
    fetchProgramaciones();
    getGPSLocation();
    
    // Cleanup camera stream on unmount
    return () => {
      stopCamera();
    };
  }, []);

  // Autocomplete suggestions for workshops
  useEffect(() => {
    if (tallerMode === 'nuevo' && nuevoTallerNombre.trim().length > 1) {
      const filtered = talleres.filter((t) =>
        t.nombre.toLowerCase().includes(nuevoTallerNombre.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [nuevoTallerNombre, tallerMode, talleres]);

  const handleSuggestionClick = (taller) => {
    setSelectedTallerId(taller.id);
    setTallerMode('existente');
    setNuevoTallerNombre('');
    setSuggestions([]);
  };

  const fetchTalleres = async () => {
    try {
      const data = await api.talleres.list();
      setTalleres(data);
    } catch (err) {
      console.error('Error fetching workshops:', err);
    }
  };

  const fetchProgramaciones = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const future = new Date();
      future.setDate(future.getDate() + 14);
      const data = await api.programaciones.list({
        fecha_inicio: today,
        fecha_fin: future.toISOString().split('T')[0],
        estado: 'PENDIENTE'
      });
      setProgramaciones(data);
    } catch (err) {
      console.error('Error fetching schedules:', err);
    }
  };

  const handleProgramacionChange = (value) => {
    setSelectedProgramacionId(value);
    if (!value) return;

    const programacion = programaciones.find((item) => String(item.id) === String(value));
    if (programacion) {
      setTallerMode('existente');
      setSelectedTallerId(String(programacion.taller_id));
      setNuevoTallerNombre('');
      if (!observacion && programacion.observacion) {
        setObservacion(programacion.observacion);
      }
    }
  };

  const getGPSLocation = () => {
    setGpsStatus('loading');
    setGpsErrorMsg('');
    setError('');

    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsErrorMsg('La geolocalización no está soportada por su navegador.');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setGpsStatus('active');
      },
      (err) => {
        console.error('GPS error:', err);
        setGpsStatus('error');
        if (err.code === 1) {
          setGpsErrorMsg('Permiso de ubicación denegado. Active el GPS para continuar.');
        } else if (err.code === 2) {
          setGpsErrorMsg('No se pudo determinar la ubicación del GPS.');
        } else if (err.code === 3) {
          setGpsErrorMsg('Tiempo de espera agotado al obtener la ubicación.');
        } else {
          setGpsErrorMsg('Ocurrió un error al obtener la ubicación.');
        }
      },
      options
    );
  };

  // Inline Camera Operations
  const startCamera = async () => {
    setCameraError(false);
    setCameraActive(true);
    
    try {
      // Try to open back/environment camera first
      const constraints = {
        video: { facingMode: 'environment' },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing back camera, trying default camera:', err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err2) {
        console.error('Failed to open any camera:', err2);
        setCameraError(true);
        setCameraActive(false);
        // Trigger uploader automatically if camera fails
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Set canvas size to match video resolution
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the current video frame on canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to blob and set file
      canvas.toBlob((blob) => {
        const file = new File([blob], `visita-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setPhotoFile(file);
        
        const previewUrl = URL.createObjectURL(blob);
        setPhotoPreview(previewUrl);
        
        stopCamera();
      }, 'image/jpeg', 0.85);
    }
  };

  // Uploader operations
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
      stopCamera();
    }
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validations
    if (tallerMode === 'existente' && !selectedTallerId) {
      setError('Por favor, seleccione un taller registrado.');
      return;
    }

    if (tallerMode === 'nuevo' && !nuevoTallerNombre.trim()) {
      setError('Por favor, ingrese el nombre del nuevo taller.');
      return;
    }

    if (!coords) {
      setError('Las coordenadas GPS son requeridas. Active sus permisos de ubicación.');
      return;
    }

    if (!photoFile) {
      setError('Por favor, tome o cargue una foto del taller.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      if (tallerMode === 'existente') {
        formData.append('taller_id', selectedTallerId);
      } else {
        formData.append('taller_nombre', nuevoTallerNombre);
      }
      
      formData.append('latitud', coords.latitude);
      formData.append('longitud', coords.longitude);
      formData.append('observacion', observacion.trim());
      if (selectedProgramacionId) {
        formData.append('programacion_id', selectedProgramacionId);
      }
      formData.append('foto', photoFile);

      await api.visitas.create(formData);
      setSuccess('¡Visita registrada exitosamente!');
      
      // Redirect after 2s
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (err) {
      console.error('Submit error:', err);
      // Fallback to offline mode if offline or request failed
      if (!navigator.onLine || err.message === 'Failed to fetch' || err.message.toLowerCase().includes('network')) {
        try {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result;
            const offlineVisit = {
              taller_id: tallerMode === 'existente' ? selectedTallerId : null,
              taller_nombre: tallerMode === 'nuevo' ? nuevoTallerNombre.trim() : talleres.find(t => t.id == selectedTallerId)?.nombre,
              latitud: coords.latitude,
              longitud: coords.longitude,
              observacion: observacion.trim(),
              programacion_id: selectedProgramacionId || null,
              fotoBase64: base64data
            };
            
            offlineStorage.savePendingVisit(offlineVisit);
            
            setSuccess('¡Sin conexión! Visita guardada localmente en el celular. Se sincronizará automáticamente al recuperar internet.');
            setTimeout(() => {
              navigate('/dashboard');
            }, 2500);
          };
          reader.readAsDataURL(photoFile);
        } catch (readErr) {
          setError('Error al guardar la visita localmente.');
          setLoading(false);
        }
      } else {
        setError(err.message || 'Error al registrar la visita.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="camera-module">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Registrar Nueva Visita</h1>
          <p className="page-subtitle">Captura de visita con ubicación automática y cámara</p>
        </div>
      </div>

      {success && (
        <div className="alert alert-success">
          <CheckCircle size={18} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Geolocation Status Badge */}
      <div className={`gps-badge ${gpsStatus === 'active' ? 'active' : gpsStatus === 'loading' ? 'loading' : 'error'}`}>
        <MapPin size={18} />
        <div style={{ flexGrow: 1 }}>
          {gpsStatus === 'active' ? (
            <span>
              Ubicación GPS Activa (Lat: {coords?.latitude.toFixed(6)}, Lng: {coords?.longitude.toFixed(6)})
            </span>
          ) : gpsStatus === 'loading' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="dot-pulse"></div>
              <span>Obteniendo ubicación del satélite...</span>
            </div>
          ) : (
            <span>{gpsErrorMsg}</span>
          )}
        </div>
        {(gpsStatus === 'error' || gpsStatus === 'active') && (
          <button 
            type="button" 
            onClick={getGPSLocation} 
            className="btn btn-secondary" 
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '24px' }}>
        {programaciones.length > 0 && (
          <div className="form-group">
            <label className="form-label">Programacion pendiente</label>
            <select
              className="form-input form-select"
              value={selectedProgramacionId}
              onChange={(e) => handleProgramacionChange(e.target.value)}
              disabled={loading}
            >
              <option value="">Registrar sin programacion especifica</option>
              {programaciones.map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.fecha_programada).toLocaleDateString('es-EC')} - {item.taller_nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        
        {/* Workshop selection tabs */}
        <div className="form-group">
          <label className="form-label">Taller Mecánico</label>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <button
              type="button"
              className={`btn ${tallerMode === 'existente' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setTallerMode('existente'); setError(''); }}
              style={{ flex: 1, padding: '10px' }}
            >
              Taller Registrado
            </button>
            <button
              type="button"
              className={`btn ${tallerMode === 'nuevo' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setTallerMode('nuevo'); setError(''); }}
              style={{ flex: 1, padding: '10px' }}
            >
              Nuevo Taller
            </button>
          </div>

          {tallerMode === 'existente' ? (
            <select
              className="form-input form-select"
              value={selectedTallerId}
              onChange={(e) => {
                setSelectedTallerId(e.target.value);
                setSelectedProgramacionId('');
              }}
              disabled={loading}
            >
              <option value="">-- Seleccionar Taller --</option>
              {talleres.map((taller) => (
                <option key={taller.id} value={taller.id}>
                  {taller.nombre}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. Taller Mecánico Autocar Ecuador"
                value={nuevoTallerNombre}
                onChange={(e) => {
                  setNuevoTallerNombre(e.target.value);
                  setSelectedProgramacionId('');
                }}
                disabled={loading}
              />
              {suggestions.length > 0 && (
                <div 
                  className="glass-panel" 
                  style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    left: 0, 
                    right: 0, 
                    zIndex: 10, 
                    maxHeight: '180px', 
                    overflowY: 'auto',
                    marginTop: '4px',
                    padding: '8px 0',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                    Talleres Similares Registrados (Haga clic para seleccionar):
                  </div>
                  {suggestions.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleSuggestionClick(t)}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        color: 'var(--text-main)',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      {t.nombre}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Observacion de la visita</label>
          <textarea
            className="form-input"
            placeholder="Escriba novedades, acuerdos, pedidos o motivo de la visita"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            disabled={loading}
            style={{ minHeight: '90px', resize: 'vertical' }}
          />
        </div>

        {/* Camera / Photo module */}
        <div className="form-group">
          <label className="form-label">Foto de Fachada/Lugar</label>
          
          <div className="camera-preview-container">
            {/* 1. Camera active stream */}
            {cameraActive && (
              <>
                <video ref={videoRef} autoPlay playsInline className="camera-video" />
                <div className="camera-controls">
                  <button type="button" onClick={capturePhoto} className="btn-capture" title="Capturar Foto">
                    <Camera size={24} />
                  </button>
                  <button 
                    type="button" 
                    onClick={stopCamera} 
                    className="btn btn-danger" 
                    style={{ width: '40px', height: '40px', borderRadius: '50%', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </>
            )}

            {/* 2. Photo preview captured */}
            {!cameraActive && photoPreview && (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <img src={photoPreview} alt="Vista previa de visita" className="photo-preview" />
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="btn btn-danger"
                  style={{ position: 'absolute', top: '12px', right: '12px', width: '36px', height: '36px', borderRadius: '50%', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Eliminar foto"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* 3. Empty placeholder */}
            {!cameraActive && !photoPreview && (
              <div className="camera-placeholder" onClick={startCamera}>
                <Camera size={44} className="camera-placeholder-icon" />
                <div>
                  <p style={{ fontWeight: '600' }}>Iniciar Cámara del Sistema</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Solo se permite capturar fotos tomadas en vivo
                  </p>
                </div>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="camera-canvas" />

          {/* Hidden input file for fallback and direct native uploader trigger */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: '10px' }}>
            {!cameraActive && !photoPreview && (
              <>
                <button
                  type="button"
                  onClick={startCamera}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  <Camera size={18} />
                  <span>Usar Cámara Web/Interna</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  <Camera size={18} />
                  <span>Abrir Cámara del Celular</span>
                </button>
              </>
            )}
          </div>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ marginTop: '10px' }} 
          disabled={loading || gpsStatus === 'loading'}
        >
          {loading ? (
            <>
              <div className="spinner" style={{ width: '18px', height: '18px' }}></div>
              <span>Guardando Visita...</span>
            </>
          ) : (
            <span>Registrar Visita</span>
          )}
        </button>
      </form>
    </div>
  );
}
