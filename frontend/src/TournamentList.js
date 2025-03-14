// frontend/src/TournamentList.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TournamentList = () => {
  const [tournaments, setTournaments] = useState([]);

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const token = localStorage.getItem('jwtToken'); // Если у вас есть авторизация
        const response = await axios.get('http://localhost:3000/api/tournaments', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTournaments(response.data);
      } catch (error) {
        console.error('Ошибка загрузки турниров:', error);
      }
    };
    fetchTournaments();
  }, []);

  return (
    <ul>
      {tournaments.map((tournament) => (
        <li key={tournament.id}>{tournament.name}</li>
      ))}
    </ul>
  );
};

export default TournamentList;