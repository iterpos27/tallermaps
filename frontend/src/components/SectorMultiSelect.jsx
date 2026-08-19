export default function SectorMultiSelect({ sectors, value, onChange, disabled = false }) {
  const selected = new Set((value || []).map(Number));

  const toggle = (sectorId) => {
    const next = new Set(selected);
    if (next.has(sectorId)) next.delete(sectorId);
    else next.add(sectorId);
    onChange([...next]);
  };

  if (sectors.length === 0) {
    return <p className="field-help">Primero cree al menos un sector activo.</p>;
  }

  return (
    <div className="sector-check-grid">
      {sectors.filter((sector) => sector.is_active !== false).map((sector) => (
        <label key={sector.id} className={`sector-check ${selected.has(Number(sector.id)) ? 'selected' : ''}`}>
          <input
            type="checkbox"
            checked={selected.has(Number(sector.id))}
            onChange={() => toggle(Number(sector.id))}
            disabled={disabled}
          />
          <span className="sector-color-dot" style={{ background: sector.color }} />
          <span>{sector.nombre}</span>
        </label>
      ))}
    </div>
  );
}
