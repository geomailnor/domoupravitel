import { useState, useEffect } from 'react';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import { monthLabel, expenseCategoryLabel } from './i18n/translate.js';
import { useScrollLock } from '../hooks/useScrollLock.js';
import './PrintMonthlyReport.css';

export default function PrintMonthlyReport({ month, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [startMonth, setStartMonth] = useState('');

  useScrollLock();

  // 1. Зареждане на startMonth
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get('/settings');
        setStartMonth(res.data.start_month || '');
      } catch {
        // игнорираме
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/reports/monthly?month=${selectedMonth}`);
        setData(response.data);
      } catch (err) {
        console.error('Грешка при зареждане на отчета', err);
      } finally {
        setLoading(false);
      }
    };
    loadReport();
  }, [selectedMonth]);

  // За печат – скриваме контролите
  useEffect(() => {
    document.body.classList.add('printing-monthly-report');
    return () => document.body.classList.remove('printing-monthly-report');
  }, []);

  if (loading) {
    return (
      <div className="modal-overlay" style={{ zIndex: 3000 }}>
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="modal-overlay" style={{ zIndex: 3000 }}>
        <div className="modal-content" style={{ maxWidth: '400px', padding: '2rem' }}>
          <p>Грешка при зареждане</p>
          <button className="close-btn" onClick={onClose}>Затвори</button>
        </div>
      </div>
    );
  }

  const generateYears = () => {
    if (!startMonth) return [];
    const startYear = parseInt(startMonth.split('-')[0], 10);
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = startYear; y <= currentYear; y++) {
      years.push(y);
    }
    return years;
  };

  const getAvailableMonths = () => {
    const currentYear = selectedMonth.split('-')[0];
    const startYear = startMonth ? startMonth.split('-')[0] : null;
    const startMonthNum = startMonth ? startMonth.split('-')[1] : null;
    const now = new Date();
    const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');

    const months = [
      { value: '01', label: 'Яну.' },
      { value: '02', label: 'Фев.' },
      { value: '03', label: 'Март' },
      { value: '04', label: 'Апр.' },
      { value: '05', label: 'Май' },
      { value: '06', label: 'Юни' },
      { value: '07', label: 'Юли' },
      { value: '08', label: 'Авг.' },
      { value: '09', label: 'Сеп.' },
      { value: '10', label: 'Окт.' },
      { value: '11', label: 'Ное.' },
      { value: '12', label: 'Дек.' },
    ];

    let filtered = months;
    if (currentYear === startYear) {
      filtered = filtered.filter(m => m.value >= startMonthNum);
    }
    if (currentYear === String(now.getFullYear())) {
      filtered = filtered.filter(m => m.value <= currentMonthNum);
    }
    return filtered;
  };

  return (
    <div className="modal-overlay monthly-report-overlay" style={{ zIndex: 3000 }}>
      <div className="print-controls">
        <div className="month-picker">
          <label>
            Година:
            <select
              value={selectedMonth.split('-')[0]}
              onChange={(e) => {
                const newYear = e.target.value;
                const currentYear = new Date().getFullYear();
                const oldYear = selectedMonth.split('-')[0];

                let newMonth;
                if (newYear === oldYear) {
                  newMonth = selectedMonth.split('-')[1];
                } else if (parseInt(newYear) === currentYear && startMonth) {
                  newMonth = startMonth.split('-')[1];
                } else {
                  newMonth = '01';
                }
                setSelectedMonth(`${newYear}-${newMonth}`);
              }}
            >
              {generateYears().map(year => (
                <option key={year} value={year}>{year} г.</option>
              ))}
            </select>
          </label>
          <label>
            Месец:
            <select
              value={selectedMonth.split('-')[1]}
              onChange={(e) => {
                const currentYear = selectedMonth.split('-')[0];
                setSelectedMonth(`${currentYear}-${e.target.value}`);
              }}
            >
              {getAvailableMonths().map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
        </div>
        <button className="save-btn" onClick={() => window.print()}>🖨️ Разпечатай</button>
        <button className="cancel-btn close-report-btn" onClick={onClose}>✕ Затвори</button>
      </div>

      <div className="modal-content monthly-report-content print-area-monthly">
        <div className="modal-body">
          <h2 className="report-title">МЕСЕЧЕН ОТЧЕТ за блока</h2>
          <p className="report-month">{monthLabel(data.month)}</p>

          {/* Статистика */}
          <div className="report-section report-spaced-lines">
            <p><strong>Общо апартаменти:</strong> {data.stats.total}</p>
            <p><strong>Платили месечна такса:</strong> {data.stats.paid}</p>
            <p><strong>Неплатили:</strong> {data.stats.unpaid}</p>
          </div>

          {/* КАСА 1 */}
          <h3 className="report-subtitle kasa1">КАСА 1 (ПОДДРЪЖКА)</h3>
          <table className="report-table">
            <tbody>
              <tr><td>Салдо от предходен месец:</td><td className="amount">{data.k1.prev_balance} €</td></tr>
              <tr><td colSpan="2"><strong>Приходи:</strong></td></tr>
              <tr><td className="indent">Асансьорна такса:</td><td className="amount">{data.k1.income.elevator_fee} €</td></tr>
              <tr><td className="indent">Ток асансьор:</td><td className="amount">{data.k1.income.elevator_power} €</td></tr>
              <tr><td className="indent">Общ ток:</td><td className="amount">{data.k1.income.general_power} €</td></tr>
              <tr><td className="indent">Дом. сис.:</td><td className="amount">{data.k1.income.intercom} €</td></tr>
              <tr><td className="indent">Хонорар:</td><td className="amount">{data.k1.income.manager_fee} €</td></tr>
              <tr className="total-row"><td>Общо приходи:</td><td className="amount">{data.k1.income.total} €</td></tr>

              <tr><td colSpan="2"><strong>Разходи:</strong></td></tr>
              {Object.entries(
                Object.entries(data.k1.expenses.by_category).reduce((acc, [cat, amt]) => {
                  // Обединяваме 'other' и 'null' в общ ключ 'other'
                  const key = (cat === 'null' || cat === 'other') ? 'other' : cat;
                  acc[key] = (acc[key] || 0) + Number(amt);
                  return acc;
                }, {})
              ).map(([cat, amt]) => (
                <tr key={cat}>
                  <td className="indent">{expenseCategoryLabel(cat)}:</td>
                  <td className="amount">{Number(amt).toFixed(2)} €</td>
                </tr>
              ))}
              <tr className="total-row"><td>Общо разходи:</td><td className="amount">{data.k1.expenses.total} €</td></tr>
              <tr className="total-row highlight"><td>Остатък за следващ месец (К1):</td><td className="amount">{data.k1.balance} €</td></tr>
            </tbody>
          </table>

          {/* КАСА 2 */}
          <h3 className="report-subtitle kasa2" style={{ marginTop: '2rem' }}>КАСА 2 (РЕМОНТИ)</h3>
          <table className="report-table">
            <tbody>
              <tr><td>Салдо от предходен месец:</td><td className="amount">{data.k2.prev_balance} €</td></tr>
              <tr><td colSpan="2"><strong>Приходи:</strong></td></tr>
              <tr><td className="indent">Фонд Р.О.:</td><td className="amount">{data.k2.income.fund_ro} €</td></tr>
              <tr><td className="indent">От наеми:</td><td className="amount">{data.k2.income.manual} €</td></tr>
              <tr><td className="indent">От допълнителни такси:</td><td className="amount">{data.k2.income.other} €</td></tr>
              <tr className="total-row"><td>Общо приходи:</td><td className="amount">{data.k2.income.total} €</td></tr>

              <tr><td colSpan="2"><strong>Разходи:</strong></td></tr>
              {Object.entries(
                Object.entries(data.k2.expenses.by_category).reduce((acc, [cat, amt]) => {
                  const key = (cat === 'null' || cat === 'other') ? 'other' : cat;
                  acc[key] = (acc[key] || 0) + Number(amt);
                  return acc;
                }, {})
              ).map(([cat, amt]) => (
                <tr key={cat}>
                  <td className="indent">{expenseCategoryLabel(cat)}:</td>
                  <td className="amount">{Number(amt).toFixed(2)} €</td>
                </tr>
              ))}
              <tr className="total-row"><td>Общо разходи:</td><td className="amount">{data.k2.expenses.total} €</td></tr>
              <tr className="total-row highlight"><td>Остатък за следващ месец (К2):</td><td className="amount">{data.k2.balance} €</td></tr>
            </tbody>
          </table>

          {/* Неплатени */}
          <h3 className="report-subtitle" style={{ marginTop: '2rem' }}>НЕПЛАТЕНИ ЗА МЕСЕЦА</h3>
          <div className="report-section report-spaced-lines">
            <p>Неплатени месечни такси: <span className="amount">{data.unpaid.monthly} €</span></p>
            <p>Неплатени допълнителни такси: <span className="amount">{data.unpaid.other} €</span></p>
            <p className="report-total">Общо неплатено: <span className="amount">{data.unpaid.total} €</span></p>
          </div>

          <p className="report-date">Дата на отчета: {new Date().toLocaleDateString('bg-BG')}</p>
        </div>
      </div>
    </div>
  );
}