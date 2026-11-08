import { useState, useEffect } from 'react';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import { monthLabel } from './i18n/translate.js';
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
    <div className="modal-overlay monthly-report-overlay" style={{ zIndex: 3000 }}> {/* Тук оставяме само zIndex, защото е специфичен */}
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
                  newMonth = selectedMonth.split('-')[1]; // запазваме месеца
                } else if (parseInt(newYear) === currentYear && startMonth) {
                  // Ако се връщаме на текущата година, задаваме startMonth (октомври)
                  newMonth = startMonth.split('-')[1];
                } else {
                  // Ако отиваме на друга година, задаваме януари
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
          <h2 className="report-title">МЕСЕЧЕН ОТЧЕТ</h2>
          <p className="report-month">{monthLabel(data.month)}</p>

          <div className="report-section">
            <p><strong>Общо апартаменти:</strong> {data.total_apartments}</p>
            <p><strong>Платили месечна такса:</strong> {data.paid_monthly}</p>
            <p><strong>Неплатили:</strong> {data.unpaid_monthly}</p>
            {data.other_paid_count > 0 && (
              <p><strong>Платени доп. разходи:</strong> {data.other_paid_count} бр.</p>
            )}
          </div>

          <h3 className="report-subtitle">ПРИХОДИ ПО ПЕРА (платени)</h3>
          <div className="report-section">
            <p>Асансьорна такса: <span className="amount">{data.income.elevator_fee} €</span></p>
            <p>Асансьорен ток: <span className="amount">{data.income.elevator_power} €</span></p>
            <p>Общ ток: <span className="amount">{data.income.general_power} €</span></p>
            <p>Фонд Р.О.: <span className="amount">{data.income.fund_ro} €</span></p>
            <p>Дом. сис.: <span className="amount">{data.income.intercom} €</span></p>
            <p>Хонорар: <span className="amount">{data.income.manager_fee} €</span></p>
            {parseFloat(data.income.other_paid) > 0 && (
              <p>Други разходи: <span className="amount">{data.income.other_paid} €</span></p>
            )}
            <p className="report-total">Общо приходи: <span className="amount">{data.income.total} €</span></p>
          </div>

          <h3 className="report-subtitle">РАЗПРЕДЕЛЕНИЕ</h3>
          <div className="report-section">
            <p>В касата на блока (без хонорар): <span className="amount">{data.to_fund} €</span></p>
            {parseFloat(data.income.other_paid) > 0 && (
              <p>Други разходи (в касата): <span className="amount">{data.income.other_paid} €</span></p>
            )}
            <p className="report-total">Общо в касата: <span className="amount">{data.balance} €</span></p>
          </div>
          <h3 className="report-subtitle">САЛДО</h3>
          <div className="report-section">
            <p>Салдо от предходния месец: <span className="amount">{data.prev_balance} €</span></p>
            <p>Приходи за месеца (в касата): <span className="amount">{data.to_fund} €</span></p>
            {parseFloat(data.income.other_paid) > 0 && (
              <p>Други приходи: <span className="amount">{data.income.other_paid} €</span></p>
            )}
            <p>Разходи за месеца: <span className="amount">{data.expenses.total} €</span></p>
            <p className="report-total">Салдо към края на месеца: <span className="amount">{data.balance} €</span></p>
          </div>
          <h3 className="report-subtitle">РАЗХОДИ</h3>
          <div className="report-section">
            {data.expenses.by_type.length === 0 ? (
              <p>Няма разходи за този месец.</p>
            ) : (
              <>
                {data.expenses.by_type.map((e, idx) => (
                  <p key={idx}>
                    {e.type === 'other' ? 'Други разходи' : e.type}: <span className="amount">{e.total} €</span>
                  </p>
                ))}
                <p className="report-total">Общо разходи: <span className="amount">{data.expenses.total} €</span></p>
              </>
            )}
          </div>

          <h3 className="report-subtitle">НЕПЛАТЕНИ</h3>
          <div className="report-section">
            <p>Неплатени месечни такси: <span className="amount">{data.unpaid.monthly} €</span></p>
            {parseFloat(data.unpaid.other) > 0 && (
              <p>Неплатени други разходи: <span className="amount">{data.unpaid.other} €</span></p>
            )}
            <p className="report-total">Общо неплатено: <span className="amount">{data.unpaid.total} €</span></p>
          </div>

          <p className="report-date">Дата на отчета: {new Date().toLocaleDateString('bg-BG')}</p>
        </div>
      </div>
    </div>
  );
}