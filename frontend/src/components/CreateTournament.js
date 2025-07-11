// frontend/src/components/CreateTournament.js
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import { useLoaderAutomatic } from '../hooks/useLoaderAutomaticHook';
import './CreateTournament.css';

// Регистрируем русскую локаль
registerLocale('ru', ru);

function CreateTournament() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
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
    seeding_type: 'random',
    seeding_config: {}
  });
  const { runWithLoader } = useLoaderAutomatic();

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
      } catch (error) {
        console.error('Ошибка загрузки игр:', error);
        console.error('Детали ошибки:', error.response?.data);
      }
    });
  }, [runWithLoader]);

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Войдите, чтобы создать турнир');
      return;
    }

    // Проверяем, что указана дата старта
    if (!formData.start_date) {
      alert('Необходимо выбрать дату начала турнира');
      return;
    }

    // Используем хук для создания турнира с прелоадером
    runWithLoader(async () => {
      try {
        const response = await axios.post(
          '/api/tournaments',
          {
            name: formData.name,
            game: formData.game,
            format: formData.format,
            participant_type: formData.participant_type,
            team_size: formData.format === 'mix' ? formData.team_size : null,
            max_teams: formData.format === 'mix' ? formData.max_teams : null,
            start_date: formData.start_date.toISOString(),
            description: formData.description,
            prize_pool: formData.prize_pool,
            rules: formData.rules,
            bracket_type: formData.format === 'mix' ? formData.bracket_type : 'single_elimination',
            mix_rating_type: formData.format === 'mix' ? formData.mix_rating_type : null,
            seeding_type: formData.seeding_type,
            seeding_config: formData.seeding_config
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        // Перенаправляем на страницу созданного турнира
        navigate(`/tournaments/${response.data.id}`);
        
      } catch (error) {
        console.error('Ошибка создания турнира:', error);
        alert(error.response?.data?.error || 'Ошибка создания турнира');
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
        bracket_type: format === 'mix' ? 'single_elimination' : 'single_elimination',
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

  console.log('Текущий формат:', formData.format);
  console.log('Текущая игра:', formData.game);
  console.log('isCS2Game:', isCS2Game(formData.game));
  console.log('Список игр:', games);

  return (
    <section className="create-tournament">
      <h2>Создать турнир</h2>
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
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Формат турнира</label>
                <select
                  name="format"
                  value={formData.format}
                  onChange={handleFormatChange}
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

              {formData.format !== 'mix' && (
                <div className="form-group">
                  <label>Тип участников</label>
                  <select
                    name="participant_type"
                    value={formData.participant_type}
                    onChange={handleParticipantTypeChange}
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
                />
              </div>
            </div>
          </div>
        </div>

        {/* Настройки Mix турнира */}
        {formData.format === 'mix' && (
          <div className="form-section">
            <h3 className="section-title">Настройки Mix турнира</h3>
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
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Тип рейтинга для команд</label>
                <select
                  name="mix_rating_type"
                  value={formData.mix_rating_type}
                  onChange={handleInputChange}
                  required
                >
                  <option value="faceit">FACEIT ELO</option>
                  <option value="premier">CS2 Premier Rank</option>
                  <option value="mixed">Полный микс (без учета рейтинга)</option>
                </select>
                <small className="form-hint">
                  {formData.mix_rating_type === 'faceit' && 'Команды будут сформированы на основе FACEIT ELO участников'}
                  {formData.mix_rating_type === 'premier' && 'Команды будут сформированы на основе CS2 Premier ранга участников'}
                  {formData.mix_rating_type === 'mixed' && 'Участники будут распределены случайно, без учета рейтинга'}
                </small>
              </div>
              
              <div className="form-group">
                <label>Тип турнирной сетки</label>
                <select
                  name="bracket_type"
                  value={formData.bracket_type}
                  onChange={handleInputChange}
                  required
                >
                  <option value="single_elimination">Single Elimination</option>
                  <option value="double_elimination">Double Elimination</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Настройки распределения участников */}
        <div className="form-section">
          <h3 className="section-title">Распределение участников</h3>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Тип распределения</label>
              <select
                name="seeding_type"
                value={formData.seeding_type}
                onChange={handleSeedingTypeChange}
                required
              >
                <option value="random">Случайное распределение</option>
                <option value="ranking">По рейтингу</option>
                <option value="balanced">Сбалансированное</option>
                <option value="manual">Ручное (настраивается позже)</option>
              </select>
              <small className="form-hint">
                {formData.seeding_type === 'random' && '🎲 Участники будут распределены случайным образом'}
                {formData.seeding_type === 'ranking' && '🏆 Участники будут распределены по рейтингу (FACEIT ELO / CS2 Premier)'}
                {formData.seeding_type === 'balanced' && '⚖️ Участники будут распределены для максимального баланса матчей'}
                {formData.seeding_type === 'manual' && '✏️ Администратор сможет настроить распределение вручную при генерации сетки'}
              </small>
            </div>
            
            {/* Дополнительные настройки для распределения по рейтингу */}
            {formData.seeding_type === 'ranking' && (
              <div className="form-group">
                <label>Тип рейтинга</label>
                <select
                  value={formData.seeding_config.ratingType || 'faceit_elo'}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    seeding_config: {
                      ...prev.seeding_config,
                      ratingType: e.target.value
                    }
                  }))}
                >
                  <option value="faceit_elo">FACEIT ELO</option>
                  <option value="cs2_premier_rank">CS2 Premier Rank</option>
                </select>
              </div>
            )}
            
            {formData.seeding_type === 'ranking' && (
              <div className="form-group">
                <label>Направление сортировки</label>
                <select
                  value={formData.seeding_config.direction || 'desc'}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    seeding_config: {
                      ...prev.seeding_config,
                      direction: e.target.value
                    }
                  }))}
                >
                  <option value="desc">От высшего к низшему</option>
                  <option value="asc">От низшего к высшему</option>
                </select>
                <small className="form-hint">
                  Определяет, как будут расставлены сильные и слабые игроки в первом раунде
                </small>
              </div>
            )}
          </div>
          
          <div className="seeding-info-box">
            <h4>💡 Информация о типах распределения:</h4>
            <ul>
              <li><strong>Случайное:</strong> Подходит для дружеских турниров, где важна непредсказуемость</li>
              <li><strong>По рейтингу:</strong> Классическое спортивное распределение, сильные против слабых в начале</li>
              <li><strong>Сбалансированное:</strong> Максимально интересные матчи на всех этапах турнира</li>
              <li><strong>Ручное:</strong> Полный контроль администратора над распределением</li>
            </ul>
          </div>
        </div>

        <div className="form-buttons">
          <button type="submit">Создать турнир</button>
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