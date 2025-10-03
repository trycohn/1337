// frontend/src/pages/create-tournament/components/steps/Step2_BasicInfo.js
import React from 'react';

/**
 * Шаг 2: Базовая информация о турнире
 * TODO: Портировать поля из текущего CreateTournament.js
 */
function Step2_BasicInfo({ data, onChange }) {
  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="wizard-step step-basic-info">
      <div className="step-header">
        <h2>📝 Базовая информация</h2>
        <p className="step-description">
          Основные данные о вашем турнире
        </p>
      </div>

      <div className="step-section">
        <h3>Основное</h3>
        
        <div className="form-group">
          <label>Название турнира *</label>
          <input
            type="text"
            placeholder="Например: CS2 Winter Cup 2025"
            value={data.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Описание</label>
          <textarea
            placeholder="Краткое описание турнира..."
            value={data.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            rows="4"
          />
        </div>

        <div className="form-group">
          <label>Игра *</label>
          <select
            value={data.game || ''}
            onChange={(e) => handleChange('game', e.target.value)}
            required
          >
            <option value="">Выберите игру</option>
            <option value="counter strike 2">Counter-Strike 2</option>
            <option value="dota 2">Dota 2</option>
          </select>
          <small className="form-hint">Выберите дисциплину турнира</small>
        </div>

        <div className="form-group">
          <label>Дата начала *</label>
          <input
            type="datetime-local"
            value={data.start_date || ''}
            onChange={(e) => handleChange('start_date', e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Призовой фонд</label>
          <input
            type="text"
            placeholder="Например: 10,000₽"
            value={data.prize_pool || ''}
            onChange={(e) => handleChange('prize_pool', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Тип турнира</label>
          <select
            value={data.tournament_type || 'open'}
            onChange={(e) => handleChange('tournament_type', e.target.value)}
          >
            <option value="open">Открытый</option>
            <option value="closed">Закрытый (по приглашениям)</option>
            <option value="hidden">Скрытый</option>
            <option value="final">Финал серии</option>
          </select>
          <small className="form-hint">
            Открытый - свободная регистрация, Закрытый - только по приглашениям
          </small>
        </div>
      </div>
    </div>
  );
}

export default Step2_BasicInfo;

