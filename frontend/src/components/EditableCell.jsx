import { useState, useId } from 'react';

export default function EditableCell({
  value,
  onSave,
  type = 'text',
  disabled = false,
  isNumeric = false,
  align = 'left',
  requireDoubleClick = false,
  suggestions = null
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  // Генерираме стабилно уникално ID за datalist (React hook)
  const listId = useId();

  if (!isEditing && localValue !== value) {
    setLocalValue(value);
  }

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== value) {
      onSave(localValue);
    }
  };

  if (disabled) {
    return <span className="disabled-cell-value">{value}</span>;
  }

  if (!isEditing) {
    return (
      <span
        onClick={() => {
          if (!requireDoubleClick) {
            setIsEditing(true);
          }
        }}
        onDoubleClick={() => {
          if (requireDoubleClick) {
            setIsEditing(true);
          }
        }}
        className="inline-edit-trigger"
        title={requireDoubleClick ? "Кликнете два пъти за редакция" : "Кликнете за редакция"}
        style={{
          textAlign: align,
          display: 'inline-block',
          width: '100%',
          cursor: 'pointer'
        }}
      >
        {value || '—'}
      </span>
    );
  }
  return (
    <>
      <input
        type={type}
        value={localValue}
        list={suggestions ? listId : undefined} // <-- Свързваме с datalist
        onChange={(e) => {
          let val = e.target.value;
          if (isNumeric) {
            val = val.replace(/[^0-9.]/g, '');
            const parts = val.split('.');
            if (parts.length > 2) {
              val = parts[0] + '.' + parts.slice(1).join('');
            }
          }
          setLocalValue(val);
        }}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur();
          if (e.key === 'Escape') {
            setLocalValue(value);
            setIsEditing(false);
          }
        }}
        onFocus={(e) => e.target.select()}
        className={`editable-cell-input ${localValue !== value ? 'changed' : ''}`}
        style={{ textAlign: align, display: 'inline-block', width: '100%' }}
        autoFocus
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s, idx) => (
            <option key={idx} value={s} />
          ))}
        </datalist>
      )}
    </>
  );
}