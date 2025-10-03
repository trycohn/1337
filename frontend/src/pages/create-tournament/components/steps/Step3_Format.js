// frontend/src/pages/create-tournament/components/steps/Step3_Format.js
import React from 'react';

/**
 * Шаг 3: Формат турнира
 * TODO: Портировать логику форматов из CreateTournament.js
 */
function Step3_Format({ data, basicInfo, onChange }) {
  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const isCS2 = basicInfo.game === 'counter strike 2';

  return (
    <div className="wizard-step step-format">
      <div className="step-header">
        <h2>🎯 Формат турнира</h2>
        <p className="step-description">
          Настройте формат и правила участия
        </p>
      </div>

      <div className="step-section">
        <h3>Тип турнира</h3>
        
        <div className="form-group">
          <label>Формат *</label>
          <select
            value={data.format || ''}
            onChange={(e) => handleChange('format', e.target.value)}
            required
          >
            <option value="">Выберите формат</option>
            <option value="single">Single Elimination</option>
            <option value="double">Double Elimination</option>
            <option value="mix">Mix (Автоформирование команд)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Тип сетки *</label>
          <select
            value={data.bracket_type || 'single_elimination'}
            onChange={(e) => handleChange('bracket_type', e.target.value)}
            required
          >
            <option value="single_elimination">Single Elimination</option>
            <option value="double_elimination">Double Elimination</option>
            {data.format === 'mix' && (
              <option value="swiss">Swiss System</option>
            )}
          </select>
        </div>

        <div className="form-group">
          <label>Тип участников *</label>
          <select
            value={data.participant_type || 'team'}
            onChange={(e) => handleChange('participant_type', e.target.value)}
            required
          >
            <option value="team">Командный</option>
            <option value="solo">Индивидуальный</option>
            {isCS2 && (
              <>
                <option value="cs2_5v5">CS2 Classic 5v5</option>
                <option value="cs2_2v2">CS2 Wingman 2v2</option>
              </>
            )}
          </select>
        </div>

        <div className="form-group">
          <label>Размер команды *</label>
          <input
            type="number"
            min="1"
            max="10"
            value={data.team_size || 5}
            onChange={(e) => handleChange('team_size', parseInt(e.target.value, 10))}
            required
          />
        </div>

        <div className="form-group">
          <label>Максимум участников *</label>
          <select
            value={data.max_teams || 16}
            onChange={(e) => handleChange('max_teams', parseInt(e.target.value, 10))}
            required
          >
            <option value="4">4 команды</option>
            <option value="8">8 команд</option>
            <option value="16">16 команд</option>
            <option value="32">32 команды</option>
            <option value="64">64 команды</option>
          </select>
        </div>
      </div>

      {/* Mix специфичные настройки */}
      {data.format === 'mix' && (
        <div className="step-section">
          <h3>Настройки MIX турнира</h3>
          
          <div className="form-group">
            <label>Тип микса</label>
            <select
              value={data.mix_type || 'classic'}
              onChange={(e) => handleChange('mix_type', e.target.value)}
            >
              <option value="classic">Классический (формирование 1 раз)</option>
              <option value="full">Full MIX (после каждого раунда)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Формирование команд</label>
            <select
              value={data.mix_rating_type || 'faceit'}
              onChange={(e) => handleChange('mix_rating_type', e.target.value)}
            >
              <option value="faceit">По рейтингу FACEIT</option>
              <option value="premier">По рангу CS2 Premier</option>
              <option value="mixed">Случайное</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default Step3_Format;

