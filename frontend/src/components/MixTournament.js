import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './MixTournament.css';

const MixTournament = () => {
    const { id } = useParams();
    const [tournament, setTournament] = useState(null);
    const [players, setPlayers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [ratingType, setRatingType] = useState('faceit'); // 'faceit' или 'premier'

    // Функция для расчета рейтинга игрока
    const calculatePlayerRating = (player) => {
        if (ratingType === 'faceit') {
            // Приоритет отдается FACEit рейтингу
            return player.faceit_rating || 1000; // 1000 - базовый ранг
        } else {
            // Для Premier ранга
            const premierRank = player.premier_rank || 5; // 5 - базовый ранг
            return premierRank * 200; // Конвертируем ранг в рейтинг
        }
    };

    // Функция для формирования команд
    const formTeams = (players, teamSize) => {
        // Сортируем игроков по рейтингу
        const sortedPlayers = [...players].sort((a, b) => 
            calculatePlayerRating(b) - calculatePlayerRating(a)
        );

        const numTeams = Math.floor(players.length / teamSize);
        const teams = Array(numTeams).fill().map(() => ({
            players: [],
            totalRating: 0
        }));

        // Распределяем игроков по командам
        sortedPlayers.forEach((player, index) => {
            // Определяем команду с наименьшим общим рейтингом
            const teamIndex = teams.reduce((minIndex, team, currentIndex) => 
                team.totalRating < teams[minIndex].totalRating ? currentIndex : minIndex, 0
            );

            teams[teamIndex].players.push(player);
            teams[teamIndex].totalRating += calculatePlayerRating(player);
        });

        return teams;
    };

    useEffect(() => {
        const fetchTournamentData = async () => {
            try {
                // Загрузка данных турнира
                const tournamentResponse = await axios.get(`/api/tournaments/${id}`);
                setTournament(tournamentResponse.data);
                
                // Загрузка зарегистрированных игроков
                const playersResponse = await axios.get(`/api/tournaments/${id}/players`);
                setPlayers(playersResponse.data);

                // Формирование команд
                if (tournamentResponse.data.team_size && playersResponse.data.length > 0) {
                    const formedTeams = formTeams(playersResponse.data, tournamentResponse.data.team_size);
                    setTeams(formedTeams);
                }

                setLoading(false);
            } catch (err) {
                setError('Ошибка при загрузке данных турнира');
                setLoading(false);
            }
        };

        fetchTournamentData();
    }, [id, ratingType]);

    const handleRatingTypeChange = (type) => {
        setRatingType(type);
    };

    if (loading) return <div className="loading">Загрузка данных турнира...</div>;
    if (error) return <div className="error">{error}</div>;
    if (!tournament) return null;

    return (
        <div className="mix-tournament">
            <div className="tournament-info">
                <h1>{tournament.name}</h1>
                <p>Формат: {tournament.format}</p>
                <p>Размер команды: {tournament.team_size} игроков</p>
                
                <div className="rating-type-selector">
                    <button 
                        className={ratingType === 'faceit' ? 'active' : ''}
                        onClick={() => handleRatingTypeChange('faceit')}
                    >
                        FACEit Рейтинг
                    </button>
                    <button 
                        className={ratingType === 'premier' ? 'active' : ''}
                        onClick={() => handleRatingTypeChange('premier')}
                    >
                        Premier Ранг
                    </button>
                </div>
            </div>

            <div className="teams-section">
                <h2>Сформированные команды</h2>
                <div className="teams-grid">
                    {teams.map((team, index) => (
                        <div key={index} className="team-card">
                            <h3>Команда {index + 1}</h3>
                            <p>Общий рейтинг: {Math.round(team.totalRating)}</p>
                            <div className="players-list">
                                {team.players.map((player, playerIndex) => (
                                    <div key={playerIndex} className="player-item">
                                        <span className="player-name">{player.name}</span>
                                        <span className="player-rating">
                                            {ratingType === 'faceit' 
                                                ? `FACEit: ${player.faceit_rating || 1000}`
                                                : `Premier: ${player.premier_rank || 5}`
                                            }
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MixTournament; 