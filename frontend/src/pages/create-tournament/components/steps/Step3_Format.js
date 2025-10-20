// frontend/src/pages/create-tournament/components/steps/Step3_Format.js
import React, { useEffect } from 'react';

/**
 * Шаг 3: Формат турнира
 * Улучшенная логика с автоматическим выбором типа сетки и правильными ограничениями
 */
function Step3_Format({ data, basicInfo, onChange }) {
  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const isCS2 = basicInfo.game === 'counter strike 2';
  const isMixFormat = data.format === 'mix';
  const isSingleOrDouble = data.format === 'single' || data.format === 'double';

  // 🆕 Автоматическая синхронизация bracket_type с format
  useEffect(() => {
    if (data.format === 'single' && data.bracket_type !== 'single_elimination') {
      onChange({ ...data, bracket_type: 'single_elimination' });
    } else if (data.format === 'double' && data.bracket_type !== 'double_elimination') {
      onChange({ ...data, bracket_type: 'double_elimination' });
    }
  }, [data.format, data.bracket_type, onChange, data]);

  // 🆕 Автоматическая установка participant_type для Mix
  useEffect(() => {
    if (isMixFormat && data.participant_type !== 'solo') {
      onChange({ ...data, participant_type: 'solo' });
    }
  }, [isMixFormat, data.participant_type, onChange, data]);

  // Обработчик изменения формата
  const handleFormatChange = (newFormat) => {
    const updates = { format: newFormat };
    
    // Автоматически устанавливаем bracket_type и participant_type
    if (newFormat === 'single') {
      updates.bracket_type = 'single_elimination';
      updates.participant_type = 'team'; // ✅ Всегда team для Single/Double
      updates.team_size = 5; // Дефолт 5v5
    } else if (newFormat === 'double') {
      updates.bracket_type = 'double_elimination';
      updates.participant_type = 'team'; // ✅ Всегда team для Single/Double
      updates.team_size = 5; // Дефолт 5v5
    } else if (newFormat === 'mix') {
      updates.bracket_type = 'swiss';
      updates.participant_type = 'solo'; // ✅ Solo только для Mix
      updates.team_size = 5;
      updates.mix_type = 'classic';
      updates.mix_rating_type = 'faceit';
    }
    
    onChange({ ...data, ...updates });
  };

  // Обработчик изменения размера команды через UI выбор режима CS2
  // Внутри хранит team_size, но показывает как "5х5" или "2х2"
  const handleCS2ModeChange = (mode) => {
    const updates = { 
      participant_type: 'team' // ✅ Остается team
    };
    
    if (mode === '5v5') {
      updates.team_size = 5;
    } else if (mode === '2v2') {
      updates.team_size = 2;
    }
    
    onChange({ ...data, ...updates });
  };

  // Определяем текущий CS2 режим на основе team_size
  const getCurrentCS2Mode = () => {
    if (data.participant_type !== 'team') return null;
    return data.team_size === 2 ? '2v2' : '5v5';
  };

  // Получение текста для bracket_type
  const getBracketTypeLabel = () => {
    if (data.format === 'single') return 'Single Elimination (автоматически)';
    if (data.format === 'double') return 'Double Elimination (автоматически)';
    return 'Выберите тип сетки';
  };

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
            onChange={(e) => handleFormatChange(e.target.value)}
            required
          >
            <option value="">Выберите формат</option>
            <option value="single">Single Elimination</option>
            <option value="double">Double Elimination</option>
            <option value="mix">Mix (Автоформирование команд)</option>
          </select>
          <small className="form-hint">
            {data.format === 'single' && 'Классическая система на выбывание'}
            {data.format === 'double' && 'Система двойного выбывания - можно проиграть один раз'}
            {data.format === 'mix' && 'Автоматическое формирование команд из индивидуальных участников'}
          </small>
        </div>

        {/* Тип сетки (автоматический для Single/Double, выбор для Mix) */}
        <div className="form-group">
          <label>Тип сетки *</label>
          <select
            value={data.bracket_type || 'single_elimination'}
            onChange={(e) => handleChange('bracket_type', e.target.value)}
            disabled={isSingleOrDouble} // 🆕 Disabled для Single/Double
            required
            style={isSingleOrDouble ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
          >
            {data.format === 'single' && (
              <option value="single_elimination">Single Elimination (автоматически)</option>
            )}
            {data.format === 'double' && (
              <option value="double_elimination">Double Elimination (автоматически)</option>
            )}
            {data.format === 'mix' && (
              <>
                <option value="swiss">Swiss System</option>
                <option value="single_elimination">Single Elimination</option>
                <option value="double_elimination">Double Elimination</option>
              </>
            )}
          </select>
          <small className="form-hint">
            {isSingleOrDouble && 'Тип сетки соответствует выбранному формату турнира'}
            {isMixFormat && 'Для Mix турниров рекомендуется Swiss System'}
          </small>
        </div>

        {/* Тип участников (зависит от формата) */}
        {!isMixFormat && isCS2 && (
          <div className="form-group">
            <label>Режим CS2 *</label>
            <select
              value={getCurrentCS2Mode() || '5v5'}
              onChange={(e) => handleCS2ModeChange(e.target.value)}
              required
            >
              <option value="5v5">Классический 5х5</option>
              <option value="2v2">Wingman 2х2</option>
            </select>
            <small className="form-hint">
              {getCurrentCS2Mode() === '5v5' && '🏆 Классический формат: команды из 5 игроков'}
              {getCurrentCS2Mode() === '2v2' && '⚡ Wingman формат: команды из 2 игроков'}
            </small>
          </div>
        )}

        {isMixFormat && (
          <div className="form-group">
            <label>Тип участников *</label>
            <div style={{ 
              padding: '12px', 
              background: '#1a1a1a', 
              border: '1px solid #333', 
              borderRadius: '6px',
              color: '#ccc'
            }}>
              👤 Индивидуальный (Solo)
              <small style={{ display: 'block', marginTop: '5px', color: '#888', fontSize: '12px' }}>
                Mix турниры всегда используют индивидуальное участие с автоформированием команд
              </small>
            </div>
          </div>
        )}

        {/* Размер команды */}
        <div className="form-group">
          <label>Размер команды *</label>
          <input
            type="number"
            min="1"
            max="10"
            value={data.team_size || 5}
            onChange={(e) => handleChange('team_size', parseInt(e.target.value, 10))}
            disabled={!isMixFormat && isCS2} // 🆕 Блокируем для CS2 в Single/Double режиме
            style={
              (!isMixFormat && isCS2) 
                ? { opacity: 0.6, cursor: 'not-allowed', background: '#0a0a0a' } 
                : {}
            }
            required
          />
          <small className="form-hint">
            {!isMixFormat && isCS2 && data.team_size === 5 && '🔒 Фиксировано для режима Классический 5х5'}
            {!isMixFormat && isCS2 && data.team_size === 2 && '🔒 Фиксировано для режима Wingman 2х2'}
            {(isMixFormat || !isCS2) && 'Количество игроков в одной команде'}
          </small>
        </div>

        {/* Максимум команд (разная логика для Solo и Team) */}
        <div className="form-group">
          <label>
            {isMixFormat ? 'Максимум участников *' : 'Максимум команд *'}
          </label>
          
          {isMixFormat ? (
            // Solo (Mix) - ручной ввод
            <>
              <input
                type="number"
                min="4"
                max="128"
                value={data.max_teams || ''}
                onChange={(e) => handleChange('max_teams', e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="Не ограничено"
              />
              <small className="form-hint">
                Оставьте пустым для неограниченного количества участников
              </small>
            </>
          ) : (
            // Team - выпадающий список
            <>
              <select
                value={data.max_teams || ''}
                onChange={(e) => handleChange('max_teams', e.target.value ? parseInt(e.target.value, 10) : null)}
                required
              >
                <option value="">Не ограничено</option>
                <option value="4">4 команды</option>
                <option value="8">8 команд</option>
                <option value="16">16 команд</option>
                <option value="32">32 команды</option>
                <option value="64">64 команды</option>
              </select>
              <small className="form-hint">
                Максимальное количество команд в турнире
              </small>
            </>
          )}
        </div>
      </div>

      {/* Mix специфичные настройки */}
      {isMixFormat && (
        <div className="step-section">
          <h3>Настройки MIX турнира</h3>
          
          <div className="form-group">
            <label>Тип микса</label>
            <select
              value={data.mix_type || 'classic'}
              onChange={(e) => {
                const newMixType = e.target.value;
                const updates = { mix_type: newMixType };
                
                // При выборе Full Mix автоматически ставим Swiss
                if (newMixType === 'full') {
                  updates.bracket_type = 'swiss';
                  updates.mix_rating_type = 'mixed';
                }
                
                onChange({ ...data, ...updates });
              }}
            >
              <option value="classic">Классический (формирование 1 раз)</option>
              <option value="full">Full MIX (после каждого раунда)</option>
            </select>
            <small className="form-hint">
              {data.mix_type === 'classic' && 'Команды формируются один раз перед стартом турнира'}
              {data.mix_type === 'full' && 'Команды пересобираются после каждого завершенного раунда'}
            </small>
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
            <small className="form-hint">
              Алгоритм распределения игроков по командам
            </small>
          </div>

          {data.mix_type === 'full' && data.bracket_type === 'swiss' && (
            <div className="form-group">
              <label>Минимум побед для выхода в финал</label>
              <input
                type="number"
                min="1"
                max="10"
                value={data.wins_to_win || 4}
                onChange={(e) => handleChange('wins_to_win', parseInt(e.target.value, 10))}
              />
              <small className="form-hint">
                Количество побед для автоматического попадания в финал (Swiss System)
              </small>
            </div>
          )}

          {data.mix_rating_type === 'faceit' && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={data.require_faceit_linked || false}
                  onChange={(e) => handleChange('require_faceit_linked', e.target.checked)}
                />
                <span>Требовать привязку FACEIT аккаунта</span>
              </label>
            </div>
          )}

          {data.mix_rating_type === 'premier' && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={data.require_steam_linked || false}
                  onChange={(e) => handleChange('require_steam_linked', e.target.checked)}
                />
                <span>Требовать привязку Steam аккаунта</span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Step3_Format;

