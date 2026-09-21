import React, { useState } from 'react';
import { ShieldCheck, Check } from 'lucide-react';
import Modal from './Modal';
import { api } from '../api/api';
import { permissionLabels, permissionsFor } from '../utils/permissions';

export default function UserPermissions({ user, onClose, onSaved }) {
  const [permissions, setPermissions] = useState(() => permissionsFor(user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.users.permissions(user.id, permissions); onSaved(); }
    catch(e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <Modal onClose={() => !busy && onClose()} labelledBy="permissions-title" maxWidth="580px">
    <div className="permission-heading"><span><ShieldCheck size={24} /></span><div><h2 id="permissions-title">Permisos de acceso</h2><p>{user.name} · {user.role === 'VENDEDOR' ? 'Vendedor' : 'Mensajero'}</p></div></div>
    <p className="permission-description">Seleccione las opciones disponibles para esta persona. Guardar los cambios requerirá que vuelva a iniciar sesión.</p>
    <form onSubmit={save}>
      <div className="permission-options">{Object.entries(permissions).map(([key, value]) => <label key={key} className={`permission-option ${value ? 'enabled' : ''}`}><input type="checkbox" checked={value} disabled={busy} onChange={e=>setPermissions({...permissions,[key]:e.target.checked})} /><span>{permissionLabels[key]}</span><small>{value ? 'Habilitado' : 'Oculto'}</small></label>)}</div>
      <p className="permission-description">Seguimiento y modificación o eliminación de registros son exclusivos del administrador.</p>
      {error && <p className="alert alert-danger" role="alert">{error}</p>}
      <div className="permission-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy}><Check size={17} />{busy ? 'Guardando…' : 'Guardar permisos'}</button></div>
    </form>
  </Modal>;
}
