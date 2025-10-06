// frontend/src/pages/create-tournament/components/steps/Step1_Template.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Step1_Template.css';

/**
 * Шаг 1: Выбор шаблона турнира
 * Библиотека готовых шаблонов + возможность создать с нуля
 */
function Step1_Template({ data, onChange, onApplyTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(data);

  // Загрузка шаблонов из БД
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (selectedCategory !== 'all') {
          params.append('category', selectedCategory);
        }
        
        const response = await axios.get(`/api/tournament-templates?${params}`);
        setTemplates(response.data.templates || []);
        console.log('✅ Загружено шаблонов:', response.data.templates?.length || 0);
      } catch (error) {
        console.error('❌ Ошибка загрузки шаблонов:', error);
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [selectedCategory]);

  // Применение шаблона
  const handleSelectTemplate = async (template) => {
    setSelectedTemplate(template);
    onChange(template);
    
    // Инкремент счетчика использования
    try {
      await axios.post(`/api/tournament-templates/${template.id}/use`);
    } catch (error) {
      console.error('Ошибка обновления счетчика шаблона:', error);
    }
    
    // Применяем конфигурацию шаблона ко всем шагам Wizard
    if (onApplyTemplate && template.config) {
      onApplyTemplate(template.config);
    }
  };

  // Создать с нуля
  const handleCreateFromScratch = () => {
    setSelectedTemplate(null);
    onChange(null);
  };

  return (
    <div className="wizard-step step-template">
      <div className="step-header">
        <h2>📋 Выбор шаблона</h2>
        <p className="step-description">
          Выберите готовый шаблон турнира для быстрого старта или создайте с нуля
        </p>
      </div>

      {/* Категории */}
      <div className="template-categories">
        <button
          className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          Все шаблоны
        </button>
        <button
          className={`category-btn ${selectedCategory === 'daily' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('daily')}
        >
          ⚡ Ежедневные
        </button>
        <button
          className={`category-btn ${selectedCategory === 'weekly' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('weekly')}
        >
          🏆 Еженедельные
        </button>
        <button
          className={`category-btn ${selectedCategory === 'monthly' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('monthly')}
        >
          👑 Ежемесячные
        </button>
      </div>

      {/* Сетка шаблонов */}
      <div className="step-section">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            Загрузка шаблонов...
          </div>
        ) : (
          <div className="templates-grid">
            {/* Кнопка "Создать с нуля" */}
            <div
              className={`template-card custom ${!selectedTemplate ? 'selected' : ''}`}
              onClick={handleCreateFromScratch}
            >
              <div className="template-icon">🎨</div>
              <h3 className="template-name">Создать с нуля</h3>
              <p className="template-description">
                Полная настройка всех параметров турнира вручную
              </p>
              <div className="template-features">
                <span>✓ Полный контроль</span>
                <span>✓ Все опции доступны</span>
              </div>
            </div>

            {/* Официальные шаблоны */}
            {templates.map((template) => (
              <div
                key={template.id}
                className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''} ${
                  template.is_official ? 'official' : ''
                }`}
                onClick={() => handleSelectTemplate(template)}
              >
                {template.is_official && (
                  <div className="official-badge">Официальный</div>
                )}
                
                <div className="template-icon">{template.icon || '🏆'}</div>
                
                <h3 className="template-name">{template.name}</h3>
                
                <p className="template-description">{template.description}</p>
                
                <div className="template-config">
                  <div className="config-item">
                    <span className="config-label">Формат:</span>
                    <span className="config-value">
                      {template.config.bracket_type === 'single_elimination' && 'Single Elim'}
                      {template.config.bracket_type === 'double_elimination' && 'Double Elim'}
                      {template.config.bracket_type === 'swiss' && 'Swiss'}
                    </span>
                  </div>
                  <div className="config-item">
                    <span className="config-label">Матчи:</span>
                    <span className="config-value">
                      {template.config.lobby_match_format?.toUpperCase() || 'Выбор'}
                      {template.config.final_match_format && 
                        ` / ${template.config.final_match_format.toUpperCase()} финал`}
                    </span>
                  </div>
                  <div className="config-item">
                    <span className="config-label">Команд:</span>
                    <span className="config-value">
                      {template.config.team_size}v{template.config.team_size} × {template.config.max_teams || '∞'}
                    </span>
                  </div>
                  {template.config.recommended_duration && (
                    <div className="config-item">
                      <span className="config-label">Длительность:</span>
                      <span className="config-value">{template.config.recommended_duration}</span>
                    </div>
                  )}
                </div>
                
                <div className="template-stats">
                  👥 Использован: {template.use_count || 0} раз
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Подсказка */}
      {selectedTemplate && (
        <div className="template-hint">
          <div className="hint-icon">💡</div>
          <div className="hint-content">
            <strong>Выбран шаблон:</strong> {selectedTemplate.name}
            <br />
            <small>
              Вы можете изменить любые параметры на следующих шагах.
              {selectedTemplate.config?.recommended_duration && 
                ` Примерная длительность: ${selectedTemplate.config.recommended_duration}.`}
            </small>
          </div>
        </div>
      )}

      {!selectedTemplate && !loading && (
        <div className="template-hint">
          <div className="hint-icon">ℹ️</div>
          <div className="hint-content">
            <strong>Создание с нуля</strong>
            <br />
            <small>
              Вы настроите все параметры турнира на следующих шагах. 
              Это дает максимальный контроль, но требует больше времени.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}

export default Step1_Template;

