import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api.js';
import { useAuth } from '../useAuth.js';
import Spinner from '../components/Spinner.jsx';
import ApartmentModal from '../components/ApartmentModal.jsx';
import { monthLabel } from '../components/i18n/translate.js';
import BulkPaymentModal from '../components/BulkPaymentModal.jsx';
import ProfileModal from '../components/ProfileModal.jsx';
import HelpModal from '../components/HelpModal.jsx';
import PrintMonthlyReport from '../components/PrintMonthlyReport.jsx';
import './Dashboard.css';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [startMonth, setStartMonth] = useState('');
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const loadApartments = async () => {
      try {
        const response = await api.get('/apartments');
        setApartments(response.data);
      } catch (err) {
        const message = err.response?.data?.error || 'Грешка при зареждане';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    loadApartments();
  }, []);
  useEffect(() => {
    const loadStartMonth = async () => {
      try {
        const response = await api.get('/settings');
        setStartMonth(response.data.start_month || '');
      } catch (err) {
        console.error('Грешка при зареждане на start_month:', err);
      }
    };
    loadStartMonth();
  }, []);
  const handleLogout = () => {
    logout();
    toast.success('Излязохте успешно');
    navigate('/login');
  };
  const getPreviousMonth = () => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();

    if (month === 0) {
      month = 12;
      year -= 1;
    }

    return `${year}-${String(month).padStart(2, '0')}`;
  };
  const filteredApartments = apartments.filter((apt) => {
    // Филтър по етаж
    if (floorFilter && apt.floor !== parseInt(floorFilter, 10)) {
      return false;
    }
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;

    // Ако търсенето е само цифри – точно съвпадение с номера
    if (/^\d+$/.test(term)) {
      return apt.number === parseInt(term, 10);
    }

    // Иначе – частично съвпадение с име
    const nameMatch = (apt.owner_name || '').toLowerCase().includes(term);
    return nameMatch;
  });
  const clearFilters = () => {
    setSearchTerm('');
    setFloorFilter('');
  };
  return (
    <div className="dashboard admin-dashboard">
      <header>
        <h1>Панел на домоуправителя</h1>
        <div>
          <span className='hello-admin'>Здравей, {user?.username}!</span>
          <button
            className="help-btn"
            onClick={() => setShowHelp(true)}
            title="Помощ"
          >
            Помощ
          </button>
          <button
            className="change-username-btn"
            onClick={() => setShowProfile(true)}
            title="Профил"
          >
            Профил
          </button>

          <button onClick={handleLogout} title="Изход от системата">
            Изход
          </button>
        </div>
      </header>

      <main>
        <div className='main-header'>
          <h2>Апартаменти</h2>
          <p className={`results-info ...`}>...</p>
          {startMonth && (
            <div className="start-month-info">
              Следим от: <strong>{monthLabel(startMonth)}</strong>
            </div>
          )}
          <button
            type="button"
            className="report-btn"
            onClick={() => setShowMonthlyReport(true)}
            title="Месечен отчет"
          >
            📊<span className="btn-text"> Месечен отчет</span>
          </button>
        </div>
        <div className="filters-row">
          <input
            type="text"
            placeholder="Търсене по номер или име..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="floor-select"
          >
            <option value="">Всички етажи</option>
            {Array.from({ length: 15 }, (_, i) => i + 1).map((f) => (
              <option key={f} value={f}>Етаж {f}</option>
            ))}
          </select>
          {(floorFilter || searchTerm) && (
            <button
              type="button"
              onClick={clearFilters}
              className="clear-filters-btn"
            >
              Изчисти филтрите
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            className="bulk-btn"
            title="Бързо въвеждане на плащания"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="#f39c12"
            >
              <path d="M7 2h9l-2 7h5l-9 13h-1l1.5-9H5l3-11z" />
            </svg>
            Бързо въвеждане
          </button>
        </div>
        {!loading && searchTerm && filteredApartments.length === 0 && (
          <div className="no-results">Няма намерени апартаменти</div>
        )}
        {loading ? (
          <Spinner />
        ) : (
          <div className="table-wrapper">
            <table className="apartments-table">
              <thead>
                <tr>
                  <th>Ап.№</th>
                  <th>Етаж</th>
                  <th>Собственик</th>
                  <th>Телефон</th>
                </tr>
              </thead>
              <tbody>
                {filteredApartments.map((apt) => (
                  <tr
                    key={apt.id}
                    onClick={() => setSelectedApartment(apt)}
                    className="clickable-row"
                    title="Кликнете за подробности"
                  >
                    <td><strong>{apt.number}</strong></td>
                    <td>{apt.floor}</td>
                    <td>{apt.owner_name || '—'}</td>
                    <td>{apt.phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selectedApartment && (
          <ApartmentModal
            apartment={selectedApartment}
            onClose={() => setSelectedApartment(null)}
            onUpdate={(updatedApartment) => {
              // Обнови selectedApartment
              setSelectedApartment(updatedApartment);
              // Обнови и в списъка с апартаменти
              setApartments((prev) =>
                prev.map((a) => (a.id === updatedApartment.id ? updatedApartment : a))
              );
            }}
          />
        )}
        {showBulkModal && (
          <BulkPaymentModal onClose={() => setShowBulkModal(false)} />
        )}
        {showProfile && (
          <ProfileModal onClose={() => setShowProfile(false)} />
        )}
        {showHelp && (
          <HelpModal onClose={() => setShowHelp(false)} />
        )}
        {showMonthlyReport && (
          <PrintMonthlyReport
            month={getPreviousMonth()}
            onClose={() => setShowMonthlyReport(false)}
          />
        )}
      </main>
    </div>
  );
}