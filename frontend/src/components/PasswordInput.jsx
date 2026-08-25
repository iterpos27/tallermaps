import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordInput({ id, value, onChange, disabled, placeholder = '••••••••', autoComplete = 'current-password', ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const actionLabel = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';

  return (
    <div className="input-wrapper">
      <input
        {...inputProps}
        id={id}
        type={visible ? 'text' : 'password'}
        className="form-input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoComplete={autoComplete}
        style={{ paddingRight: '46px', ...inputProps.style }}
      />
      <button
        type="button"
        className="password-visibility-button"
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
        aria-label={actionLabel}
        aria-pressed={visible}
        title={actionLabel}
      >
        {visible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}
