// frontend/src/pages/create-tournament/components/WizardNavigation.js
import React from 'react';
import '../styles/WizardNavigation.css';

/**
 * Навигация Wizard (Назад / Далее / Создать)
 */
function WizardNavigation({
  currentStep,
  totalSteps,
  canProceed,
  onBack,
  onNext,
  onCreate,
}) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="wizard-navigation">
      <div className="nav-container">
        {/* Кнопка "Назад" */}
        {!isFirstStep && (
          <button
            type="button"
            className="btn btn-secondary nav-back"
            onClick={onBack}
          >
            ← Назад
          </button>
        )}

        {/* Spacer для центрирования */}
        <div className="nav-spacer" />

        {/* Кнопка "Далее" или "Создать турнир" */}
        {!isLastStep ? (
          <button
            type="button"
            className={`btn btn-primary nav-next ${!canProceed ? 'disabled' : ''}`}
            onClick={onNext}
            disabled={!canProceed}
            title={!canProceed ? 'Заполните все обязательные поля' : ''}
          >
            Далее →
          </button>
        ) : (
          <button
            type="button"
            className={`btn btn-primary nav-create ${!canProceed ? 'disabled' : ''}`}
            onClick={onCreate}
            disabled={!canProceed}
          >
            🎉 Создать турнир
          </button>
        )}
      </div>

      {/* Подсказка о заполнении */}
      {!canProceed && !isLastStep && (
        <div className="nav-hint">
          ⚠️ Заполните все обязательные поля для продолжения
        </div>
      )}
    </div>
  );
}

export default WizardNavigation;

