// frontend/src/pages/create-tournament/components/AutoSaveIndicator.js
import React from 'react';
import '../styles/AutoSaveIndicator.css';

/**
 * Индикатор автосохранения черновика
 * Показывает статус: сохранение / сохранено / ошибка
 */
function AutoSaveIndicator({ status, lastSavedAt }) {
  // status: 'idle' | 'saving' | 'saved' | 'error'

  if (status === 'idle') {
    return null; // Ничего не показываем в начале
  }

  // Форматирование времени последнего сохранения
  const formatLastSaved = () => {
    if (!lastSavedAt) return '';
    
    const now = new Date();
    const saved = new Date(lastSavedAt);
    const diffSeconds = Math.floor((now - saved) / 1000);
    
    if (diffSeconds < 5) return 'только что';
    if (diffSeconds < 60) return `${diffSeconds} сек назад`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} мин назад`;
    
    return saved.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`autosave-indicator ${status}`}>
      {status === 'saving' && (
        <>
          <div className="spinner"></div>
          <span className="indicator-text">Сохранение...</span>
        </>
      )}
      
      {status === 'saved' && (
        <>
          <div className="checkmark">✓</div>
          <span className="indicator-text">
            Сохранено {formatLastSaved()}
          </span>
        </>
      )}
      
      {status === 'error' && (
        <>
          <div className="error-icon">⚠️</div>
          <span className="indicator-text">Ошибка сохранения</span>
        </>
      )}
    </div>
  );
}

export default AutoSaveIndicator;

