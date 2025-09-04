// frontend/src/components/CreateTournament.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import useLoaderAutomatic from '../hooks/useLoaderAutomaticHook';
import { useAuth } from '../context/AuthContext'; // 🆕 Добавляем AuthContext
import { 
  safeNavigateToTournament, 
  validateApiResponse, 
  handleApiError
} from '../utils/apiUtils';
import './CreateTournament.css';

// Регистрируем русскую локаль
registerLocale('ru', ru);

function CreateTournament() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth(); // 🆕 Получаем пользователя из AuthContext
  const [games, setGames] = useState([]);
  const [cs2Maps, setCs2Maps] = useState([]); // 🆕 Добавляем состояние для карт CS2
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    format: '',
    game: '',
    participant_type: 'team',
    team_size: 5,
    max_teams: 16,
    start_date: '',
    prize_pool: '',
    rules: '',
    bracket_type: 'single_elimination',
    mix_rating_type: 'faceit',
    // 🆕 Тип микса: classic | full (только для format = 'mix')
    mix_type: 'classic',
    // 🆕 Требования привязок для MIX
    require_faceit_linked: false,
    require_steam_linked: false,
    seeding_type: 'random',
    seeding_config: {},
    lobby_enabled: false,
    lobby_match_format: null,
    selected_maps: [],
    // 🆕 НОВОЕ: Опция Full Double Elimination
    full_double_elimination: false,
    // 🆕 Тип турнира: open | closed | final
    tournament_type: 'open',
    // (устаревшее поле – вычисляется из tournament_type)
    is_series_final: false
  });
  const { runWithLoader } = useLoaderAutomatic();

  const getVerificationStatus = () => {
    if (!user) return { canCreate: false, reason: 'not_logged_in' };
    if (!user.email) return { canCreate: false, reason: 'no_email' };
    if (!user.is_verified) return { canCreate: false, reason: 'not_verified' };
    return { canCreate: true, reason: 'verified' };
  };

  // 🆕 Функция для определения игры CS2 (с исправленными ESLint предупреждениями)
  const isCS2Game = (gameName) => {
    if (!gameName) return false;
    const normalizedGame = gameName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalizedGame === 'counterstrike2' || 
           normalizedGame === 'cs2' || 
           (gameName.toLowerCase().includes('counter') && gameName.toLowerCase().includes('strike') && gameName.includes('2'));
  };

  useEffect(() => {
    console.log('Начало загрузки игр');
    // Используем хук для загрузки списка игр с прелоадером
    runWithLoader(async () => {
      try {
        console.log('Отправка запроса на /api/tournaments/games');
        const response = await axios.get('/api/tournaments/games');
        console.log('Ответ от сервера:', response.data);
        setGames(response.data);
        console.log('Состояние games обновлено:', response.data);
        
        // 🆕 Загружаем карты CS2 из БД
        console.log('Загрузка карт CS2...');
        const mapsResponse = await axios.get('/api/maps?game=Counter-Strike 2');
        console.log('Карты CS2 из БД:', mapsResponse.data);
        setCs2Maps(mapsResponse.data);
        console.log('Загружено карт CS2:', mapsResponse.data.length);
      } catch (error) {
        console.error('Ошибка загрузки игр:', error);
        console.error('Детали ошибки:', error.response?.data);
      }
    });
  }, [runWithLoader]);

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    
    // 🆕 Проверка верификации перед созданием турнира
    const verificationStatus = getVerificationStatus();
    if (!verificationStatus.canCreate) {
      if (verificationStatus.reason === 'not_logged_in') {
        alert('Необходима авторизация');
        navigate('/register');
        return;
      } else if (verificationStatus.reason === 'no_email') {
        alert('Для создания турнира необходимо привязать email к аккаунту');
        navigate('/profile');
        return;
      } else if (verificationStatus.reason === 'not_verified') {
        alert('Для создания турнира необходимо подтвердить email');
        navigate('/profile');
        return;
      }
    }
    
    // Проверка токена
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Необходима авторизация');
      return;
    }

    runWithLoader(async () => {
      try {
        console.log('🚀 Начинаем создание турнира...');
        
        const response = await axios.post(
          '/api/tournaments',
          {
            name: formData.name,
            description: formData.description,
            format: formData.format,
            game: formData.game,
            participant_type: formData.participant_type,
            team_size: formData.team_size,
            max_teams: formData.max_teams,
            start_date: formData.start_date,
            prize_pool: formData.prize_pool,
            rules: formData.rules,
            bracket_type: formData.bracket_type, // 🔧 ИСПРАВЛЕНО: передаем bracket_type как есть для всех типов турниров
            mix_rating_type: formData.format === 'mix' ? formData.mix_rating_type : null,
            mix_type: formData.format === 'mix' ? formData.mix_type : null,
            // 🆕 Передаём флаги требований привязок только для MIX
            require_faceit_linked: formData.format === 'mix' && formData.mix_rating_type === 'faceit' ? !!formData.require_faceit_linked : false,
            require_steam_linked: formData.format === 'mix' && formData.mix_rating_type === 'premier' ? !!formData.require_steam_linked : false,
            seeding_type: formData.seeding_type,
            seeding_config: formData.seeding_config,
            // Настройки лобби
            lobby_enabled: isCS2Game(formData.game) ? formData.lobby_enabled : false,
            lobby_match_format: formData.lobby_enabled ? formData.lobby_match_format : null,
            selected_maps: formData.lobby_enabled ? formData.selected_maps : [],
            // 🆕 НОВОЕ: Опция Full Double Elimination
            full_double_elimination: formData.bracket_type === 'double_elimination' ? formData.full_double_elimination : false,
            // 🆕 Тип доступа
            access_type: formData.tournament_type === 'closed' ? 'closed' : 'open',
            // 🆕 Флаг финала серии (из выпадающего списка)
            is_series_final: formData.tournament_type === 'final'
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        console.log('✅ Турнир создан, ответ сервера:', response.data);
        
        // 🔧 НОВАЯ БЕЗОПАСНАЯ ОБРАБОТКА с валидацией структуры ответа
        const validation = validateApiResponse(response, 'CREATE_TOURNAMENT');
        
        if (!validation.isValid) {
          console.error('❌ Структура ответа API не соответствует ожидаемой:', validation.errors);
          throw new Error(`Некорректная структура ответа сервера: ${validation.errors.join(', ')}`);
        }
        
        // 🔧 БЕЗОПАСНАЯ НАВИГАЦИЯ с использованием новых утилит
        const navigationSuccess = safeNavigateToTournament(
          navigate, 
          response, 
          'CREATE_TOURNAMENT',
          (error) => {
            console.error('❌ Ошибка навигации:', error);
            alert('Турнир создан, но возникла ошибка при переходе на страницу турнира');
          }
        );
        
        if (!navigationSuccess) {
          throw new Error('Не удалось перейти на страницу созданного турнира');
        }
        
        console.log('✅ Турнир успешно создан и произведен переход на страницу');
        
      } catch (error) {
        // 🔧 УЛУЧШЕННАЯ ОБРАБОТКА ОШИБОК с использованием новых утилит
        handleApiError(
          error, 
          'Создание турнира',
          (message) => {
            console.error('❌ Обработанная ошибка:', message);
            alert(message);
          }
        );
        
        console.error('❌ Полные детали ошибки:', {
          message: error.message,
          response: error.response?.data,
          stack: error.stack
        });
      }
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFormatChange = (e) => {
    const format = e.target.value;
    console.log('Выбран формат:', format);
    setFormData(prev => {
      const newData = {
        ...prev,
        format,
        team_size: format === 'mix' ? 5 : prev.team_size,
        game: format === 'mix' ? 'counter strike 2' : prev.game, // Исправлено: используем точное название из БД
        participant_type: format === 'mix' ? 'solo' : 'team',
        // 🔧 ИСПРАВЛЕНО: НЕ сбрасываем bracket_type, оставляем выбор пользователя
        mix_rating_type: format === 'mix' ? 'faceit' : prev.mix_rating_type,
        seeding_type: 'random',
        seeding_config: {}
      };
      console.log('Новые данные формы:', newData);
      return newData;
    });
  };

  const handleParticipantTypeChange = (e) => {
    const participant_type = e.target.value;
    setFormData(prev => ({
      ...prev,
      participant_type
    }));
  };

  // 🆕 Обработчик изменения игры
  const handleGameChange = (e) => {
    const selectedGame = e.target.value;
    console.log('Выбрана игра:', selectedGame, 'isCS2:', isCS2Game(selectedGame));
    
    setFormData(prev => {
      const newData = {
        ...prev,
        game: selectedGame,
        // Сбрасываем тип участников при смене игры
        participant_type: isCS2Game(selectedGame) ? 'cs2_classic_5v5' : 'team'
      };
      console.log('Новые данные после выбора игры:', newData);
      return newData;
    });
  };

  const handleSeedingTypeChange = (e) => {
    const seedingType = e.target.value;
    setFormData(prev => ({
      ...prev,
      seeding_type: seedingType,
      seeding_config: {}
    }));
  };

  // 🆕 Функция для рендера предупреждения о верификации
  const renderVerificationWarning = () => {
    if (authLoading) return null;
    
    const verificationStatus = getVerificationStatus();
    
    if (verificationStatus.canCreate) return null;

    if (verificationStatus.reason === 'not_logged_in') {
      return (
        <div className="verification-warning">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <h3>Необходима авторизация</h3>
            <p>Для создания турнира необходимо войти в систему или зарегистрироваться.</p>
            <div className="warning-actions">
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/register')}
              >
                Войти / Регистрация
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (verificationStatus.reason === 'no_email') {
      return (
        <div className="verification-warning">
          <div className="warning-icon">📧</div>
          <div className="warning-content">
            <h3>Требуется привязка email</h3>
            <p>
              Для создания турниров необходимо привязать email к вашему аккаунту. 
              Это нужно для получения уведомлений и обеспечения безопасности.
            </p>
            <div className="warning-actions">
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/profile')}
              >
                Привязать email в профиле
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (verificationStatus.reason === 'not_verified') {
      return (
        <div className="verification-warning">
          <div className="warning-icon">✉️</div>
          <div className="warning-content">
            <h3>Требуется подтверждение email</h3>
            <p>
              Ваш email <strong>{user.email}</strong> не подтвержден. 
              Для создания турниров необходимо подтвердить ваш email адрес.
            </p>
            <div className="warning-actions">
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/profile')}
              >
                Подтвердить email в профиле
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  console.log('Текущий формат:', formData.format);
  console.log('Текущая игра:', formData.game);
  console.log('isCS2Game:', isCS2Game(formData.game));
  console.log('Список игр:', games);

  // 🆕 Показываем загрузку пока проверяется авторизация
  if (authLoading) {
    return (
      <div className="create-tournament loading">
        <div className="loading-spinner"></div>
        <p>Проверка авторизации...</p>
      </div>
    );
  }

  const verificationStatus = getVerificationStatus();

  return (
    <section className="create-tournament">
      <h2>Создать турнир</h2>
      
      {/* 🆕 Отображаем предупреждение о верификации */}
      {renderVerificationWarning()}
      
      <form onSubmit={handleCreateTournament}>
        
        {/* Основная и дополнительная информация в горизонтальной компоновке */}
        <div className="form-main-layout">
          {/* Основная информация */}
          <div className="form-section main-section">
            <h3 className="section-title">Основная информация</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Название турнира</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Введите название турнира"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={!verificationStatus.canCreate} // 🆕 Отключаем для неверифицированных
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Формат турнира</label>
                <select
                  name="format"
                  value={formData.format}
                  onChange={handleFormatChange}
                  disabled={!verificationStatus.canCreate} // 🆕 Отключаем для неверифицированных
                  required
                >
                  <option value="">Выберите формат</option>
                  <option value="single">Single Elimination</option>
                  <option value="double">Double Elimination</option>
                  <option value="mix">Mix</option>
                </select>
              </div>

              <div className="form-group">
                <label>Игра</label>
                <select
                  name="game"
                  value={formData.game}
                  onChange={handleGameChange}
                  disabled={!verificationStatus.canCreate} // 🆕 Отключаем для неверифицированных
                  required
                >
                  {formData.format === 'mix' ? (
                    <option value="counter strike 2">Counter Strike 2</option>
                  ) : (
                    <>
                      <option value="">Выберите игру</option>
                      {games.map((game) => (
                        <option key={game.id} value={game.name.toLowerCase()}>
                          {game.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* 🆕 Тип турнира: открытый/закрытый/финал серии */}
              <div className="form-group">
                <label>Тип турнира</label>
                <select
                  name="tournament_type"
                  value={formData.tournament_type}
                  onChange={handleInputChange}
                  disabled={!verificationStatus.canCreate}
                  required
                >
                  <option value="open">Открытый</option>
                  <option value="closed">Закрытый</option>
                  <option value="final">Финал серии</option>
                </select>
                <small className="form-hint">
                  Открытый — свободное вступление; Закрытый — по приглашению/из отборочных; Финал серии — только победители отборочных.
                </small>
              </div>

              {formData.format !== 'mix' && (
                <div className="form-group">
                  <label>Тип участников</label>
                  <select
                    name="participant_type"
                    value={formData.participant_type}
                    onChange={handleParticipantTypeChange}
                    disabled={!verificationStatus.canCreate} // 🆕 Отключаем для неверифицированных
                    required
                  >
                    <option value="">Выберите тип участников</option>
                    {isCS2Game(formData.game) ? (
                      // CS2-специфичные типы участников
                      <>
                        <option value="cs2_classic_5v5">Классический 5х5</option>
                        <option value="cs2_wingman_2v2">Wingman 2х2</option>
                      </>
                    ) : (
                      // Стандартные типы для других игр
                      <>
                        <option value="team">Командный</option>
                        <option value="solo">Одиночный</option>
                      </>
                    )}
                  </select>
                  {isCS2Game(formData.game) && (
                    <small className="form-hint">
                      {formData.participant_type === 'cs2_classic_5v5' && '🏆 Классический формат CS2: команды минимум 5 игроков'}
                      {formData.participant_type === 'cs2_wingman_2v2' && '⚡ Wingman формат CS2: команды минимум 2 игрока'}
                    </small>
                  )}
                </div>
              )}

              <div className="form-group full-width">
                <label>Дата и время начала</label>
                <DatePicker
                  selected={formData.start_date}
                  onChange={(date) => setFormData((prev) => ({ ...prev, start_date: date }))}
                  showTimeSelect
                  dateFormat="dd.MM.yyyy HH:mm"
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  timeCaption="Время"
                  placeholderText="Выберите дату и время"
                  locale="ru"
                  calendarStartDay={1}
                  minDate={new Date()}
                  className="date-picker-input"
                  disabled={!verificationStatus.canCreate} // 🆕 Отключаем для неверифицированных
                />
                <small className="form-hint">
                  📅 Выберите дату и время начала турнира (российское время)
                </small>
              </div>
            </div>
          </div>

          {/* Дополнительная информация */}
          <div className="form-section additional-section">
            <h3 className="section-title">Дополнительная информация</h3>
            <div className="form-grid single-column">
              <div className="form-group">
                <label>Призовой фонд</label>
                <input
                  type="text"
                  name="prize_pool"
                  placeholder="Например: 10,000₽"
                  value={formData.prize_pool}
                  onChange={handleInputChange}
                  disabled={!verificationStatus.canCreate} // 🆕 Отключаем для неверифицированных
                />
              </div>
              
              <div className="form-group">
                <label>Описание турнира</label>
                <textarea
                  name="description"
                  placeholder="Краткое описание турнира..."
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="4"
                  disabled={!verificationStatus.canCreate} // 🆕 Отключаем для неверифицированных
                />
              </div>
              
              <div className="form-group">
                <label>Правила</label>
                <textarea
                  name="rules"
                  placeholder="Основные правила и условия участия..."
                  value={formData.rules}
                  onChange={handleInputChange}
                  rows="5"
                  disabled={!verificationStatus.canCreate} // 🆕 Отключаем для неверифицированных
                />
              </div>
            </div>
          </div>
        </div>

        {/* Настройки турнирной сетки */}
        <div className="form-section">
          <h3 className="section-title">Турнирная сетка</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Тип турнирной сетки</label>
              <select
                name="bracket_type"
                value={formData.bracket_type}
                onChange={handleInputChange}
                disabled={!verificationStatus.canCreate}
                required
              >
                <option value="single_elimination">Single Elimination</option>
                <option value="double_elimination">Double Elimination</option>
              </select>
              <small className="form-hint">
                {formData.bracket_type === 'single_elimination' && 'Классическая система на выбывание - проигравший исключается из турнира'}
                {formData.bracket_type === 'double_elimination' && 'Система двойного выбывания - каждый участник может проиграть один раз'}
              </small>
            </div>

            {/* 🆕 НОВОЕ: Опция Full Double Elimination */}
            {formData.bracket_type === 'double_elimination' && (
              <div className="form-group full-width">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="full_double_elimination"
                    checked={formData.full_double_elimination}
                    onChange={handleInputChange}
                    disabled={!verificationStatus.canCreate}
                  />
                  <span className="checkbox-text">
                    🏆 Включить Full Double Elimination?
                  </span>
                </label>
                <small className="form-hint">
                  <strong>Full Double Elimination:</strong> Если участник из нижней сетки (Losers Bracket) выиграет Гранд Финал, то будет проведен дополнительный матч "Grand Final Triumph" для определения чемпиона. Преимущество по умолчанию принадлежит участнику из Winners Bracket.
                </small>
              </div>
            )}

            {/* Убран флажок финала серии — используется выпадающий список "Тип турнира" */}
          </div>
        </div>

        {/* Настройки Mix турнира */}
        {formData.format === 'mix' && (
          <div className="form-section">
            <h3 className="section-title">Настройки MIX турнира</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Игроков в команде</label>
                <input
                  type="number"
                  name="team_size"
                  value={formData.team_size}
                  onChange={handleInputChange}
                  min="2"
                  max="10"
                  disabled={!verificationStatus.canCreate}
                  required
                />
              </div>
              
              {/* 🆕 Тип Микса */}
              <div className="form-group">
                <label>Тип Микса</label>
                <select
                  name="mix_type"
                  value={formData.mix_type}
                  onChange={handleInputChange}
                  disabled={!verificationStatus.canCreate}
                  required
                >
                  <option value="classic">Классический МИКС (однократно перед стартом)</option>
                  <option value="full">Фулл МИКС (после каждого тура)</option>
                </select>
                <small className="form-hint">
                  {formData.mix_type === 'classic' && 'Команды формируются один раз перед стартом турнира'}
                  {formData.mix_type === 'full' && 'Команды пересобираются после каждого завершенного тура'}
                </small>
              </div>

              <div className="form-group">
                <label>Формирование команд</label>
                <select
                  name="mix_rating_type"
                  value={formData.mix_rating_type}
                  onChange={handleInputChange}
                  disabled={!verificationStatus.canCreate}
                  required
                >
                  <option value="faceit">Формирование на основе рейтинга</option>
                  <option value="mixed">Случайное формирование без учета рейтинга</option>
                </select>
                <small className="form-hint">
                  {formData.mix_rating_type === 'faceit' && 'Команды формируются на основе рейтинга участников (FACEIT/Premier)'}
                  {formData.mix_rating_type === 'mixed' && 'Команды формируются случайно, рейтинг не учитывается'}
                </small>
              </div>

              {/* 🆕 Требования привязки аккаунтов */}
              {formData.mix_rating_type === 'faceit' && (
                <div className="form-group full-width">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="require_faceit_linked"
                      checked={formData.require_faceit_linked}
                      onChange={handleInputChange}
                      disabled={!verificationStatus.canCreate}
                    />
                    <span className="checkbox-text">Требовать привязки FACEIT аккаунта</span>
                  </label>
                </div>
              )}

              {false && formData.mix_rating_type === 'premier' && (
                <div className="form-group full-width">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="require_steam_linked"
                      checked={formData.require_steam_linked}
                      onChange={handleInputChange}
                      disabled={!verificationStatus.canCreate}
                    />
                    <span className="checkbox-text">Требовать привязки Steam аккаунта</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Настройки лобби матча для CS2 */}
        {isCS2Game(formData.game) && (
          <div className="form-section lobby-settings">
            <h3 className="section-title">🎮 Настройки лобби матча</h3>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="lobby_enabled"
                  checked={formData.lobby_enabled}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    lobby_enabled: e.target.checked,
                    selected_maps: e.target.checked ? cs2Maps.map(m => m.name) : []
                  }))}
                  disabled={!verificationStatus.canCreate}
                />
                <span>Включить лобби матча для выбора карт</span>
              </label>
              <small className="form-hint">
                Участники смогут выбирать и банить карты перед началом матча
              </small>
            </div>

            {formData.lobby_enabled && (
              <>
                <div className="form-group">
                  <label>Формат матчей по умолчанию</label>
                  <select
                    name="lobby_match_format"
                    value={formData.lobby_match_format || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      lobby_match_format: e.target.value || null
                    }))}
                    disabled={!verificationStatus.canCreate}
                  >
                    <option value="">Выбор в лобби</option>
                    <option value="bo1">Best of 1</option>
                    <option value="bo3">Best of 3</option>
                    <option value="bo5">Best of 5</option>
                  </select>
                  <small className="form-hint">
                    Оставьте пустым, чтобы участники выбирали формат в лобби
                  </small>
                </div>

                <div className="form-group">
                  <label>Карты турнира (выберите 7 карт)</label>
                  <div className="maps-selection">
                    {cs2Maps.map(map => (
                      <label key={map.id} className="map-checkbox">
                        <input
                          type="checkbox"
                          value={map.name}
                          checked={formData.selected_maps.includes(map.name)}
                          onChange={(e) => {
                            const mapName = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              selected_maps: e.target.checked
                                ? [...prev.selected_maps, mapName]
                                : prev.selected_maps.filter(m => m !== mapName)
                            }));
                          }}
                          disabled={!verificationStatus.canCreate}
                        />
                        <span>{map.display_name || map.name.replace('de_', '').charAt(0).toUpperCase() + map.name.replace('de_', '').slice(1)}</span>
                      </label>
                    ))}
                  </div>
                  {formData.lobby_enabled && formData.selected_maps.length !== 7 && (
                    <small className="form-error">
                      Необходимо выбрать ровно 7 карт (выбрано: {formData.selected_maps.length})
                    </small>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="form-buttons">
          <button 
            type="submit"
            disabled={!verificationStatus.canCreate} // 🆕 Отключаем кнопку для неверифицированных
            className={!verificationStatus.canCreate ? 'disabled' : ''}
          >
            {verificationStatus.canCreate ? 'Создать турнир' : 'Требуется верификация'}
          </button>
          <button 
            type="button" 
            onClick={() => navigate(-1)}
          >
            Отмена
          </button>
        </div>
      </form>
    </section>
  );
}

export default CreateTournament;