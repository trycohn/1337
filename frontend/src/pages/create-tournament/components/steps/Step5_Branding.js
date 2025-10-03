// frontend/src/pages/create-tournament/components/steps/Step5_Branding.js
import React from 'react';

/**
 * Шаг 5: Брендинг турнира
 * TODO: Добавить загрузку логотипа и баннера
 */
function Step5_Branding({ data, user, onChange }) {
  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const isPro = user?.subscription === 'pro';

  return (
    <div className="wizard-step step-branding">
      <div className="step-header">
        <h2>🎨 Брендинг</h2>
        <p className="step-description">
          Настройте внешний вид вашего турнира (необязательно)
        </p>
      </div>

      <div className="step-section">
        <h3>Визуальное оформление</h3>
        
        <div className="form-group">
          <label>Логотип турнира</label>
          <div style={{ 
            padding: '40px', 
            background: '#1a1a1a', 
            border: '2px dashed #333', 
            borderRadius: '8px', 
            textAlign: 'center',
            color: '#888'
          }}>
            📤 Загрузка изображений будет добавлена в следующей итерации
          </div>
        </div>

        <div className="form-group">
          <label>Основной цвет</label>
          <input
            type="color"
            value={data.primary_color || '#ff0000'}
            onChange={(e) => handleChange('primary_color', e.target.value)}
          />
          <small className="form-hint">
            Цвет будет использоваться для акцентов и кнопок
          </small>
        </div>

        <div className="form-group">
          <label>Дополнительный цвет</label>
          <input
            type="color"
            value={data.secondary_color || '#111111'}
            onChange={(e) => handleChange('secondary_color', e.target.value)}
          />
        </div>
      </div>

      {/* Pro Features Upsell */}
      {!isPro && (
        <div className="step-section" style={{ 
          background: 'linear-gradient(135deg, #1a0000 0%, #111 100%)',
          border: '1px solid #ff0000',
          borderRadius: '8px',
          padding: '30px',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#ff0000', marginBottom: '15px' }}>
            👑 Pro Features
          </h3>
          <p style={{ color: '#ccc', marginBottom: '20px' }}>
            Разблокируйте дополнительные возможности брендинга:
          </p>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0, 
            margin: '20px 0',
            color: '#ddd',
            textAlign: 'left',
            maxWidth: '400px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            <li style={{ padding: '8px 0' }}>✓ Кастомный домен (cup.yourteam.gg)</li>
            <li style={{ padding: '8px 0' }}>✓ Скрытие брендинга 1337</li>
            <li style={{ padding: '8px 0' }}>✓ Логотипы спонсоров</li>
            <li style={{ padding: '8px 0' }}>✓ Приоритетная поддержка</li>
          </ul>
          <button 
            className="btn btn-primary"
            style={{ marginTop: '20px' }}
            onClick={() => alert('Функция в разработке')}
          >
            Перейти на Pro ($49/месяц)
          </button>
        </div>
      )}
    </div>
  );
}

export default Step5_Branding;

