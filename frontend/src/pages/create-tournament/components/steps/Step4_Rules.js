// frontend/src/pages/create-tournament/components/steps/Step4_Rules.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Шаг 4: Правила и настройки матчей
 * Полная реализация с выбором карт CS2
 */
function Step4_Rules({ data, format, basicInfo, onChange }) {
  const [cs2Maps, setCs2Maps] = useState([]);
  const [loadingMaps, setLoadingMaps] = useState(false);

  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const isCS2 = basicInfo.game === 'counter strike 2';

  // Загрузка карт CS2 из БД
  useEffect(() => {
    if (!isCS2) return;

    const fetchMaps = async () => {
      try {
        setLoadingMaps(true);
        const response = await axios.get('/api/maps?game=Counter-Strike 2');
        setCs2Maps(response.data);
        console.log('✅ Загружено карт CS2:', response.data.length);
        
        // Автоматически выбираем все карты при включении лобби
        if (data.lobby_enabled && (!data.selected_maps || data.selected_maps.length === 0)) {
          const allMapNames = response.data.map(m => m.name);
          if (allMapNames.length === 7) {
            handleChange('selected_maps', allMapNames);
          }
        }
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
        setCs2Maps(fallbackMaps);
      } finally {
        setLoadingMaps(false);
      }
    };

    fetchMaps();
  }, [isCS2, data.lobby_enabled, data.selected_maps, handleChange]);

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
    handleChange('selected_maps', allMapNames);
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
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: '12px'
                    }}>
                      {cs2Maps.map((map) => {
                        const isSelected = (data.selected_maps || []).includes(map.name);
                        
                        return (
                          <label
                            key={map.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              padding: '12px',
                              background: isSelected ? '#1a0000' : '#1a1a1a',
                              border: `2px solid ${isSelected ? '#ff0000' : '#333'}`,
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              userSelect: 'none'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.borderColor = '#666';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.borderColor = '#333';
                              }
                            }}
                          >
                            <input
                              type="checkbox"
                              value={map.name}
                              checked={isSelected}
                              onChange={() => handleMapToggle(map.name)}
                              style={{ display: 'none' }}
                            />
                            
                            {/* Иконка чекбокса */}
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              border: `2px solid ${isSelected ? '#ff0000' : '#666'}`,
                              background: isSelected ? '#ff0000' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: '8px',
                              fontSize: '14px',
                              fontWeight: 'bold',
                              color: '#fff'
                            }}>
                              {isSelected && '✓'}
                            </div>

                            {/* Название карты */}
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: isSelected ? '#fff' : '#ccc',
                              textAlign: 'center'
                            }}>
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
    </div>
  );
}

export default Step4_Rules;

