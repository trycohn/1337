// frontend/src/pages/create-tournament/components/DraftRecoveryModal.js
import React from 'react';
import '../styles/DraftRecoveryModal.css';

/**
 * Модалка восстановления сохраненного черновика
 */
function DraftRecoveryModal({ draft, onRestore, onDelete, onCancel }) {
  if (!draft) return null;

  // Форматирование даты последнего сохранения
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} минут назад`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} часов назад`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} дней назад`;
  };

  // Получение названия турнира из черновика
  const getDraftName = () => {
    return draft.draft_data?.basicInfo?.name || 
           draft.draft_name || 
           'Черновик турнира';
  };

  // Получение описания черновика
  const getDraftDescription = () => {
    const data = draft.draft_data;
    if (!data) return 'Нет данных';

    const parts = [];
    
    if (data.basicInfo?.game) {
      parts.push(data.basicInfo.game);
    }
    
    if (data.format?.format) {
      const formatNames = {
        single: 'Single Elimination',
        double: 'Double Elimination',
        mix: 'Mix'
      };
      parts.push(formatNames[data.format.format] || data.format.format);
    }
    
    if (data.format?.team_size) {
      parts.push(`${data.format.team_size}v${data.format.team_size}`);
    }
    
    return parts.join(' • ') || 'Черновик турнира';
  };

  return (
    <div className="modal-overlay draft-recovery-overlay">
      <div className="modal-content draft-recovery-modal">
        {/* Иконка */}
        <div className="draft-icon">💾</div>
        
        {/* Заголовок */}
        <h2 className="draft-title">Найден сохраненный черновик</h2>
        
        {/* Информация о черновике */}
        <div className="draft-info">
          <div className="draft-name">{getDraftName()}</div>
          <div className="draft-description">{getDraftDescription()}</div>
          <div className="draft-meta">
            <span className="draft-step">
              Шаг {draft.current_step || 1} из 6
            </span>
            <span className="draft-separator">•</span>
            <span className="draft-time">
              Сохранено {formatDate(draft.last_saved_at)}
            </span>
          </div>
        </div>

        {/* Подсказка */}
        <div className="draft-hint">
          Вы можете продолжить редактирование с того места, где остановились, 
          или начать создание нового турнира с нуля.
        </div>

        {/* Действия */}
        <div className="draft-actions">
          <button
            className="btn btn-primary draft-restore"
            onClick={onRestore}
          >
            ✓ Продолжить редактирование
          </button>
          
          <button
            className="btn btn-secondary draft-new"
            onClick={onCancel}
          >
            🆕 Создать новый турнир
          </button>
          
          <button
            className="btn-delete-draft"
            onClick={onDelete}
            title="Удалить черновик"
          >
            🗑️ Удалить черновик
          </button>
        </div>

        {/* Предупреждение об истечении */}
        {draft.expires_at && (
          <div className="draft-expiry">
            ⏰ Черновик будет автоматически удален{' '}
            {new Date(draft.expires_at).toLocaleDateString('ru-RU')}
          </div>
        )}
      </div>
    </div>
  );
}

export default DraftRecoveryModal;

