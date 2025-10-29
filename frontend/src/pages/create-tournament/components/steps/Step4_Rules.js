// frontend/src/pages/create-tournament/components/steps/Step4_Rules.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Шаг 4: Правила и настройки матчей
 * Полная реализация с выбором карт CS2
 */
function Step4_Rules({ data, format, basicInfo, onChange }) {
  const [cs2Maps, setCs2Maps] = useState([]);
  const [defaultCs2Maps, setDefaultCs2Maps] = useState([]); // 🆕 Базовый маппул 5х5
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [mapsInitialized, setMapsInitialized] = useState(false); // 🆕 Флаг инициализации
  const [mapMode, setMapMode] = useState('default'); // 'default' | 'wingman'
  const [localFormConfig, setLocalFormConfig] = useState(() => {
    const cfg = (data && data.application_form_config) || {};
    return {
      enabled: !!cfg.enabled,
      fill_mode: cfg.fill_mode || 'all', // all|captain
      min_age: cfg.min_age || '',
      fields: Array.isArray(cfg.fields) ? cfg.fields : []
    };
  });

  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const isCS2 = basicInfo.game === 'counter strike 2';
  
  // 🔍 DEBUG: Проверяем условия для листа ожидания
  console.log('🔍 [Step4_Rules] Проверка условий листа ожидания:', {
    format: format?.format,
    participant_type: format?.participant_type,
    isSingle: format?.format === 'single',
    isDouble: format?.format === 'double',
    isTeam: format?.participant_type === 'team',
    shouldShow: format && (format.format === 'single' || format.format === 'double') && format.participant_type === 'team'
  });

  // Загрузка карт CS2 из БД (только один раз)
  useEffect(() => {
    if (!isCS2) return;
    // Если это Wingman (2х2), не загружаем дефолтный маппул 5х5, чтобы не перезаписать Wingman
    if (parseInt(format?.team_size, 10) === 2) return;
    if (cs2Maps.length > 0) return; // Уже загружены

    const fetchMaps = async () => {
      try {
        setLoadingMaps(true);
        const response = await axios.get('/api/maps?game=Counter-Strike 2');
        // Если уже активирован Wingman режим, не перезаписываем текущий пул
        if (mapMode === 'default') {
          setCs2Maps(response.data);
          setDefaultCs2Maps(response.data);
        }
        console.log('✅ Загружено карт CS2:', response.data.length);
      } catch (error) {
        console.error('❌ Ошибка загрузки карт CS2:', error);
        // Fallback: стандартный пул карт
        const fallbackMaps = [
          { id: 1, name: 'de_mirage', display_name: 'Mirage' },
          { id: 2, name: 'de_inferno', display_name: 'Inferno' },
          { id: 3, name: 'de_nuke', display_name: 'Nuke' },
          { id: 4, name: 'de_overpass', display_name: 'Overpass' },
          { id: 5, name: 'de_vertigo', display_name: 'Vertigo' },
          { id: 6, name: 'de_ancient', display_name: 'Ancient' },
          { id: 7, name: 'de_anubis', display_name: 'Anubis' }
        ];
        if (mapMode === 'default') {
          setCs2Maps(fallbackMaps);
          setDefaultCs2Maps(fallbackMaps);
        }
      } finally {
        setLoadingMaps(false);
      }
    };

    fetchMaps();
  }, [isCS2, cs2Maps.length, mapMode, format?.team_size]);

  // 🆕 Wingman маппул (2х2)
  const wingmanMaps = [
    { id: 1001, name: 'de_inferno', display_name: 'Inferno' },
    { id: 1002, name: 'de_mirage', display_name: 'Mirage' },
    { id: 1003, name: 'de_nuke', display_name: 'Nuke' },
    { id: 1004, name: 'de_overpass', display_name: 'Overpass' },
    { id: 1005, name: 'de_vertigo', display_name: 'Vertigo' },
    { id: 1006, name: 'de_anubis', display_name: 'Anubis' },
    { id: 1007, name: 'de_train', display_name: 'Train' }
  ];

  // 🆕 Переключение маппула для CS2 при размере состава 2 (Wingman)
  useEffect(() => {
    if (!isCS2) return;
    const isWingman = parseInt(format?.team_size, 10) === 2;
    const wingNames = wingmanMaps.map(m => m.name);
    const currentNames = cs2Maps.map(m => m.name);

    if (isWingman && mapMode !== 'wingman') {
      setCs2Maps(wingmanMaps);
      setMapMode('wingman');
      // Автовыбор: оставляем пересечение, при нехватке — добираем первыми из списка до 7
      if (data.lobby_enabled) {
        const current = Array.isArray(data.selected_maps) ? data.selected_maps : [];
        const intersection = current.filter(n => wingNames.includes(n));
        const filled = [...intersection];
        for (let i = 0; i < wingNames.length && filled.length < 7; i += 1) {
          if (!filled.includes(wingNames[i])) filled.push(wingNames[i]);
        }
        handleChange('selected_maps', filled.slice(0, 7));
      }
    }

    if (!isWingman && mapMode !== 'default') {
      setCs2Maps(defaultCs2Maps);
      setMapMode('default');
      // Если выбранные карты не из базового пула — очищаем до валидного состояния, но не навязываем выбор
      if (data.lobby_enabled && defaultCs2Maps.length) {
        const baseNames = defaultCs2Maps.map(m => m.name);
        const current = Array.isArray(data.selected_maps) ? data.selected_maps : [];
        const filtered = current.filter(n => baseNames.includes(n));
        handleChange('selected_maps', filtered);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCS2, format?.team_size, data.lobby_enabled, defaultCs2Maps.length]);

  // Автовыбор всех карт при включении лобби (только один раз)
  useEffect(() => {
    if (!data.lobby_enabled) return;
    if (!cs2Maps.length) return;
    if (mapsInitialized) return; // Уже инициализировано
    if (data.selected_maps && data.selected_maps.length > 0) return; // Уже есть выбранные

    // Автоматически выбираем все карты
    const allMapNames = cs2Maps.map(m => m.name);
    if (allMapNames.length === 7) {
      handleChange('selected_maps', allMapNames);
      setMapsInitialized(true); // 🆕 Помечаем что инициализация выполнена
    }
  }, [data.lobby_enabled, cs2Maps.length, mapsInitialized, data.selected_maps]); // Убрали handleChange из зависимостей

  // Обработчик переключения карты
  const handleMapToggle = (mapName) => {
    const currentMaps = data.selected_maps || [];
    const isSelected = currentMaps.includes(mapName);

    if (isSelected) {
      // Убираем карту
      handleChange('selected_maps', currentMaps.filter(m => m !== mapName));
    } else {
      // Добавляем карту
      handleChange('selected_maps', [...currentMaps, mapName]);
    }
  };

  // Выбрать все карты
  const handleSelectAllMaps = () => {
    const allMapNames = cs2Maps.map(m => m.name);
    // Для Wingman по умолчанию выбираем первые 7 карт, чтобы пройти валидацию 7/7
    const target = mapMode === 'wingman' ? allMapNames.slice(0, 7) : allMapNames;
    handleChange('selected_maps', target);
  };

  // Снять выбор со всех карт
  const handleDeselectAllMaps = () => {
    handleChange('selected_maps', []);
  };

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
          <label>Распределение в сетке (Seeding)</label>
          <select
            value={data.seeding_type || 'random'}
            onChange={(e) => handleChange('seeding_type', e.target.value)}
          >
            <option value="random">Случайное</option>
            <option value="rating">По рейтингу</option>
            <option value="balanced">Сбалансированное</option>
          </select>
          <small className="form-hint">
            Это не MIX-формирование команд. Seeding определяет начальную расстановку команд в турнирной сетке.
          </small>
        </div>

        {/* 🆕 Требование привязки FACEIT аккаунта (для CS2, на шаге Правила) */}
        {isCS2 && (
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={data.require_faceit_linked || false}
                onChange={(e) => handleChange('require_faceit_linked', e.target.checked)}
              />
              <span>Требовать привязку FACEIT аккаунта для участия</span>
            </label>
            <small className="form-hint">Если включено — принять участие смогут только пользователи с привязанным FACEIT аккаунтом.</small>
          </div>
        )}

        {/* 🆕 Анкета участника (конструктор) */}
        <div className="form-group" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #333' }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={localFormConfig.enabled}
              onChange={(e) => {
                const next = { ...localFormConfig, enabled: e.target.checked };
                setLocalFormConfig(next);
                onChange({ ...data, application_form_config: next });
              }}
            />
            <span>Требовать заполнение анкеты при участии</span>
          </label>

          {localFormConfig.enabled && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', display: 'grid', gap: '12px' }}>
              {/* Режим заполнения */}
              <div>
                <label>Кто заполняет</label>
                <select
                  value={localFormConfig.fill_mode}
                  onChange={(e) => {
                    const next = { ...localFormConfig, fill_mode: e.target.value };
                    setLocalFormConfig(next);
                    onChange({ ...data, application_form_config: next });
                  }}
                >
                  <option value="all">Каждый игрок</option>
                  <option value="captain">Только капитан команды</option>
                </select>
                <small className="form-hint">Для командных турниров можно требовать анкету только от капитана</small>
              </div>

              {/* Минимальный возраст (опционально) */}
              <div>
                <label>Минимальный возраст (опционально)</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={localFormConfig.min_age}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = { ...localFormConfig, min_age: v === '' ? '' : parseInt(v, 10) };
                    setLocalFormConfig(next);
                    onChange({ ...data, application_form_config: next });
                  }}
                  placeholder="Напр. 16"
                />
                <small className="form-hint">Если указано — проверим дату рождения на соответствие</small>
              </div>

              {/* Поля анкеты */}
              <div>
                <label>Поля анкеты</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {[
                    { key: 'last_name', label: 'Фамилия' },
                    { key: 'first_name', label: 'Имя' },
                    { key: 'middle_name', label: 'Отчество' },
                    { key: 'date_of_birth', label: 'Дата рождения' },
                    { key: 'region', label: 'Регион проживания' },
                    { key: 'vk_url', label: 'VK' },
                    { key: 'telegram_url', label: 'Telegram' },
                    { key: 'phone', label: 'Телефон' },
                    { key: 'steam_url', label: 'Steam' },
                    { key: 'faceit_url', label: 'FACEIT' }
                  ].map((f) => {
                    const existing = (localFormConfig.fields || []).find((x) => x.key === f.key) || { key: f.key, required: false };
                    const isChecked = !!(localFormConfig.fields || []).some((x) => x.key === f.key);
                    return (
                      <label key={f.key} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111', border: '1px solid #333', borderRadius: '6px', padding: '8px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let nextFields = Array.isArray(localFormConfig.fields) ? [...localFormConfig.fields] : [];
                            if (e.target.checked) {
                              nextFields.push({ key: f.key, required: false });
                            } else {
                              nextFields = nextFields.filter((x) => x.key !== f.key);
                            }
                            const next = { ...localFormConfig, fields: nextFields };
                            setLocalFormConfig(next);
                            onChange({ ...data, application_form_config: next });
                          }}
                        />
                        <span style={{ flex: 1 }}>{f.label}</span>
                        {isChecked && (
                          <label className="checkbox-label" style={{ marginLeft: 'auto' }}>
                            <input
                              type="checkbox"
                              checked={!!existing.required}
                              onChange={(e) => {
                                const nextFields = (localFormConfig.fields || []).map((x) => x.key === f.key ? { ...x, required: e.target.checked } : x);
                                const next = { ...localFormConfig, fields: nextFields };
                                setLocalFormConfig(next);
                                onChange({ ...data, application_form_config: next });
                              }}
                            />
                            <span>обязательное</span>
                          </label>
                        )}
                      </label>
                    );
                  })}
                </div>
                <small className="form-hint">Отметьте поля и обязательность. Дата рождения может сочетаться с минимальным возрастом.</small>
              </div>
            </div>
          )}
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
                <small className="form-hint">
                  Формат применяется ко всем матчам, кроме финальных (если задан особый формат финала)
                </small>
              </div>

              {/* 🆕 Особый формат для финала */}
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={data.enable_final_format || false}
                    onChange={(e) => handleChange('enable_final_format', e.target.checked)}
                  />
                  <span>Особый формат матчей финала</span>
                </label>
                <small className="form-hint">
                  Позволяет задать отдельный формат для финальных матчей (финал, полуфинал, гранд-финал)
                </small>
              </div>

              {data.enable_final_format && (
                <div className="form-group" style={{ marginLeft: '30px', paddingLeft: '15px', borderLeft: '2px solid #ff0000' }}>
                  <label>Формат финальных матчей</label>
                  <select
                    value={data.final_match_format || 'bo3'}
                    onChange={(e) => handleChange('final_match_format', e.target.value)}
                  >
                    <option value="bo1">Best of 1</option>
                    <option value="bo3">Best of 3</option>
                    <option value="bo5">Best of 5</option>
                  </select>
                  <small className="form-hint">
                    Этот формат будет применяться к финалу, полуфиналам и гранд-финалу
                  </small>
                </div>
              )}

              {/* Выбор карт турнира */}
              <div className="form-group">
                <label>Карты турнира (выберите 7 карт) *</label>

                {/* 🆕 Инфоблок про Wingman */}
                {mapMode === 'wingman' && (
                  <div style={{
                    marginTop: '8px',
                    marginBottom: '8px',
                    padding: '10px 12px',
                    background: 'rgba(0, 128, 255, 0.1)',
                    border: '1px solid rgba(0, 128, 255, 0.3)',
                    borderRadius: '6px',
                    color: '#66b3ff',
                    fontSize: '13px'
                  }} title="Размер состава 2 → маппул переключен на Wingman (2х2)">
                    ℹ️ Размер состава = 2. Активирован маппул Wingman (2х2). Карты отличаются от 5х5.
                  </div>
                )}
                
                {loadingMaps ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                    Загрузка карт...
                  </div>
                ) : (
                  <>
                    {/* Кнопки быстрого выбора */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '10px', 
                      marginBottom: '15px',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleSelectAllMaps}
                        style={{ fontSize: '13px', padding: '6px 12px' }}
                      >
                        ✓ Выбрать все
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleDeselectAllMaps}
                        style={{ fontSize: '13px', padding: '6px 12px' }}
                      >
                        ✗ Снять выбор
                      </button>
                      <div style={{ 
                        marginLeft: 'auto', 
                        padding: '6px 12px', 
                        background: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: (data.selected_maps?.length === 7) ? '#00ff00' : '#888'
                      }}>
                        Выбрано: {data.selected_maps?.length || 0}/7
                      </div>
                    </div>

                    {/* Сетка карт */}
                    <div className="maps-grid">
                      {cs2Maps.map((map) => {
                        const isSelected = (data.selected_maps || []).includes(map.name);
                        
                        return (
                          <label
                            key={map.id}
                            className={`map-card ${isSelected ? 'selected' : ''}`}
                          >
                            <input
                              type="checkbox"
                              value={map.name}
                              checked={isSelected}
                              onChange={() => handleMapToggle(map.name)}
                            />
                            
                            {/* Иконка чекбокса */}
                            <div className="map-checkbox-icon">
                              {isSelected && '✓'}
                            </div>

                            {/* Название карты */}
                            <span className="map-name">
                              {map.display_name || map.name.replace('de_', '').charAt(0).toUpperCase() + map.name.replace('de_', '').slice(1)}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Предупреждение о количестве карт */}
                    {data.selected_maps && data.selected_maps.length !== 7 && (
                      <div style={{
                        marginTop: '12px',
                        padding: '10px 12px',
                        background: 'rgba(255, 165, 0, 0.1)',
                        border: '1px solid rgba(255, 165, 0, 0.3)',
                        borderRadius: '6px',
                        color: '#ffa500',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        ⚠️ Необходимо выбрать ровно 7 карт (выбрано: {data.selected_maps.length})
                      </div>
                    )}

                    {data.selected_maps && data.selected_maps.length === 7 && (
                      <div style={{
                        marginTop: '12px',
                        padding: '10px 12px',
                        background: 'rgba(0, 255, 0, 0.1)',
                        border: '1px solid rgba(0, 255, 0, 0.3)',
                        borderRadius: '6px',
                        color: '#00ff00',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        ✓ Выбрано правильное количество карт
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Лист ожидания для командных турниров Single/Double Elimination */}
      {format && (format.format === 'single' || format.format === 'double') && format.participant_type === 'team' && (
        <div className="step-section">
          <h3>📋 Лист ожидания</h3>
          
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={format.waiting_list_enabled || false}
                onChange={(e) => onChange({ ...format, waiting_list_enabled: e.target.checked })}
              />
              <span>Включить лист ожидания для соло игроков?</span>
            </label>
            <small className="form-hint">
              📋 Игроки без команд смогут заявиться в лист ожидания, после чего вы сможете добавить их в команды вручную
            </small>
          </div>

          {format.waiting_list_enabled && (
            <div style={{ marginTop: '16px', paddingLeft: '30px', paddingTop: '12px', borderLeft: '2px solid #ff0000' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={format.waiting_list_require_faceit || false}
                    onChange={(e) => onChange({ ...format, waiting_list_require_faceit: e.target.checked })}
                  />
                  <span>Требовать привязку FACEIT аккаунта</span>
                </label>
                
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={format.waiting_list_require_steam || false}
                    onChange={(e) => onChange({ ...format, waiting_list_require_steam: e.target.checked })}
                  />
                  <span>Требовать привязку Steam ID</span>
                </label>
                
                <small className="form-hint" style={{ marginTop: '8px', color: '#888' }}>
                  ⚠️ Игроки без требуемых привязок не смогут заявиться в лист ожидания
                </small>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Step4_Rules;

