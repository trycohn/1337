import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AddParticipant from './AddParticipant';
import './TournamentAdmin.css';

const TournamentAdmin = ({ tournamentId }) => {
    const [tournament, setTournament] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTournamentData = async () => {
        try {
            const token = localStorage.getItem('jwtToken');
            const tournamentResponse = await axios.get(
                `/api/tournaments/${tournamentId}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            setTournament(tournamentResponse.data);

            const participantsResponse = await axios.get(
                `/api/tournaments/${tournamentId}/participants`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            setParticipants(participantsResponse.data.participants);
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tournamentId) {
            fetchTournamentData();
        }
    }, [tournamentId]);

    const handleParticipantAdded = () => {
        fetchTournamentData();
    };

    const handleGenerateBracket = async () => {
        try {
            const token = localStorage.getItem('jwtToken');
            await axios.post(
                `/api/tournaments/${tournamentId}/generate-bracket`, // Предполагаемый маршрут
                {},
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            alert('Сетка сгенерирована!');
            // Здесь можно добавить логику для отображения сетки
        } catch (error) {
            alert(`Ошибка: ${error.response?.data?.error || error.message}`);
        }
    };

    if (!tournamentId) {
        return <div>Выберите турнир</div>;
    }

    if (loading) {
        return <div>Загрузка...</div>;
    }

    return (
        <div className="tournament-admin">
            <h2>{tournament.name}</h2>
            <p>{tournament.description}</p>
            <AddParticipant 
                tournamentId={tournamentId} 
                onParticipantAdded={handleParticipantAdded} 
            />
            <h3>Участники</h3>
            <ul>
                {participants.map(participant => (
                    <li key={participant.id}>{participant.name}</li>
                ))}
            </ul>
            <button onClick={handleGenerateBracket}>Сформировать сетку</button>
        </div>
    );
};

export default TournamentAdmin;