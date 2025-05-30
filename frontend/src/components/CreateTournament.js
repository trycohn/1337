// frontend/src/components/CreateTournament.js
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import useLoaderAutomatic from '../hooks/useLoaderAutomaticHook';
import './CreateTournament.css';

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
    bracket_type: 'single_elimination'
  });
  const { runWithLoader } = useLoaderAutomatic();

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
            bracket_type: formData.format === 'mix' ? formData.bracket_type : null
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
        game: format === 'mix' ? 'cs2' : '',
        participant_type: format === 'mix' ? 'solo' : 'team',
        bracket_type: format === 'mix' ? 'single_elimination' : null
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

  console.log('Текущий формат:', formData.format);
  console.log('Текущая игра:', formData.game);
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
                  onChange={handleInputChange}
                  required
                >
                  {formData.format === 'mix' ? (
                    <option value="cs2">Counter Strike 2</option>
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
                    <option value="team">Командный</option>
                    <option value="solo">Одиночный</option>
                  </select>
                </div>
              )}

              <div className="form-group full-width">
                <label>Дата и время начала</label>
                <DatePicker
                  selected={formData.start_date}
                  onChange={(date) => setFormData((prev) => ({ ...prev, start_date: date }))}
                  showTimeSelect
                  dateFormat="Pp"
                  placeholderText="Выберите дату и время"
                />
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