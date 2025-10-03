// frontend/src/pages/create-tournament/components/steps/Step2_BasicInfo.js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';

// Регистрируем русскую локаль для DatePicker
registerLocale('ru', ru);

/**
 * Шаг 2: Базовая информация о турнире
 * Полная реализация с DatePicker, загрузкой игр и логотипа
 */
function Step2_BasicInfo({ data, onChange }) {
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Загрузка списка игр из БД
  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoadingGames(true);
        const response = await axios.get('/api/tournaments/games');
        setGames(response.data);
        console.log('✅ Загружено игр:', response.data.length);
      } catch (error) {
        console.error('❌ Ошибка загрузки игр:', error);
        // Fallback: базовый список
        setGames([
          { id: 1, name: 'Counter-Strike 2' },
          { id: 2, name: 'Dota 2' }
        ]);
      } finally {
        setLoadingGames(false);
      }
    };

    fetchGames();
  }, []);

  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const handleLogoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Проверка размера файла (макс 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Размер файла не должен превышать 2MB');
      return;
    }

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      alert('Можно загружать только изображения');
      return;
    }

    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
    
    // Сохраняем файл в состоянии для последующей загрузки
    handleChange('logo_file', file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    handleChange('logo_file', null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="wizard-step step-basic-info">
      <div className="step-header">
        <h2>📝 Базовая информация</h2>
        <p className="step-description">
          Основные данные о вашем турнире
        </p>
      </div>

      <div className="step-section">
        <h3>Основное</h3>
        
        {/* Название турнира */}
        <div className="form-group">
          <label>Название турнира *</label>
          <input
            type="text"
            placeholder="Например: CS2 Winter Cup 2025"
            value={data.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            maxLength={100}
            required
          />
          <small className="form-hint">
            {data.name?.length || 0}/100 символов
          </small>
        </div>

        {/* Описание */}
        <div className="form-group">
          <label>Описание турнира</label>
          <textarea
            placeholder="Краткое описание турнира, его особенности и цели..."
            value={data.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            rows="4"
            maxLength={500}
          />
          <small className="form-hint">
            {data.description?.length || 0}/500 символов. Будет показано на странице турнира.
          </small>
        </div>

        {/* Игра */}
        <div className="form-group">
          <label>Дисциплина *</label>
          {loadingGames ? (
            <div style={{ padding: '12px', color: '#888' }}>
              Загрузка списка игр...
            </div>
          ) : (
            <>
              <select
                value={data.game || ''}
                onChange={(e) => handleChange('game', e.target.value)}
                required
              >
                <option value="">Выберите игру</option>
                {games.map((game) => (
                  <option key={game.id} value={game.name.toLowerCase()}>
                    {game.name}
                  </option>
                ))}
              </select>
              <small className="form-hint">
                Выберите дисциплину турнира. Это определит доступные форматы и настройки.
              </small>
            </>
          )}
        </div>

        {/* Дата и время начала */}
        <div className="form-group">
          <label>Дата и время начала *</label>
          <DatePicker
            selected={data.start_date ? new Date(data.start_date) : null}
            onChange={(date) => handleChange('start_date', date)}
            showTimeSelect
            dateFormat="dd.MM.yyyy HH:mm"
            timeFormat="HH:mm"
            timeIntervals={15}
            timeCaption="Время"
            placeholderText="Выберите дату и время начала турнира"
            locale="ru"
            calendarStartDay={1}
            minDate={new Date()}
            className="date-picker-input"
            required
          />
          <small className="form-hint">
            Укажите дату и время начала турнира (московское время)
          </small>
        </div>

        {/* Призовой фонд */}
        <div className="form-group">
          <label>Призовой фонд</label>
          <input
            type="text"
            placeholder="Например: 10,000₽ или 5,000 Leet Coins"
            value={data.prize_pool || ''}
            onChange={(e) => handleChange('prize_pool', e.target.value)}
            maxLength={50}
          />
          <small className="form-hint">
            Необязательное поле. Укажите призовой фонд если он есть.
          </small>
        </div>

        {/* Тип турнира */}
        <div className="form-group">
          <label>Тип турнира *</label>
          <select
            value={data.tournament_type || 'open'}
            onChange={(e) => handleChange('tournament_type', e.target.value)}
            required
          >
            <option value="open">Открытый</option>
            <option value="closed">Закрытый</option>
            <option value="hidden">Скрытый</option>
            <option value="final">Финал серии</option>
          </select>
          <small className="form-hint">
            {data.tournament_type === 'open' && '🌍 Свободная регистрация для всех'}
            {data.tournament_type === 'closed' && '🔒 Только по приглашениям или из отборочных'}
            {data.tournament_type === 'hidden' && '👻 Не показывается в общем списке'}
            {data.tournament_type === 'final' && '🏆 Финал серии турниров - только победители отборочных'}
          </small>
        </div>
      </div>

      {/* Секция брендинга (опционально) */}
      <div className="step-section">
        <h3>Визуальное оформление (необязательно)</h3>
        
        <div className="form-group">
          <label>Логотип турнира</label>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              style={{ whiteSpace: 'nowrap' }}
            >
              {logoPreview ? '📤 Заменить логотип' : '📤 Загрузить логотип'}
            </button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
            
            {logoPreview && (
              <div style={{ position: 'relative' }}>
                <img
                  src={logoPreview}
                  alt="Предпросмотр логотипа"
                  style={{
                    width: '100px',
                    height: '100px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '2px solid #333'
                  }}
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#ff0000',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    lineHeight: '24px',
                    padding: 0
                  }}
                  title="Удалить логотип"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <small className="form-hint">
            Рекомендуемый размер: 500x500 px, максимум 2MB. Форматы: JPG, PNG, SVG.
          </small>
        </div>
      </div>
    </div>
  );
}

export default Step2_BasicInfo;

