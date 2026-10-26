import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import './SettingsModal.css';

export default function SettingsModal({ onClose, onSave }) {
  const [rates, setRates] = useState({
    elevator_fee_rate: 1.13,
    elevator_power_rate: 0.82,
    general_power_rate: 0.65,
    fund_ro_rate: 3.00,
    intercom_rate: 1.00,
    manager_fee_rate: 3.00,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get('/settings');
        setRates({
          elevator_fee_rate: parseFloat(res.data.elevator_fee_rate) || 1.13,
          elevator_power_rate: parseFloat(res.data.elevator_power_rate) || 0.82,
          general_power_rate: parseFloat(res.data.general_power_rate) || 0.65,
          fund_ro_rate: parseFloat(res.data.fund_ro_rate) || 3.00,
          intercom_rate: parseFloat(res.data.intercom_rate) || 1.00,
          manager_fee_rate: parseFloat(res.data.manager_fee_rate) || 3.00,
        });
      } catch {
        toast.error('Грешка при зареждане на настройките');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Запазваме новите цени
      await api.put('/settings', rates);

      // 2. Преизчисляваме неплатените такси за текущия месец
      await api.post('/charges/recalculate-unpaid');

      toast.success('Настройките са запазени. Неплатените такси са преизчислени.');
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
      <div className="modal-content" style={{ maxWidth: '600px', height: 'auto' }}>
        <div className="modal-header">
          <button className="modal-close settings-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <h2>Настройки на таксите</h2>

          {loading ? (
            <Spinner size="small" />
          ) : (
            <div className="settings-grid">
              <div className="settings-field">
                <label>Асансьорна такса (€/човек):</label>
                <input
                  type="number"
                  step="0.01"
                  value={rates.elevator_fee_rate}
                  onChange={(e) => setRates({ ...rates, elevator_fee_rate: e.target.value })}
                />
              </div>
              <div className="settings-field">
                <label>Асансьорен ток (€/човек):</label>
                <input
                  type="number"
                  step="0.01"
                  value={rates.elevator_power_rate}
                  onChange={(e) => setRates({ ...rates, elevator_power_rate: e.target.value })}
                />
              </div>
              <div className="settings-field">
                <label>Общ ток (€/човек):</label>
                <input
                  type="number"
                  step="0.01"
                  value={rates.general_power_rate}
                  onChange={(e) => setRates({ ...rates, general_power_rate: e.target.value })}
                />
              </div>
              <div className="settings-field">
                <label>Фонд Р.О. (€/апартамент):</label>
                <input
                  type="number"
                  step="0.01"
                  value={rates.fund_ro_rate}
                  onChange={(e) => setRates({ ...rates, fund_ro_rate: e.target.value })}
                />
              </div>
              <div className="settings-field">
                <label>Дом. сис. (€/апартамент):</label>
                <input
                  type="number"
                  step="0.01"
                  value={rates.intercom_rate}
                  onChange={(e) => setRates({ ...rates, intercom_rate: e.target.value })}
                />
              </div>
              <div className="settings-field">
                <label>Хонорар (€/апартамент):</label>
                <input
                  type="number"
                  step="0.01"
                  value={rates.manager_fee_rate}
                  onChange={(e) => setRates({ ...rates, manager_fee_rate: e.target.value })}
                />
              </div>
            </div>
          )}

          <p className="settings-note">
            Промените ще важат за всички неплатени такси в текущия месец. Платените остават със старите цени.
          </p>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose} disabled={saving}>
              Отказ
            </button>
            <button type="button" className="save-btn" onClick={handleSave} disabled={saving || loading}>
              {saving ? 'Запазване...' : 'Запази'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}