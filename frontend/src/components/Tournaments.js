import { useState, useEffect } from 'react';
import axios from 'axios';
import useLoaderAutomatic from '../hooks/useLoaderAutomaticHook';

function Tournaments() {
  const [tournaments, setTournaments] = useState([]);
  const { runWithLoader } = useLoaderAutomatic();

  useEffect(() => {
    // Используем хук для загрузки турниров с прелоадером
    runWithLoader(async () => {
      try {
        const response = await axios.get('/api/tournaments');
        setTournaments(response.data);
      } catch (error) {
        console.error('Ошибка получения турниров:', error);
      }
    });
  }, [runWithLoader]);

  return (
    <section className="tournaments-list">
      <h2>Список турниров</h2>
      {tournaments.length > 0 ? (
        <ul>
          {tournaments.map((tournament) => (
            <li key={tournament.id}>
              {tournament.name} ({tournament.type}) -{' '}
              {tournament.status === 'open' ? 'Открыт' : 'Завершен'}
            </li>
          ))}
        </ul>
      ) : (
        <p>Турниров пока нет.</p>
      )}
    </section>
  );
}

export default Tournaments;