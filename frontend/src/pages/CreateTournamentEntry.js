// frontend/src/pages/CreateTournamentEntry.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModeSelector from './create-tournament/components/ModeSelector';
import CreateTournamentWizard from './create-tournament/CreateTournamentWizard';
import CreateTournamentManual from './create-tournament/CreateTournamentManual';
import './create-tournament/styles/CreateTournamentEntry.css';

/**
 * Точка входа для создания турнира
 * Позволяет пользователю выбрать между Wizard и ручной настройкой
 */
function CreateTournamentEntry() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState(null); // null | 'wizard' | 'manual'

  // Проверка верификации
  const getVerificationStatus = () => {
    if (!user) return { canCreate: false, reason: 'not_logged_in' };
    if (!user.email) return { canCreate: false, reason: 'no_email' };
    if (!user.is_verified) return { canCreate: false, reason: 'not_verified' };
    return { canCreate: true, reason: 'verified' };
  };

  // Отображение загрузки
  if (authLoading) {
    return (
      <div className="create-tournament-entry loading">
        <div className="loading-spinner"></div>
        <p>Проверка авторизации...</p>
      </div>
    );
  }

  const verificationStatus = getVerificationStatus();

  // Если не прошел верификацию - показываем предупреждение
  if (!verificationStatus.canCreate) {
    return (
      <div className="create-tournament-entry">
        <div className="verification-warning">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <h2>Требуется верификация</h2>
            {verificationStatus.reason === 'not_logged_in' && (
              <>
                <p>Для создания турнира необходимо войти в систему или зарегистрироваться.</p>
                <button className="btn btn-primary" onClick={() => navigate('/register')}>
                  Войти / Регистрация
                </button>
              </>
            )}
            {verificationStatus.reason === 'no_email' && (
              <>
                <p>Для создания турниров необходимо привязать email к вашему аккаунту.</p>
                <button className="btn btn-primary" onClick={() => navigate('/profile')}>
                  Привязать email в профиле
                </button>
              </>
            )}
            {verificationStatus.reason === 'not_verified' && (
              <>
                <p>Ваш email <strong>{user.email}</strong> не подтвержден.</p>
                <button className="btn btn-primary" onClick={() => navigate('/profile')}>
                  Подтвердить email в профиле
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Выбор режима не сделан - показываем селектор
  if (!mode) {
    return (
      <div className="create-tournament-entry">
        <div className="entry-header">
          <h1>Создание турнира</h1>
          <p className="entry-subtitle">Выберите способ создания турнира</p>
        </div>
        <ModeSelector onSelect={setMode} />
      </div>
    );
  }

  // Режим выбран - показываем соответствующий компонент
  return (
    <div className="create-tournament-entry">
      {mode === 'wizard' && <CreateTournamentWizard onBack={() => setMode(null)} />}
      {mode === 'manual' && <CreateTournamentManual onBack={() => setMode(null)} />}
    </div>
  );
}

export default CreateTournamentEntry;

