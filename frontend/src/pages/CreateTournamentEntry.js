// frontend/src/pages/CreateTournamentEntry.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import ModeSelector from './create-tournament/components/ModeSelector';
import CreateTournamentWizard from './create-tournament/CreateTournamentWizard';
import CreateTournamentManual from './create-tournament/CreateTournamentManual';
import DraftRecoveryModal from './create-tournament/components/DraftRecoveryModal';
import './create-tournament/styles/CreateTournamentEntry.css';

/**
 * Точка входа для создания турнира
 * Позволяет пользователю выбрать между Wizard и ручной настройкой
 * Проверяет наличие сохраненного черновика
 */
function CreateTournamentEntry() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState(null); // null | 'wizard' | 'manual'
  const [savedDraft, setSavedDraft] = useState(null); // Найденный черновик
  const [showDraftModal, setShowDraftModal] = useState(false); // Показывать модалку
  const [checkingDraft, setCheckingDraft] = useState(true); // Проверка черновика
  const [draftToLoad, setDraftToLoad] = useState(null); // Черновик для загрузки в Wizard

  // Проверка наличия сохраненного черновика
  useEffect(() => {
    const checkForDraft = async () => {
      if (!user) {
        setCheckingDraft(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setCheckingDraft(false);
          return;
        }

        const response = await axios.get('/api/tournaments/drafts', {
          headers: { Authorization: `Bearer ${token}` }
        });

        const drafts = response.data.drafts || [];
        
        if (drafts.length > 0) {
          // Берем последний сохраненный черновик
          const latestDraft = drafts[0];
          setSavedDraft(latestDraft);
          setShowDraftModal(true);
          console.log('📋 Найден сохраненный черновик:', latestDraft);
        }
      } catch (error) {
        console.error('❌ Ошибка проверки черновика:', error);
      } finally {
        setCheckingDraft(false);
      }
    };

    if (!authLoading && user) {
      checkForDraft();
    } else {
      setCheckingDraft(false);
    }
  }, [user, authLoading]);

  // Проверка верификации
  const getVerificationStatus = () => {
    if (!user) return { canCreate: false, reason: 'not_logged_in' };
    if (!user.email) return { canCreate: false, reason: 'no_email' };
    if (!user.is_verified) return { canCreate: false, reason: 'not_verified' };
    return { canCreate: true, reason: 'verified' };
  };

  // Восстановление черновика
  const handleRestoreDraft = () => {
    setDraftToLoad(savedDraft);
    setShowDraftModal(false);
    setMode('wizard'); // Открываем Wizard с черновиком
  };

  // Удаление черновика
  const handleDeleteDraft = async () => {
    if (!window.confirm('Вы уверены? Все несохраненные данные будут удалены.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/tournaments/drafts/${savedDraft.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('🗑️ Черновик удален');
      setSavedDraft(null);
      setShowDraftModal(false);
    } catch (error) {
      console.error('❌ Ошибка удаления черновика:', error);
      alert('Ошибка удаления черновика');
    }
  };

  // Начать создание нового (игнорировать черновик)
  const handleStartNew = () => {
    setShowDraftModal(false);
    // Не удаляем черновик, просто закрываем модалку
  };

  // Отображение загрузки
  if (authLoading || checkingDraft) {
    return (
      <div className="create-tournament-entry loading">
        <div className="loading-spinner"></div>
        <p>{authLoading ? 'Проверка авторизации...' : 'Проверка черновиков...'}</p>
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
      {/* Модалка восстановления черновика */}
      {showDraftModal && savedDraft && (
        <DraftRecoveryModal
          draft={savedDraft}
          onRestore={handleRestoreDraft}
          onDelete={handleDeleteDraft}
          onCancel={handleStartNew}
        />
      )}

      {mode === 'wizard' && (
        <CreateTournamentWizard 
          onBack={() => setMode(null)} 
          initialDraft={draftToLoad} // 🆕 Передаем черновик для восстановления
        />
      )}
      {mode === 'manual' && <CreateTournamentManual onBack={() => setMode(null)} />}
    </div>
  );
}

export default CreateTournamentEntry;

