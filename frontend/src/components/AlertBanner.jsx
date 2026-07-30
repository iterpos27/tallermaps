import React from 'react';

export default function AlertBanner({ type = 'danger', children, style }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${type}`} role={type === 'danger' ? 'alert' : 'status'} style={style}>
      <span>{children}</span>
    </div>
  );
}
