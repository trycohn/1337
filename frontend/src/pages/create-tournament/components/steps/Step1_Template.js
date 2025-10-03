// frontend/src/pages/create-tournament/components/steps/Step1_Template.js
import React from 'react';

/**
 * Шаг 1: Выбор шаблона турнира
 * TODO: Реализовать в следующем этапе
 */
function Step1_Template({ data, onChange, onApplyTemplate }) {
  return (
    <div className="wizard-step step-template">
      <div className="step-header">
        <h2>📋 Выбор шаблона</h2>
        <p className="step-description">
          Выберите готовый шаблон турнира или создайте с нуля
        </p>
      </div>

      <div className="step-section">
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
          <h3>🚧 В разработке</h3>
          <p>Библиотека шаблонов будет добавлена в следующем этапе.</p>
          <p style={{ marginTop: '20px' }}>
            Пока вы можете пропустить этот шаг и настроить турнир вручную.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Step1_Template;

