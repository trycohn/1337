// frontend/src/pages/create-tournament/components/steps/Step5_Branding.js
import React, { useRef } from 'react';

/**
 * Шаг 5: Брендинг турнира
 * Полная реализация с загрузкой логотипа, баннера, цветами
 */
function Step5_Branding({ data, user, onChange }) {
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const isPro = user?.subscription === 'pro';

  // Обработчик загрузки логотипа
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валидация
    if (file.size > 2 * 1024 * 1024) {
      alert('Размер файла не должен превышать 2MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Можно загружать только изображения');
      return;
    }

    // Создаем URL для предпросмотра
    const url = URL.createObjectURL(file);
    handleChange('logo_file', file);
    handleChange('logo_preview', url);
  };

  // Обработчик загрузки баннера
  const handleBannerUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валидация
    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Можно загружать только изображения');
      return;
    }

    const url = URL.createObjectURL(file);
    handleChange('banner_file', file);
    handleChange('banner_preview', url);
  };

  // Удаление логотипа
  const handleRemoveLogo = () => {
    handleChange('logo_file', null);
    handleChange('logo_preview', null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  // Удаление баннера
  const handleRemoveBanner = () => {
    handleChange('banner_file', null);
    handleChange('banner_preview', null);
    if (bannerInputRef.current) bannerInputRef.current.value = '';
  };

  return (
    <div className="wizard-step step-branding">
      <div className="step-header">
        <h2>🎨 Брендинг</h2>
        <p className="step-description">
          Настройте внешний вид вашего турнира (необязательно)
        </p>
      </div>

      <div className="step-section">
        <h3>Изображения</h3>
        
        {/* Логотип турнира */}
        <div className="form-group">
          <label>Логотип турнира</label>
          <div className="image-upload-area">
            <input
              type="file"
              ref={logoInputRef}
              onChange={handleLogoUpload}
              accept="image/*"
              style={{ display: 'none' }}
            />
            
            {data.logo_preview || data.logo_url ? (
              <div className="image-preview">
                <img
                  src={data.logo_preview || data.logo_url}
                  alt="Логотип"
                  style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                />
                <div className="preview-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    Заменить
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleRemoveLogo}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => logoInputRef.current?.click()}
                style={{ width: '100%', padding: '40px', fontSize: '16px' }}
              >
                📤 Загрузить логотип
              </button>
            )}
          </div>
          <small className="form-hint">
            Рекомендуемый размер: 500×500px, макс 2MB. Форматы: JPG, PNG, SVG
          </small>
        </div>

        {/* Баннер турнира */}
        <div className="form-group">
          <label>Баннер турнира</label>
          <div className="image-upload-area">
            <input
              type="file"
              ref={bannerInputRef}
              onChange={handleBannerUpload}
              accept="image/*"
              style={{ display: 'none' }}
            />
            
            {data.banner_preview || data.banner_url ? (
              <div className="image-preview">
                <img
                  src={data.banner_preview || data.banner_url}
                  alt="Баннер"
                  style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
                />
                <div className="preview-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => bannerInputRef.current?.click()}
                  >
                    Заменить
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleRemoveBanner}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => bannerInputRef.current?.click()}
                style={{ width: '100%', padding: '40px', fontSize: '16px' }}
              >
                📤 Загрузить баннер
              </button>
            )}
          </div>
          <small className="form-hint">
            Рекомендуемый размер: 1920×400px, макс 5MB. Отображается в шапке турнира
          </small>
        </div>
      </div>

      <div className="step-section">
        <h3>Цветовая схема</h3>
        
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div className="form-group">
            <label>Основной цвет</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="color"
                value={data.primary_color || '#ff0000'}
                onChange={(e) => handleChange('primary_color', e.target.value)}
                style={{ width: '60px', height: '40px', cursor: 'pointer', border: '1px solid #333', borderRadius: '6px' }}
              />
              <input
                type="text"
                value={data.primary_color || '#ff0000'}
                onChange={(e) => handleChange('primary_color', e.target.value)}
                placeholder="#ff0000"
                style={{ flex: 1 }}
              />
            </div>
            <small className="form-hint">
              Акцентный цвет для кнопок и заголовков
            </small>
          </div>

          <div className="form-group">
            <label>Дополнительный цвет</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="color"
                value={data.secondary_color || '#111111'}
                onChange={(e) => handleChange('secondary_color', e.target.value)}
                style={{ width: '60px', height: '40px', cursor: 'pointer', border: '1px solid #333', borderRadius: '6px' }}
              />
              <input
                type="text"
                value={data.secondary_color || '#111111'}
                onChange={(e) => handleChange('secondary_color', e.target.value)}
                placeholder="#111111"
                style={{ flex: 1 }}
              />
            </div>
            <small className="form-hint">
              Цвет фона и второстепенных элементов
            </small>
          </div>
        </div>

        {/* Превью цветов */}
        <div style={{ 
          marginTop: '20px', 
          padding: '20px', 
          background: '#1a1a1a', 
          borderRadius: '8px',
          border: '1px solid #333'
        }}>
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
            Предпросмотр кнопок:
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{
                background: data.primary_color || '#ff0000',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'default'
              }}
            >
              Основная кнопка
            </button>
            <button
              type="button"
              style={{
                background: 'transparent',
                color: data.primary_color || '#ff0000',
                border: `2px solid ${data.primary_color || '#ff0000'}`,
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'default'
              }}
            >
              Вторичная кнопка
            </button>
          </div>
        </div>
      </div>

      {/* Pro Features Upsell */}
      {!isPro && (
        <div className="step-section pro-upsell">
          <h3 style={{ color: '#ff0000', marginBottom: '15px', textAlign: 'center' }}>
            👑 Pro Features
          </h3>
          <p style={{ color: '#ccc', marginBottom: '20px', textAlign: 'center' }}>
            Разблокируйте дополнительные возможности брендинга:
          </p>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0, 
            margin: '20px 0',
            color: '#ddd',
            maxWidth: '400px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            <li style={{ padding: '8px 0', display: 'flex', gap: '10px' }}>
              <span>✓</span> Кастомный домен (cup.yourteam.gg)
            </li>
            <li style={{ padding: '8px 0', display: 'flex', gap: '10px' }}>
              <span>✓</span> Скрытие брендинга 1337 Community
            </li>
            <li style={{ padding: '8px 0', display: 'flex', gap: '10px' }}>
              <span>✓</span> Логотипы спонсоров
            </li>
            <li style={{ padding: '8px 0', display: 'flex', gap: '10px' }}>
              <span>✓</span> Приоритетная поддержка
            </li>
          </ul>
          <div style={{ textAlign: 'center' }}>
            <button 
              type="button"
              className="btn btn-primary"
              onClick={() => alert('Функция в разработке')}
            >
              Перейти на Pro ($49/месяц)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Step5_Branding;

