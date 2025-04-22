// frontend/src/components/CreateTournament.js
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import useLoaderAutomatic from '../hooks/useLoaderAutomaticHook';

// Добавляем немного встроенных стилей
const styles = {
  formButtons: {
    display: 'flex',
    gap: '10px',
    marginTop: '15px'
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    color: '#333',
    border: '1px solid #ccc'
  }
};

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
        <input
          type="text"
          name="name"
          placeholder="Название турнира"
          value={formData.name}
          onChange={handleInputChange}
          required
        />
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
        {formData.format !== 'mix' && (
          <select
            name="participant_type"
            value={formData.participant_type}
            onChange={handleParticipantTypeChange}
            required
          >
            <option value="team">Командный</option>
            <option value="solo">Одиночный</option>
          </select>
        )}
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
        {formData.format === 'mix' && (
          <>
            <div className="form-group">
              <label>Количество игроков в команде</label>
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
              <label>Формат турнирной сетки</label>
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
          </>
        )}
        <DatePicker
          selected={formData.start_date}
          onChange={(date) => setFormData((prev) => ({ ...prev, start_date: date }))}
          showTimeSelect
          dateFormat="Pp"
          placeholderText="Выберите дату и время"
        />
        <input
          type="text"
          name="description"
          placeholder="Описание (опционально)"
          value={formData.description}
          onChange={handleInputChange}
        />
        <input
          type="text"
          name="prize_pool"
          placeholder="Призовой фонд (опционально)"
          value={formData.prize_pool}
          onChange={handleInputChange}
        />
        <input
          type="text"
          name="rules"
          placeholder="Правила (опционально)"
          value={formData.rules}
          onChange={handleInputChange}
        />
        <div style={styles.formButtons}>
          <button type="submit">Создать турнир</button>
          <button 
            type="button" 
            onClick={() => navigate(-1)} 
            style={styles.cancelButton}
          >
            Отмена
          </button>
        </div>
      </form>
    </section>
  );
}

export default CreateTournament;