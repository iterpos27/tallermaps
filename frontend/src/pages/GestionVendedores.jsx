import React, { useState, useEffect } from 'react';
import { Users, UserPlus, CheckCircle, AlertTriangle, Mail, Shield, Lock, X, Edit, Power } from 'lucide-react';
import { api } from '../api/api';

export default function GestionVendedores() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Creation modal & form states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('VENDEDOR');

  // Edit modal & form states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null); // { id, name, email, username, role, is_active }

  // Password reset modal states
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');

  // Status banners
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUsers = async () => {
    try {
      const data = await api.users.list();
      setUsers(data);
    } catch (err) {
      setError('No se pudo cargar la lista de usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Creation Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name || !email || !password || !role) {
      setError('Todos los campos son obligatorios para registrar un usuario.');
      return;
    }

    setFormLoading(true);

    try {
      await api.users.create({ name, email, username, password, role });
      setSuccess('¡Usuario registrado exitosamente!');
      setIsCreateModalOpen(false);
      
      // Clear fields
      setName('');
      setEmail('');
      setUsername('');
      setPassword('');
      setRole('VENDEDOR');
      
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Error al crear el usuario.');
    } finally {
      setFormLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Open Edit Modal
  const handleEditClick = (user) => {
    setEditUser({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username || '',
      role: user.role,
      is_active: user.is_active === undefined ? true : user.is_active
    });
    setIsEditModalOpen(true);
  };

  // Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!editUser.name || !editUser.email || !editUser.role) {
      setError('Nombre, correo y rol son obligatorios.');
      return;
    }

    setFormLoading(true);

    try {
      await api.users.update(editUser.id, editUser);
      setSuccess('¡Usuario actualizado exitosamente!');
      setIsEditModalOpen(false);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Error al actualizar el usuario.');
    } finally {
      setFormLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (user) => {
    setError('');
    setSuccess('');
    const newStatus = !(user.is_active === undefined ? true : user.is_active);
    
    try {
      await api.users.update(user.id, {
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        is_active: newStatus
      });
      setSuccess(`Usuario ${user.name} ${newStatus ? 'activado' : 'desactivado'} correctamente.`);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Error al cambiar el estado del usuario.');
    }
  };

  // Password Reset Triggers
  const handlePasswordResetClick = (user) => {
    setPasswordModalUser(user);
    setNewPassword('');
    setPasswordChangeError('');
    setPasswordChangeSuccess('');
  };

  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.trim().length < 4) {
      setPasswordChangeError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    setPasswordChangeLoading(true);
    setPasswordChangeError('');
    setPasswordChangeSuccess('');

    try {
      await api.users.changePassword(passwordModalUser.id, newPassword);
      setPasswordChangeSuccess('¡Contraseña actualizada con éxito!');
      setTimeout(() => {
        setPasswordModalUser(null);
      }, 1200);
    } catch (err) {
      setPasswordChangeError(err.message || 'Error al actualizar la contraseña.');
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Gestión de Vendedores y Personal</h1>
          <p className="page-subtitle">Administre los accesos, contraseñas y roles del sistema</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary"
          style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
        >
          <UserPlus size={18} />
          <span>Registrar Usuario</span>
        </button>
      </div>

      {/* Success & Error Banners */}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: '24px' }}>
          <CheckCircle size={18} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '24px' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Full Width Table Panel */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} color="var(--primary)" />
          <span>Usuarios del Sistema</span>
        </h2>

        {loading ? (
          <div className="loading-overlay" style={{ minHeight: '200px' }}>
            <div className="spinner"></div>
            <p>Cargando personal...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo / Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isActive = u.is_active === undefined ? true : u.is_active;
                  return (
                    <tr key={u.id} style={{ opacity: isActive ? 1 : 0.65 }}>
                      <td style={{ fontWeight: '600', color: 'var(--text-dark)' }}>{u.name}</td>
                      <td style={{ fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-main)' }}>{u.email}</span>
                        {u.username && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                            Usuario: <strong>{u.username}</strong>
                          </div>
                        )}
                      </td>
                      <td>
                        <span 
                          style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: '600', 
                            padding: '4px 8px', 
                            borderRadius: '4px',
                            backgroundColor: u.role === 'ADMIN' ? 'rgba(29, 85, 150, 0.15)' : 'rgba(226, 38, 47, 0.15)',
                            color: u.role === 'ADMIN' ? 'var(--primary)' : 'var(--accent)'
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span 
                          style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: '600', 
                            padding: '4px 8px', 
                            borderRadius: '4px',
                            backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                            color: isActive ? '#10b981' : 'var(--text-muted)'
                          }}
                        >
                          {isActive ? 'Activo' : 'Desactivado'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleEditClick(u)}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.75rem', width: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Editar usuario"
                          >
                            <Edit size={12} />
                            <span>Editar</span>
                          </button>
                          
                          <button
                            onClick={() => handlePasswordResetClick(u)}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.75rem', width: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Cambiar contraseña"
                          >
                            <Lock size={12} />
                            <span>Clave</span>
                          </button>

                          <button
                            onClick={() => handleToggleStatus(u)}
                            className="btn"
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '0.75rem', 
                              width: 'auto', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              backgroundColor: isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              color: isActive ? 'var(--danger)' : '#10b981',
                              border: isActive ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)'
                            }}
                            title={isActive ? "Desactivar acceso" : "Activar acceso"}
                          >
                            <Power size={12} />
                            <span>{isActive ? 'Desactivar' : 'Activar'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== CREATE USER MODAL ==================== */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', background: '#ffffff', padding: '28px', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={22} />
                <span>Registrar Nuevo Usuario</span>
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Nombre Completo</label>
                <input
                  id="reg-name"
                  type="text"
                  className="form-input"
                  placeholder="Ej. Carlos Zambrano"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">Correo Electrónico</label>
                <input
                  id="reg-email"
                  type="email"
                  className="form-input"
                  placeholder="carlos@taller.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-username">Nombre de Usuario (Opcional)</label>
                <input
                  id="reg-username"
                  type="text"
                  className="form-input"
                  placeholder="Ej. czambrano (vacío para usar prefijo de correo)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={formLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">Contraseña</label>
                <input
                  id="reg-password"
                  type="password"
                  className="form-input"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" htmlFor="reg-role">Rol asignado</label>
                <select
                  id="reg-role"
                  className="form-input form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={formLoading}
                  required
                >
                  <option value="VENDEDOR">VENDEDOR (Acceso móvil, registra visitas)</option>
                  <option value="ADMIN">ADMINISTRADOR (Acceso total)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '10px 20px' }}
                  disabled={formLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '10px 24px' }}
                  disabled={formLoading}
                >
                  {formLoading ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== EDIT USER MODAL ==================== */}
      {isEditModalOpen && editUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', background: '#ffffff', padding: '28px', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit size={20} />
                <span>Editar Datos de Usuario</span>
              </h2>
              <button onClick={() => { setIsEditModalOpen(false); setEditUser(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-name">Nombre Completo</label>
                <input
                  id="edit-name"
                  type="text"
                  className="form-input"
                  value={editUser.name}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                  disabled={formLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-email">Correo Electrónico</label>
                <input
                  id="edit-email"
                  type="email"
                  className="form-input"
                  value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  disabled={formLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-username">Nombre de Usuario</label>
                <input
                  id="edit-username"
                  type="text"
                  className="form-input"
                  value={editUser.username}
                  onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
                  disabled={formLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-role">Rol asignado</label>
                <select
                  id="edit-role"
                  className="form-input form-select"
                  value={editUser.role}
                  onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                  disabled={formLoading}
                  required
                >
                  <option value="VENDEDOR">VENDEDOR (Acceso móvil, registra visitas)</option>
                  <option value="ADMIN">ADMINISTRADOR (Acceso total)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  id="edit-active"
                  type="checkbox"
                  checked={editUser.is_active}
                  onChange={(e) => setEditUser({ ...editUser, is_active: e.target.checked })}
                  disabled={formLoading}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="edit-active" style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-dark)', cursor: 'pointer', select: 'none' }}>
                  Cuenta activa (Permite iniciar sesión en el sistema)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditUser(null); }}
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '10px 20px' }}
                  disabled={formLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '10px 24px' }}
                  disabled={formLoading}
                >
                  {formLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== CHANGE PASSWORD MODAL ==================== */}
      {passwordModalUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', background: '#ffffff', padding: '24px', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)' }}>Cambiar Contraseña</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Usuario: {passwordModalUser.name}</p>
              </div>
              <button onClick={() => setPasswordModalUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={20} />
              </button>
            </div>

            {passwordChangeError && (
              <div className="alert alert-danger" style={{ marginBottom: '16px', padding: '8px 12px', fontSize: '0.8rem' }}>
                <span>{passwordChangeError}</span>
              </div>
            )}
            {passwordChangeSuccess && (
              <div className="alert alert-success" style={{ marginBottom: '16px', padding: '8px 12px', fontSize: '0.8rem' }}>
                <span>{passwordChangeSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChangeSubmit}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Nueva Contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Mínimo 4 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={passwordChangeLoading}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '8px 16px', fontSize: '0.85rem' }}
                  disabled={passwordChangeLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '8px 20px', fontSize: '0.85rem' }}
                  disabled={passwordChangeLoading}
                >
                  {passwordChangeLoading ? 'Guardando...' : 'Cambiar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
