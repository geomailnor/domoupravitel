import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import './SettingsModal.css';

export default function SettingsModal({ field, label, currentMonth, onClose, onSave }) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSetting = async () => {
      try {
        const res = await api.get('/settings');
        const currentValue = res.data[field];
        setValue(currentValue !== undefined ? parseFloat(currentValue).toFixed(2) : '');
      } catch {
        toast.error('Грешка при зареждане');
      } finally {
        setLoading(false);
      }
    };
    loadSetting();
  }, [field]);

  const handleSave = async () => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      toast.error('Моля, въведете валидна стойност'); return;
    }
    setSaving(true);
    try {
      // Вземаме всички текущи rates, за да не загубим другите
      const settingsRes = await api.get('/settings');
      const currentRates = {
        elevator_fee_rate: parseFloat(settingsRes.data.elevator_fee_rate) || 1.10,
        elevator_power_rate: parseFloat(settingsRes.data.elevator_power_rate) || 0.85,
        general_power_rate: parseFloat(settingsRes.data.general_power_rate) || 0.65,
        fund_ro_rate: parseFloat(settingsRes.data.fund_ro_rate) || 3.00,
        intercom_rate: parseFloat(settingsRes.data.intercom_rate) || 1.00,
        manager_fee_rate: parseFloat(settingsRes.data.manager_fee_rate) || 3.00,
      };

      // Обновяваме само полето, което редактираме
      const newRates = { ...currentRates, [field]: parseFloat(value) };

      // 1. Записваме всички rates (за да е сигурно)
      await api.put('/settings', newRates);

      toast.success('Цената е запазена. Ще важи за следващия месец.');
      if (onSave) onSave();
      onClose();
    } catch {
      toast.error('Грешка при запазване');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px', height: 'auto' }}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose} disabled={saving}>×</button>
        </div>
        <div className="modal-body">
          <h2 className="settings-title">Промяна на такса</h2>
          <p className="settings-subtitle">{label}</p>

          {loading ? (
            <Spinner size="small" />
          ) : (
            <div className="settings-single-field">
              <label>Нова стойност (€):</label>
              <input
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^0-9.]/g, '');
                  const parts = val.split('.');
                  if (parts.length > 2) {
                    val = parts[0] + '.' + parts.slice(1).join('');
                  }
                  if (val === '.') val = '';
                  setValue(val);
                }}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num)) {
                    setValue(num.toFixed(2));
                  } else {
                    setValue(''); // <-- изчиства, ако е невалидно
                  }
                }}
                onFocus={(e) => e.target.select()}
                autoFocus
              />
            </div>
          )}

          <p className="settings-note">
            Промяната ще важи за следващия месец. Текущият месец остава така.
          </p>

          <div className="modal-actions">
            <button type="button" className="cancel-btn settings-action-btn" onClick={onClose} disabled={saving}>
              Отказ
            </button>
            <button type="button" className="save-btn settings-action-btn" onClick={handleSave} disabled={saving || loading}>
              {saving ? (
                <>
                  <span className="spinner-button"></span>
                  Запазване...
                </>
              ) : (
                'Запази'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}