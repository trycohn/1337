// frontend/src/pages/create-tournament/components/steps/Step4_Rules.js
import React from 'react';

/**
 * Шаг 4: Правила и настройки матчей
 * TODO: Добавить выбор карт для CS2
 */
function Step4_Rules({ data, format, basicInfo, onChange }) {
  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const isCS2 = basicInfo.game === 'counter strike 2';

  return (
    <div className="wizard-step step-rules">
      <div className="step-header">
        <h2>📜 Правила и настройки</h2>
        <p className="step-description">
          Дополнительные правила и конфигурация матчей
        </p>
      </div>

      <div className="step-section">
        <h3>Правила турнира</h3>
        
        <div className="form-group">
          <label>Правила (необязательно)</label>
          <textarea
            placeholder="Основные правила и условия участия..."
            value={data.rules || ''}
            onChange={(e) => handleChange('rules', e.target.value)}
            rows="5"
          />
          <small className="form-hint">
            Укажите правила турнира, требования к участникам, штрафы и т.д.
          </small>
        </div>

        <div className="form-group">
          <label>Распределение участников</label>
          <select
            value={data.seeding_type || 'random'}
            onChange={(e) => handleChange('seeding_type', e.target.value)}
          >
            <option value="random">Случайное</option>
            <option value="rating">По рейтингу</option>
            <option value="balanced">Сбалансированное</option>
          </select>
        </div>
      </div>

      {/* Настройки лобби для CS2 */}
      {isCS2 && (
        <div className="step-section">
          <h3>Настройки лобби CS2</h3>
          
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={data.lobby_enabled || false}
                onChange={(e) => handleChange('lobby_enabled', e.target.checked)}
              />
              <span>Включить лобби матча с выбором карт</span>
            </label>
            <small className="form-hint">
              Участники смогут выбирать и банить карты перед началом матча
            </small>
          </div>

          {data.lobby_enabled && (
            <>
              <div className="form-group">
                <label>Формат матчей по умолчанию</label>
                <select
                  value={data.lobby_match_format || ''}
                  onChange={(e) => handleChange('lobby_match_format', e.target.value)}
                >
                  <option value="">Выбор в лобби</option>
                  <option value="bo1">Best of 1</option>
                  <option value="bo3">Best of 3</option>
                  <option value="bo5">Best of 5</option>
                </select>
              </div>

              <div className="form-group">
                <p><strong>Карты турнира:</strong></p>
                <div style={{ color: '#888', fontSize: '14px', marginTop: '10px' }}>
                  🚧 Выбор карт будет добавлен в следующей итерации
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default Step4_Rules;

