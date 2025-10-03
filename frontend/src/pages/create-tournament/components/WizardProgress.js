// frontend/src/pages/create-tournament/components/WizardProgress.js
import React from 'react';
import '../styles/WizardProgress.css';

/**
 * Прогресс-бар Wizard с визуальными шагами
 */
function WizardProgress({ currentStep, totalSteps }) {
  const steps = [
    { id: 1, title: 'Шаблон', icon: '📋', shortTitle: 'Шаблон' },
    { id: 2, title: 'Информация', icon: '📝', shortTitle: 'Инфо' },
    { id: 3, title: 'Формат', icon: '🎯', shortTitle: 'Формат' },
    { id: 4, title: 'Правила', icon: '📜', shortTitle: 'Правила' },
    { id: 5, title: 'Брендинг', icon: '🎨', shortTitle: 'Бренд' },
    { id: 6, title: 'Предпросмотр', icon: '👁️', shortTitle: 'Превью' },
  ];

  // Процент завершения
  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="wizard-progress">
      {/* Прогресс линия */}
      <div className="progress-line">
        <div 
          className="progress-fill" 
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Шаги */}
      <div className="progress-steps">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`progress-step ${
              step.id === currentStep
                ? 'active'
                : step.id < currentStep
                ? 'completed'
                : 'pending'
            }`}
          >
            <div className="step-circle">
              {step.id < currentStep ? (
                <span className="checkmark">✓</span>
              ) : (
                <span className="step-icon">{step.icon}</span>
              )}
            </div>
            <div className="step-label">
              <span className="step-title">{step.title}</span>
              <span className="step-short">{step.shortTitle}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Индикатор прогресса (текстовый) */}
      <div className="progress-indicator">
        Шаг {currentStep} из {totalSteps}
        <span className="progress-percentage">
          ({Math.round(progressPercentage)}%)
        </span>
      </div>
    </div>
  );
}

export default WizardProgress;

