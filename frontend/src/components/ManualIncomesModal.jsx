import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useScrollLock } from '../hooks/useScrollLock.js';
import { monthLabel } from './i18n/translate.js';
// import '../pages/Dashboard.css';
// import './ExpensesModal.css';
import './ManualIncomesModal.css';

export default function ManualIncomesModal({ onClose }) {
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const modalRef = useRef(null);
  const monthInputRef = useRef(null);

  useFocusTrap(modalRef, !deleteConfirm);
  useScrollLock();

  const [formData, setFormData] = useState({
    month: new Date().toISOString().slice(0, 7),
    amount: '',
    category: 'rent',
    description: '',
  });

  // Зареждане на приходите
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await api.get('/manual-incomes');
        setIncomes(res.data);
      } catch {
        toast.error('Грешка при зареждане на приходите');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSave = async () => {
    const num = parseFloat(formData.amount);
    if (isNaN(num) || num <= 0) {
      toast.error('Въведете валидна сума');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Въведете описание');
      return;
    }

    setSaving(true);
    try {
      await api.post('/manual-incomes', {
        month: formData.month,
        amount: num,
        category: formData.category,
        description: formData.description.trim(),
      });

      toast.success('Приходът е добавен');
      setShowForm(false);
      setFormData({
        month: new Date().toISOString().slice(0, 7),
        amount: '',
        category: 'rent',
        description: '',
      });

      // Презареждаме
      const res = await api.get('/manual-incomes');
      setIncomes(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Грешка при добавяне');
      // Изчистваме полетата при грешка
      setFormData({
        month: new Date().toISOString().slice(0, 7),
        amount: '',
        category: 'rent',
        description: '',
      });
      setTimeout(() => monthInputRef.current?.focus(), 100);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/manual-incomes/${deleteConfirm}`);
      toast.success('Приходът е изтрит');
      setDeleteConfirm(null);
      const res = await api.get('/manual-incomes');
      setIncomes(res.data);
    } catch {
      toast.error('Грешка при изтриване');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content expenses-modal-content" ref={modalRef}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <h2 className="expenses-title">Приходи (Наеми и други)</h2>

          {loading ? (
            <Spinner size="small" />
          ) : (
            <>
              {incomes.length === 0 ? (
                <p className="no-payments">Няма записани приходи</p>
              ) : (
                <table className="manual-incomes-table">
                  <thead>
                    <tr>
                      <th>Месец</th>
                      <th>Сума</th>
                      <th>Категория</th>
                      <th>Описание</th>
                      <th>Изтрий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomes.map((inc) => (
                      <tr key={inc.id}>
                        <td>{monthLabel(inc.month)}</td>
                        <td className="text-right expense-row">{parseFloat(inc.amount).toFixed(2)} €</td>
                        <td className="text-center">
                          {inc.category === 'rent' ? 'Наем' : 'Друго'}
                        </td>
                        <td title={inc.description || ''}>{inc.description || '—'}</td>
                        <td className="text-center">
                          <button className="delete-other-btn" onClick={() => setDeleteConfirm(inc.id)}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!showForm ? (
                <button className="add-other-btn" onClick={() => setShowForm(true)}>
                  + Добави приход
                </button>
              ) : (
                <div className="expenses-add-form">
                  <div className="expenses-form-row">
                    <label>Месец:</label>
                    <input
                      type="month"
                      ref={monthInputRef}
                      value={formData.month}
                      onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    />
                  </div>
                  <div className="expenses-form-row">
                    <label>Сума (€):</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.amount}
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                        if (val === '.') val = '';
                        setFormData({ ...formData, amount: val });
                      }}
                      onBlur={(e) => {
                        const num = parseFloat(e.target.value);
                        if (!isNaN(num)) setFormData({ ...formData, amount: num.toFixed(2) });
                        else setFormData({ ...formData, amount: '' });
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="expenses-form-row">
                    <label>Категория:</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="rent">Наем</option>
                      <option value="other">Друго</option>
                    </select>
                  </div>
                  <div className="expenses-form-row">
                    <label>Описание:</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Въведете описание"
                    />
                  </div>
                  <div className="add-other-actions">
                    <button className="cancel-btn" onClick={() => setShowForm(false)} disabled={saving}>
                      Отказ
                    </button>
                    <button className="save-btn" onClick={handleSave} disabled={saving}>
                      {saving ? 'Запазване...' : 'Запази'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="modal-actions">
            <button className="close-btn" onClick={onClose}>Затвори</button>
          </div>

          {deleteConfirm && (
            <ConfirmModal
              title="Изтриване на приход"
              message="Сигурни ли сте, че искате да изтриете този приход?"
              confirmText="Да, изтрий"
              cancelText="Отказ"
              confirmColor="danger"
              onConfirm={handleDelete}
              onCancel={() => setDeleteConfirm(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}