// frontend/src/pages/create-tournament/components/ModeSelector.js
import React, { useState } from 'react';
import '../styles/ModeSelector.css';

/**
 * Компонент выбора режима создания турнира
 * Wizard vs Ручная настройка
 */
function ModeSelector({ onSelect }) {
  const [hoveredMode, setHoveredMode] = useState(null);

  const modes = [
    {
      id: 'wizard',
      icon: '🧙',
      title: 'Мастер создания',
      subtitle: 'Рекомендуется',
      description: 'Пошаговый интерфейс с подсказками',
      features: [
        '6 простых шагов',
        'Готовые шаблоны турниров',
        'Автосохранение черновика',
        'Предпросмотр перед созданием',
      ],
      recommended: true,
      badge: 'НОВОЕ',
    },
    {
      id: 'manual',
      icon: '⚙️',
      title: 'Ручная настройка',
      subtitle: 'Для опытных организаторов',
      description: 'Полный контроль над всеми параметрами',
      features: [
        'Все настройки в одной форме',
        'Быстрое создание',
        'Гибкая конфигурация',
        'Привычный интерфейс',
      ],
      recommended: false,
    },
  ];

  return (
    <div className="mode-selector">
      <div className="modes-grid">
        {modes.map((mode) => (
          <div
            key={mode.id}
            className={`mode-card ${hoveredMode === mode.id ? 'hovered' : ''} ${
              mode.recommended ? 'recommended' : ''
            }`}
            onClick={() => onSelect(mode.id)}
            onMouseEnter={() => setHoveredMode(mode.id)}
            onMouseLeave={() => setHoveredMode(null)}
          >
            {mode.badge && <div className="mode-badge">{mode.badge}</div>}
            {mode.recommended && <div className="recommended-badge">⭐ Рекомендуется</div>}

            <div className="mode-icon">{mode.icon}</div>

            <div className="mode-header">
              <h2>{mode.title}</h2>
              <p className="mode-subtitle">{mode.subtitle}</p>
            </div>

            <p className="mode-description">{mode.description}</p>

            <ul className="mode-features">
              {mode.features.map((feature, index) => (
                <li key={index}>
                  <span className="feature-checkmark">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            {/* Стрелка для визуального указания на кликабельность */}
            <div className="mode-action-hint">
              Нажмите для выбора →
            </div>
          </div>
        ))}
      </div>

      <div className="mode-hint">
        <div className="hint-icon">💡</div>
        <p>
          <strong>Новичкам рекомендуем Мастер создания.</strong> Он проведет вас через все этапы и
          поможет избежать ошибок. Опытные организаторы могут использовать ручную настройку для
          быстрого создания турнира.
        </p>
      </div>
    </div>
  );
}

export default ModeSelector;

