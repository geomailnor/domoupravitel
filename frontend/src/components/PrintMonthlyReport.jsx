import { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import api from '../api.js';
import Spinner from './Spinner.jsx';
import { monthLabel } from './i18n/translate.js';
import './PrintMonthlyReport.css';

export default function PrintMonthlyReport({ month, onClose }) {
  const modalRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(month);
  useFocusTrap(modalRef, !loading);

  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    document.body.classList.add('printing-monthly-report');
    return () => document.body.classList.remove('printing-monthly-report');
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

  if (loading) {
    return (
      <div className="print-overlay monthly-report-overlay" ref={modalRef}>
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="print-overlay monthly-report-overlay" ref={modalRef}>
        <p>Грешка при зареждане</p>
        <button onClick={onClose}>Затвори</button>
      </div>
    );
  }

  const handlePrint = () => window.print();

  return (
    <div className="print-overlay monthly-report-overlay" ref={modalRef}>
      <div className="print-controls">
        <label className="month-picker">
          Месец:
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </label>
        <button className="btn-print" onClick={handlePrint}>🖨️ Разпечатай</button>
        <button className="btn-close" onClick={onClose}>✕ Затвори</button>
      </div>

      <div className="print-area-monthly">
        <div className="monthly-report">
          <h2 className="report-title">МЕСЕЧЕН ОТЧЕТ</h2>
          <p className="report-month">{monthLabel(data.month)}</p>

          <div className="report-section">
            <p><strong>Общо апартаменти:</strong> {data.total_apartments}</p>
            <p><strong>Платили месечна такса:</strong> {data.paid_monthly}</p>
            <p><strong>Платили частично:</strong> {data.partial_monthly}</p>
            <p><strong>Неплатили:</strong> {data.unpaid_monthly}</p>
          </div>

          <h3 className="report-subtitle report-section-title">
            ГОДИШНИ ПРИХОДИ
            {data.start_month && data.month.split('-')[0] === data.start_month.split('-')[0] && (
              <span className="report-note"> (от {monthLabel(data.start_month)})</span>
            )}
          </h3>
          <div className="report-section">
            <p>Месечни такси: <span className="amount">{data.income.total_paid} €</span></p>
            <p>Допълнителни приходи: <span className="amount">{data.income.additional_total} €</span></p>
            <p className="report-total">Общо приходи: <span className="amount">{(parseFloat(data.income.total_paid) + parseFloat(data.income.additional_total)).toFixed(2)} €</span></p>
          </div>

          <h3 className="report-subtitle">РАЗПРЕДЕЛЕНИЕ</h3>
          <div className="report-section">
            <p>Домоуправител: <span className="amount">{data.manager_pay} €</span></p>
            <p>В касата на блока: <span className="amount">{data.to_fund} €</span></p>
          </div>

          {/* НОВ ВТОРИ ХЕДЪР */}
          <h3 className="report-subtitle report-section-title">
            СТАТИСТИКА
          </h3>
          <p className="report-note report-period">
            от {monthLabel(data.start_month).split(' ')[0]} до {monthLabel(data.month).split(' ')[0]} {data.month.split('-')[0]}
          </p>

          <div className="report-section">
            <p className="report-stat-row">
              <span>Неплатени месечни такси ({data.unpaid_months_count_year} бр.):</span>
              <span className="amount">{data.unpaid_months_due_year} €</span>
            </p>

            {data.partial_months_count_year > 0 && (
              <p className="report-stat-row">
                <span>Частично неплатени месеци ({data.partial_months_count_year} бр.):</span>
                <span className="amount">{data.partial_due_year} €</span>
              </p>
            )}

            {data.other_count_year > 0 && (
              <p className="report-stat-row">
                <span>Неплатени доп. разходи ({data.other_count_year} бр.):</span>
                <span className="amount">{data.other_due_year} €</span>
              </p>
            )}

            <p className="report-total-unpaid">
              <strong>Общ дълг към момента: {data.total_unpaid_year} €</strong>
            </p>
          </div>
          <p className="report-date">Дата на отчета: {new Date().toLocaleDateString('bg-BG')}</p>
        </div>
      </div>
    </div>
  );
}