import { useState, useEffect } from 'react';
import axios from 'axios';

function Tournaments() {
  const [tournaments, setTournaments] = useState([]);

  useEffect(() => {
    axios
      .get('/api/tournaments')
      .then((response) => setTournaments(response.data))
      .catch((error) => console.error('Ошибка получения турниров:', error));
  }, []);

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