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
    setSaving(true);
    try {
      // Вземаме всички текущи rates, за да не загубим другите
      const settingsRes = await api.get('/settings');
      const currentRates = {
        elevator_fee_rate: parseFloat(settingsRes.data.elevator_fee_rate) || 1.13,
        elevator_power_rate: parseFloat(settingsRes.data.elevator_power_rate) || 0.82,
        general_power_rate: parseFloat(settingsRes.data.general_power_rate) || 0.65,
        fund_ro_rate: parseFloat(settingsRes.data.fund_ro_rate) || 3.00,
        intercom_rate: parseFloat(settingsRes.data.intercom_rate) || 1.00,
        manager_fee_rate: parseFloat(settingsRes.data.manager_fee_rate) || 3.00,
      };

      // Обновяваме само полето, което редактираме
      const newRates = { ...currentRates, [field]: parseFloat(value) };

      // 1. Записваме всички rates (за да е сигурно)
      await api.put('/settings', newRates);

      // 2. Преизчисляваме неплатените с новите rates
      await api.post('/charges/recalculate-unpaid', { rates: newRates, month: currentMonth });

      toast.success('Промяната е запазена');
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
          <button className="modal-close settings-close" onClick={onClose}>×</button>
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
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={(e) => e.target.select()}
                autoFocus
              />
            </div>
          )}

          <p className="settings-note">
            Промяната ще важи за всички неплатени такси в текущия месец.
          </p>

          <div className="modal-actions">
            <button type="button" className="cancel-btn settings-action-btn" onClick={onClose} disabled={saving}>
              Отказ
            </button>
            <button type="button" className="save-btn settings-action-btn" onClick={handleSave} disabled={saving || loading}>
              {saving ? 'Запазване...' : 'Запази'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}