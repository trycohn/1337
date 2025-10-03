// frontend/src/pages/create-tournament/components/steps/Step6_Preview.js
import React from 'react';

/**
 * Шаг 6: Предпросмотр и подтверждение
 */
function Step6_Preview({ wizardData, onEdit }) {
  const { basicInfo, format, rules, branding } = wizardData;

  // Форматирование даты
  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Получение названия формата
  const getFormatName = (formatValue) => {
    const formats = {
      single: 'Single Elimination',
      double: 'Double Elimination',
      mix: 'Mix Tournament',
    };
    return formats[formatValue] || formatValue;
  };

  // Получение названия типа сетки
  const getBracketTypeName = (bracketType) => {
    const types = {
      single_elimination: 'Single Elimination',
      double_elimination: 'Double Elimination',
      swiss: 'Swiss System',
    };
    return types[bracketType] || bracketType;
  };

  return (
    <div className="wizard-step step-preview">
      <div className="step-header">
        <h2>👁️ Предпросмотр</h2>
        <p className="step-description">
          Проверьте все настройки перед созданием турнира
        </p>
      </div>

      {/* Базовая информация */}
      <div className="step-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>📝 Базовая информация</h3>
          <button 
            className="btn btn-secondary" 
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => onEdit(2)}
          >
            ✏️ Редактировать
          </button>
        </div>
        
        <div style={{ marginTop: '15px' }}>
          {/* Логотип турнира (если загружен) */}
          {basicInfo.logo_file && (
            <div style={{
              marginBottom: '15px',
              padding: '15px',
              background: '#1a1a1a',
              border: '1px solid #222',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '15px'
            }}>
              <div style={{ fontSize: '13px', color: '#888', fontWeight: '500', minWidth: '120px' }}>
                Логотип
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '8px',
                  border: '2px solid #ff0000',
                  overflow: 'hidden',
                  background: '#000'
                }}>
                  <img
                    src={URL.createObjectURL(basicInfo.logo_file)}
                    alt="Логотип"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <span style={{ fontSize: '14px', color: '#ccc' }}>
                  {basicInfo.logo_file.name}
                </span>
              </div>
            </div>
          )}
          
          <PreviewField label="Название" value={basicInfo.name || 'Не указано'} />
          <PreviewField label="Игра" value={basicInfo.game || 'Не указано'} />
          <PreviewField label="Дата начала" value={formatDate(basicInfo.start_date)} />
          <PreviewField label="Призовой фонд" value={basicInfo.prize_pool || 'Не указан'} />
          <PreviewField label="Описание" value={basicInfo.description || 'Не указано'} isLong />
          <PreviewField 
            label="Тип турнира" 
            value={
              basicInfo.tournament_type === 'open' ? '🌍 Открытый' :
              basicInfo.tournament_type === 'closed' ? '🔒 Закрытый' :
              basicInfo.tournament_type === 'hidden' ? '👻 Скрытый' :
              basicInfo.tournament_type === 'final' ? '🏆 Финал серии' :
              'Открытый'
            } 
          />
        </div>
      </div>

      {/* Формат */}
      <div className="step-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>🎯 Формат</h3>
          <button 
            className="btn btn-secondary" 
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => onEdit(3)}
          >
            ✏️ Редактировать
          </button>
        </div>
        
        <div style={{ marginTop: '15px' }}>
          <PreviewField label="Формат турнира" value={getFormatName(format.format)} />
          <PreviewField label="Тип сетки" value={getBracketTypeName(format.bracket_type)} />
          <PreviewField 
            label="Тип участников" 
            value={
              format.participant_type === 'solo' ? 'Индивидуальный (Solo)' :
              format.participant_type === 'team' && format.team_size === 2 ? 'Командный (Wingman 2х2)' :
              format.participant_type === 'team' && format.team_size === 5 ? 'Командный (Классический 5х5)' :
              format.participant_type === 'team' ? `Командный` :
              'Командный'
            } 
          />
          <PreviewField 
            label="Размер команды" 
            value={
              format.participant_type === 'solo' 
                ? `${format.team_size} игроков (автоформирование)` 
                : `${format.team_size} игроков`
            } 
          />
          <PreviewField 
            label={format.format === 'mix' ? 'Максимум участников' : 'Максимум команд'} 
            value={format.max_teams ? `${format.max_teams} ${format.format === 'mix' ? 'участников' : 'команд'}` : 'Не ограничено'} 
          />
        </div>
      </div>

      {/* Правила */}
      <div className="step-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>📜 Правила</h3>
          <button 
            className="btn btn-secondary" 
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => onEdit(4)}
          >
            ✏️ Редактировать
          </button>
        </div>
        
        <div style={{ marginTop: '15px' }}>
          <PreviewField 
            label="Правила" 
            value={rules.rules || 'Не указаны'} 
            isLong 
          />
          <PreviewField 
            label="Лобби матча" 
            value={rules.lobby_enabled ? 'Включено' : 'Выключено'} 
          />
          {rules.lobby_enabled && rules.lobby_match_format && (
            <PreviewField 
              label="Формат матчей" 
              value={
                rules.lobby_match_format === 'bo1' ? 'Best of 1' :
                rules.lobby_match_format === 'bo3' ? 'Best of 3' :
                rules.lobby_match_format === 'bo5' ? 'Best of 5' :
                'Выбор в лобби'
              } 
            />
          )}
          {rules.enable_final_format && (
            <PreviewField 
              label="Формат финальных матчей" 
              value={
                <span style={{ color: '#ff0000', fontWeight: '600' }}>
                  {rules.final_match_format === 'bo1' ? 'Best of 1' :
                   rules.final_match_format === 'bo3' ? 'Best of 3' :
                   rules.final_match_format === 'bo5' ? 'Best of 5' :
                   'Best of 3'} (особый)
                </span>
              } 
            />
          )}
          {rules.selected_maps && rules.selected_maps.length > 0 && (
            <div style={{ 
              marginTop: '12px',
              padding: '12px',
              background: '#1a1a1a',
              border: '1px solid #222',
              borderRadius: '6px'
            }}>
              <div style={{ 
                fontSize: '13px', 
                color: '#888', 
                marginBottom: '10px',
                fontWeight: '500'
              }}>
                Карты турнира ({rules.selected_maps.length})
              </div>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '8px'
              }}>
                {rules.selected_maps.map((mapName, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '6px 12px',
                      background: '#111',
                      border: '1px solid #ff0000',
                      borderRadius: '4px',
                      fontSize: '13px',
                      color: '#fff'
                    }}
                  >
                    {mapName.replace('de_', '').charAt(0).toUpperCase() + mapName.replace('de_', '').slice(1)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Брендинг */}
      <div className="step-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>🎨 Брендинг</h3>
          <button 
            className="btn btn-secondary" 
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => onEdit(5)}
          >
            ✏️ Редактировать
          </button>
        </div>
        
        <div style={{ marginTop: '15px' }}>
          <PreviewField 
            label="Основной цвет" 
            value={
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '30px', 
                  height: '30px', 
                  background: branding.primary_color,
                  border: '1px solid #333',
                  borderRadius: '4px'
                }} />
                {branding.primary_color}
              </div>
            } 
          />
        </div>
      </div>

      {/* Подтверждение */}
      <div style={{ 
        marginTop: '30px',
        padding: '20px',
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#ccc', fontSize: '15px', marginBottom: '15px' }}>
          ✅ Все готово! Нажмите кнопку "Создать турнир" ниже для завершения.
        </p>
        <p style={{ color: '#888', fontSize: '13px' }}>
          После создания вы сможете настроить дополнительные параметры в панели управления турниром.
        </p>
      </div>
    </div>
  );
}

// Компонент отображения поля
function PreviewField({ label, value, isLong }) {
  return (
    <div style={{ 
      marginBottom: '12px',
      padding: '12px',
      background: '#1a1a1a',
      border: '1px solid #222',
      borderRadius: '6px'
    }}>
      <div style={{ 
        fontSize: '13px', 
        color: '#888', 
        marginBottom: '6px',
        fontWeight: '500'
      }}>
        {label}
      </div>
      <div style={{ 
        fontSize: '15px', 
        color: '#fff',
        wordBreak: isLong ? 'break-word' : 'normal'
      }}>
        {value}
      </div>
    </div>
  );
}

export default Step6_Preview;

