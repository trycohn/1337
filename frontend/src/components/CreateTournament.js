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
    game: 'cs2', // Фиксированное значение для CS2
    team_size: 5, // Значение по умолчанию для Mix турнира
    max_teams: 16,
    start_date: '',
    prize_pool: '',
    rules: ''
  });
  const { runWithLoader } = useLoaderAutomatic();

  useEffect(() => {
    // Используем хук для загрузки списка игр с прелоадером
    runWithLoader(async () => {
      try {
        const response = await axios.get('/api/tournaments/games');
        setGames(response.data);
      } catch (error) {
        console.error('Ошибка загрузки игр:', error);
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
            team_size: formData.format === 'mix' ? formData.team_size : null,
            max_teams: formData.format === 'mix' ? formData.max_teams : null,
            start_date: formData.start_date.toISOString(),
            description: formData.description,
            prize_pool: formData.prize_pool,
            rules: formData.rules
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
    setFormData(prev => ({
      ...prev,
      format,
      // Для Mix турнира автоматически устанавливаем team_size
      team_size: format === 'mix' ? 5 : prev.team_size
    }));
  };

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
        {formData.format === 'mix' && (
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