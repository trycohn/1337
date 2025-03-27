// frontend/src/components/CreateTournament.js
import { useState, useEffect } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

function CreateTournament({ onTournamentCreated }) {
  const [games, setGames] = useState([]);
  const [createForm, setCreateForm] = useState({
    name: '',
    game: '',
    format: 'single_elimination',
    participant_type: 'solo',
    hasLimit: false,
    max_participants: '',
    start_date: new Date(),
    description: '',
  });

  useEffect(() => {
    axios
      .get('/api/tournaments/games')
      .then((response) => setGames(response.data))
      .catch((error) => console.error('Ошибка загрузки игр:', error));
  }, []);

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Войдите, чтобы создать турнир');
      return;
    }
    try {
      const response = await axios.post(
        '/api/tournaments',
        {
          name: createForm.name,
          game: createForm.game,
          format: createForm.format,
          participant_type: createForm.participant_type,
          max_participants: createForm.hasLimit ? parseInt(createForm.max_participants) : null,
          start_date: createForm.start_date.toISOString(),
          description: createForm.description,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onTournamentCreated(response.data); // Передаём созданный турнир родителю
      setCreateForm({
        name: '',
        game: '',
        format: 'single_elimination',
        participant_type: 'solo',
        hasLimit: false,
        max_participants: '',
        start_date: new Date(),
        description: '',
      });
    } catch (error) {
      console.error('Ошибка создания турнира:', error);
      alert(error.response?.data?.error || 'Ошибка создания турнира');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCreateForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
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
          value={createForm.name}
          onChange={handleInputChange}
          required
        />
        <select
          name="game"
          value={createForm.game}
          onChange={handleInputChange}
          required
        >
          <option value="">Выберите игру</option>
          {games.map((game) => (
            <option key={game.id} value={game.name}>
              {game.name}
            </option>
          ))}
        </select>
        <select
          name="format"
          value={createForm.format}
          onChange={handleInputChange}
        >
          <option value="single_elimination">Single Elimination</option>
          <option value="double_elimination">Double Elimination</option> {/* Изменено с full_double_elimination */}
          <option value="mix">Mix</option>
          <option value="round_robin">Групповой (Round Robin)</option>
        </select>
        <select
          name="participant_type"
          value={createForm.participant_type}
          onChange={handleInputChange}
        >
          <option value="solo">Solo</option>
          <option value="team">Команда</option>
        </select>
        <label>
          Ограничение участников:
          <input
            type="checkbox"
            name="hasLimit"
            checked={createForm.hasLimit}
            onChange={handleInputChange}
          />
        </label>
        {createForm.hasLimit && (
          <input
            type="number"
            name="max_participants"
            placeholder="Макс. участников"
            value={createForm.max_participants}
            onChange={handleInputChange}
            required
          />
        )}
        <DatePicker
          selected={createForm.start_date}
          onChange={(date) => setCreateForm((prev) => ({ ...prev, start_date: date }))}
          showTimeSelect
          dateFormat="Pp"
          placeholderText="Выберите дату и время"
        />
        <input
          type="text"
          name="description"
          placeholder="Описание (опционально)"
          value={createForm.description}
          onChange={handleInputChange}
        />
        <button type="submit">Создать турнир</button>
      </form>
    </section>
  );
}

export default CreateTournament;