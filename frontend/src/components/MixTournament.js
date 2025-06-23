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
    const [isTeamsFormed, setIsTeamsFormed] = useState(false);
    const [isBracketGenerated, setIsBracketGenerated] = useState(false);

    // Функция для расчета рейтинга игрока
    const calculatePlayerRating = (player) => {
        if (ratingType === 'faceit') {
            // 🔧 ИСПРАВЛЕННЫЙ ПРИОРИТЕТ: кастомный → пользовательский → дефолт
            if (player.faceit_elo && !isNaN(parseInt(player.faceit_elo)) && parseInt(player.faceit_elo) > 0) {
                return parseInt(player.faceit_elo);
            } else if (player.user_faceit_elo && !isNaN(parseInt(player.user_faceit_elo)) && parseInt(player.user_faceit_elo) > 0) {
                return parseInt(player.user_faceit_elo);
            } else if (player.faceit_rating && !isNaN(parseInt(player.faceit_rating)) && parseInt(player.faceit_rating) > 0) {
                return parseInt(player.faceit_rating);
            }
            return 1000; // дефолт для FACEIT
        } else {
            // 🔧 ИСПРАВЛЕННЫЙ ПРИОРИТЕТ: кастомный → пользовательский → дефолт  
            if (player.cs2_premier_rank && !isNaN(parseInt(player.cs2_premier_rank)) && parseInt(player.cs2_premier_rank) > 0) {
                return parseInt(player.cs2_premier_rank);
            } else if (player.premier_rank && !isNaN(parseInt(player.premier_rank)) && parseInt(player.premier_rank) > 0) {
                return parseInt(player.premier_rank);
            } else if (player.user_premier_rank && !isNaN(parseInt(player.user_premier_rank)) && parseInt(player.user_premier_rank) > 0) {
                return parseInt(player.user_premier_rank);
            } else if (player.premier_rating && !isNaN(parseInt(player.premier_rating)) && parseInt(player.premier_rating) > 0) {
                return parseInt(player.premier_rating);
            }
            return 5; // дефолт для Premier
        }
    };

    // Функция для проверки допустимого расхождения рейтингов
    const isRatingDifferenceValid = (teams) => {
        if (teams.length < 2) return true;
        
        const ratings = teams.map(team => team.totalRating);
        const minRating = Math.min(...ratings);
        const maxRating = Math.max(...ratings);
        const difference = ((maxRating - minRating) / minRating) * 100;
        
        return difference <= 20;
    };

    // Функция для формирования команд
    const formTeams = () => {
        // Сортируем игроков по рейтингу
        const sortedPlayers = [...players].sort((a, b) => 
            calculatePlayerRating(b) - calculatePlayerRating(a)
        );

        const numTeams = Math.floor(players.length / tournament.team_size);
        let formedTeams = Array(numTeams).fill().map(() => ({
            players: [],
            totalRating: 0
        }));

        // Распределяем игроков по командам
        sortedPlayers.forEach((player, index) => {
            const teamIndex = formedTeams.reduce((minIndex, team, currentIndex) => 
                team.totalRating < formedTeams[minIndex].totalRating ? currentIndex : minIndex, 0
            );

            formedTeams[teamIndex].players.push(player);
            formedTeams[teamIndex].totalRating += calculatePlayerRating(player);
        });

        // Проверяем допустимое расхождение рейтингов
        if (!isRatingDifferenceValid(formedTeams)) {
            alert('Невозможно сформировать команды с допустимым расхождением рейтингов (20%). Попробуйте еще раз.');
            return;
        }

        setTeams(formedTeams);
        setIsTeamsFormed(true);
    };

    // Функция для генерации турнирной сетки
    const generateBracket = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `/api/tournaments/${id}/generate-bracket`,
                { teams },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setIsBracketGenerated(true);
            alert('Турнирная сетка успешно сгенерирована');
        } catch (err) {
            alert('Ошибка при генерации турнирной сетки');
        }
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

                setLoading(false);
            } catch (err) {
                setError('Ошибка при загрузке данных турнира');
                setLoading(false);
            }
        };

        fetchTournamentData();
    }, [id]);

    const handleRatingTypeChange = (type) => {
        setRatingType(type);
        if (isTeamsFormed) {
            formTeams(); // Переформируем команды при смене типа рейтинга
        }
    };

    if (loading) return <div className="loading">Загрузка данных турнира...</div>;
    if (error) return <div className="error">{error}</div>;
    if (!tournament) return null;

    return (
        <div className="mix-tournament">
            <h1>{tournament.name}</h1>
            <div className="tournament-info">
                <p>Формат: {tournament.format}</p>
                <p>Размер команды: {tournament.team_size} игроков</p>
            </div>

            <div className="controls-container">
                <div className="rating-selector-group">
                    <label>Миксовать по рейтингу:</label>
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

                {!isTeamsFormed && (
                    <button 
                        className="form-teams-button"
                        onClick={formTeams}
                        disabled={players.length < tournament.team_size * 2}
                    >
                        Сформировать команды
                    </button>
                )}
            </div>

            {!isTeamsFormed ? (
                <div className="players-section">
                    <h2>Зарегистрированные игроки</h2>
                    <div className="players-list">
                        {players.map((player, index) => (
                            <div key={index} className="player-item">
                                <span className="player-name">{player.name}</span>
                                <span className="player-rating">
                                    {ratingType === 'faceit' 
                                        ? `FACEIT: ${calculatePlayerRating(player)}`
                                        : `Premier: ${calculatePlayerRating(player)}`
                                    }
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
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
                                                    ? `FACEIT: ${calculatePlayerRating(player)}`
                                                    : `Premier: ${calculatePlayerRating(player)}`
                                                }
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!isBracketGenerated && isTeamsFormed && (
                <div className="actions">
                    <button 
                        className="form-teams-button"
                        onClick={formTeams}
                    >
                        Перемешать команды
                    </button>
                    <button 
                        className="generate-bracket-button"
                        onClick={generateBracket}
                    >
                        Генерация турнирной сетки
                    </button>
                </div>
            )}
        </div>
    );
};

export default MixTournament; 