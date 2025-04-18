// frontend/src/components/TournamentDetails.js
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../axios';
import './TournamentDetails.css';
import BracketRenderer from './BracketRenderer';
import TreeBracketRenderer from './TreeBracketRenderer';

function TournamentDetails() {
    const { id } = useParams();
    const [tournament, setTournament] = useState(null);
    const [user, setUser] = useState(null);
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState('');
    const [newTeamName, setNewTeamName] = useState('');
    const [message, setMessage] = useState('');
    const [isParticipating, setIsParticipating] = useState(false);
    const [addParticipantName, setAddParticipantName] = useState('');
    const [adminRequestStatus, setAdminRequestStatus] = useState(null);
    const [matches, setMatches] = useState([]);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [inviteMethod, setInviteMethod] = useState('username');
    const [inviteUsername, setInviteUsername] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedWinnerId, setSelectedWinnerId] = useState(null);
    const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false);
    const [matchScores, setMatchScores] = useState({ team1: 0, team2: 0 });
    const wsRef = useRef(null);
    const [bracketView, setBracketView] = useState('tree');

    // Загрузка данных
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            api
                .get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
                .then((userResponse) => {
                    setUser(userResponse.data);
                    api
                        .get(`/api/teams?userId=${userResponse.data.id}`, { headers: { Authorization: `Bearer ${token}` } })
                        .then((res) => setTeams(res.data || []))
                        .catch((error) => console.error('Ошибка загрузки команд:', error));
                })
                .catch((error) => console.error('Ошибка загрузки пользователя:', error));
        }

        fetchTournamentData();
        setupWebSocket();

        return () => {
            // Закрываем WebSocket при размонтировании компонента
            if (wsRef.current) {
                // Отправляем сообщение о прекращении просмотра турнира
                if (wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'unwatch_tournament',
                        tournamentId: id
                    }));
                }
                wsRef.current.close();
            }
        };
    }, [id, fetchTournamentData, setupWebSocket]);

    // Настройка WebSocket для получения обновлений в реальном времени
    const setupWebSocket = useCallback(() => {
        // Создаем WebSocket соединение
        const wsUrl = (process.env.REACT_APP_API_URL || 'http://localhost:3000').replace(/^http/, 'ws');
        const webSocket = new WebSocket(`${wsUrl}/ws`);
        
        webSocket.onopen = () => {
            console.log('WebSocket соединение установлено в компоненте TournamentDetails');
            // После установления соединения сообщаем, что просматриваем турнир
            webSocket.send(JSON.stringify({
                type: 'watch_tournament',
                tournamentId: id
            }));
        };
        
        webSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Получено сообщение WebSocket:', data);
                
                // Обрабатываем обновления турнира
                if (data.type === 'tournament_update' && data.tournamentId === id) {
                    console.log('Получено обновление турнира:', data.data);
                    setTournament(data.data);
                    
                    if (Array.isArray(data.data.matches)) {
                        setMatches(data.data.matches);
                    }
                }
            } catch (error) {
                console.error('Ошибка при обработке сообщения WebSocket:', error);
            }
        };
        
        webSocket.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
        };
        
        webSocket.onclose = () => {
            console.log('WebSocket соединение закрыто');
        };
        
        // Сохраняем ссылку на WebSocket
        wsRef.current = webSocket;
    }, [id]);

    // Функция для загрузки данных турнира
    const fetchTournamentData = useCallback(async () => {
        try {
            const tournamentResponse = await api.get(`/api/tournaments/${id}`);
            console.log('Данные турнира при загрузке:', tournamentResponse.data);
            
            const tournament = tournamentResponse.data;
            const loadedMatches = Array.isArray(tournament.matches) ? tournament.matches : [];
            
            console.log('Загруженные матчи:', loadedMatches);
            console.log('Количество матчей:', loadedMatches.length);
            
            setTournament(tournament);
            setMatches(loadedMatches);
        } catch (error) {
            console.error('Ошибка загрузки турнира:', error);
            setMessage('Ошибка загрузки данных турнира');
        }
    }, [id]);

    useEffect(() => {
        if (tournament && user) {
            const participants = tournament.participants || [];
            const participating = participants.some(
                (p) =>
                    (tournament.participant_type === 'solo' && p.user_id === user.id) ||
                    (tournament.participant_type === 'team' && p.creator_id === user.id)
            );
            setIsParticipating(participating);

            if (localStorage.getItem('token')) {
                api
                    .get(`/api/tournaments/${id}/admin-request-status`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                    })
                    .then((statusResponse) => setAdminRequestStatus(statusResponse.data.status))
                    .catch((error) => console.error('Ошибка загрузки статуса администратора:', error));
            }
        }
    }, [tournament, user, id]);

    const getRoundName = (round, totalRounds) => {
        if (round === -1) return 'Предварительный раунд';
        const roundsLeft = totalRounds - round - 1;
        if (roundsLeft === 0) return 'Финал';
        if (roundsLeft === 1) return 'Полуфинал';
        if (roundsLeft === 2) return 'Четвертьфинал';
        const stage = Math.pow(2, roundsLeft + 1);
        return `1/${stage} финала`;
    };

    const games = useMemo(() => {
        if (!tournament || !Array.isArray(matches)) return [];

        const participantCount = tournament.participants?.length || 0;
        const totalRounds = Math.ceil(Math.log2(participantCount));

        console.log('Формирование игр для BracketRenderer');
        console.log('Matches в состоянии:', matches);
        console.log('Participants в состоянии:', tournament.participants);

        // Создаем карту участников для быстрого поиска
        const participantsMap = {};
        if (Array.isArray(tournament.participants)) {
            tournament.participants.forEach(p => {
                if (p.id) {
                    participantsMap[p.id] = p;
                }
            });
        }
        console.log('Карта участников:', participantsMap);

        return matches.map((match) => {
            // Находим участников по ID
            const homeParticipant = match.team1_id ? participantsMap[match.team1_id] : null;
            const visitorParticipant = match.team2_id ? participantsMap[match.team2_id] : null;
                
            // Определяем bracket_type по умолчанию, если он отсутствует
            let bracket_type = match.bracket_type;
            if (!bracket_type) {
                if (match.is_third_place_match) {
                    bracket_type = 'placement';
                } else {
                    bracket_type = 'winner';
                }
            }

            return {
                id: match.id.toString(),
                name: match.is_third_place_match ? 'Матч за 3-е место' : `Match ${match.match_number}`,
                tournamentRoundText: match.is_third_place_match
                    ? 'Матч за 3-е место'
                    : getRoundName(match.round, totalRounds),
                startTime: match.scheduled ? new Date(match.scheduled).toISOString() : new Date().toISOString(),
                state: match.winner_team_id ? 'DONE' : 'NO_PARTY',
                participants: [
                    {
                        id: match.team1_id ? match.team1_id.toString() : null,
                        name: homeParticipant ? homeParticipant.name : 'TBD',
                        isWinner: match.winner_team_id === match.team1_id,
                        score: match.score1 || 0,
                        resultText: null,
                        status: null,
                    },
                    {
                        id: match.team2_id ? match.team2_id.toString() : null,
                        name: visitorParticipant ? visitorParticipant.name : 'TBD',
                        isWinner: match.winner_team_id === match.team2_id,
                        score: match.score2 || 0,
                        resultText: null,
                        status: null,
                    },
                ],
                nextMatchId: match.next_match_id ? match.next_match_id.toString() : null,
                is_third_place_match: match.is_third_place_match || false,
                bracket_type: bracket_type,
                round: match.round,
            };
        });
    }, [matches, tournament]);

    // Преобразование данных игр в формат для TreeBracketRenderer
    const adaptGamesForTreeRenderer = useMemo(() => {
        if (!games || games.length === 0) return [];
        
        console.log('Адаптация игр для TreeBracketRenderer:', games);
        
        return games.map(game => {
            // Проверка на существование объекта игры
            if (!game) return null;
            
            // Преобразуем bracket_type в формат, понятный для TreeBracketRenderer
            let bracketType = 'WINNERS';
            if (game.bracket_type === 'loser') {
                bracketType = 'LOSERS';
            } else if (game.bracket_type === 'grand_final') {
                bracketType = 'GRAND_FINAL';
            } else if (game.bracket_type === 'placement' || game.is_third_place_match) {
                bracketType = 'THIRD_PLACE';
            }
            
            // Получаем номер матча
            const matchNumber = game.name ? game.name.replace(/[^\d]/g, '') : game.id;
            
            // Проверяем поле participants
            const participants = Array.isArray(game.participants) 
                ? game.participants.map(p => ({
                    id: p?.id || 'tbd',
                    name: p?.name || 'TBD',
                    score: p?.score || 0
                }))
                : [
                    { id: 'tbd1', name: 'TBD', score: 0 },
                    { id: 'tbd2', name: 'TBD', score: 0 }
                ];
                
            // Находим победителя
            const winner = game.participants 
                ? game.participants.find(p => p?.isWinner)?.id 
                : null;
                
            return {
                id: parseInt(game.id) || 0,
                matchNumber: matchNumber || 'N/A',
                round: typeof game.round === 'number' ? game.round : 0,
                bracket_type: bracketType,
                winner_id: winner || null,
                match_order: parseInt(game.id) || 0, // используем id как порядок, если нет match_order
                participants: participants,
                // Дополнительные поля
                status: game.state || 'PENDING',
                nextMatchId: game.nextMatchId || null
            };
        }).filter(Boolean); // Удаляем null значения из результата
    }, [games]);

    const handleParticipate = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы участвовать');
            return;
        }

        try {
            const payload =
                tournament.participant_type === 'solo'
                    ? {}
                    : { teamId: selectedTeam || null, newTeamName: selectedTeam ? null : newTeamName };
            const participateResponse = await api.post(`/api/tournaments/${id}/participate`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setMessage(participateResponse.data.message);
            const updatedTournament = await api.get(`/api/tournaments/${id}`);
            setTournament(updatedTournament.data);
            setMatches(updatedTournament.data.matches || []);
            setIsParticipating(true);
            setNewTeamName('');
        } catch (error) {
            setMessage(error.response?.data?.error || 'Ошибка при регистрации');
        }
    };

    const handleWithdraw = async () => {
        const token = localStorage.getItem('token');
        try {
            const withdrawResponse = await api.post(
                `/api/tournaments/${id}/withdraw`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage(withdrawResponse.data.message);
            const updatedTournament = await api.get(`/api/tournaments/${id}`);
            setTournament(updatedTournament.data);
            setMatches(updatedTournament.data.matches || []);
            setIsParticipating(false);
        } catch (error) {
            setMessage(error.response?.data?.error || 'Ошибка при отказе');
        }
    };

    const handleAddParticipant = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы добавить участника');
            return;
        }

        try {
            const addParticipantResponse = await api.post(
                `/api/tournaments/${id}/add-participant`,
                { participantName: addParticipantName },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage(addParticipantResponse.data.message);
            const updatedTournament = await api.get(`/api/tournaments/${id}`);
            setTournament(updatedTournament.data);
            setMatches(updatedTournament.data.matches || []);
            setAddParticipantName('');
        } catch (error) {
            setMessage(error.response?.data?.error || 'Ошибка при добавлении участника');
        }
    };

    const handleRequestAdmin = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы запросить права администратора');
            return;
        }

        try {
            const requestAdminResponse = await api.post(
                `/api/tournaments/${id}/request-admin`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage(requestAdminResponse.data.message);
            setAdminRequestStatus('pending');
        } catch (error) {
            setMessage(error.response?.data?.error || 'Ошибка при запросе прав администратора');
        }
    };

    const handleGenerateBracket = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы сгенерировать сетку');
            return;
        }

        if (!canGenerateBracket) {
            setMessage('У вас нет прав для генерации сетки или сетка уже сгенерирована');
            return;
        }

        try {
            setMessage('Генерация сетки...');
            
            const generateBracketResponse = await api.post(
                `/api/tournaments/${id}/generate-bracket`,
                { thirdPlaceMatch: tournament.format === 'double_elimination' ? true : thirdPlaceMatch },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            console.log('Ответ от сервера:', generateBracketResponse.data);
            
            // Обновления турнира должны прийти через WebSocket,
            // но на всякий случай обновляем данные из ответа
            if (generateBracketResponse.data.tournament) {
                const tournamentData = generateBracketResponse.data.tournament;
                
                if (!Array.isArray(tournamentData.matches) || tournamentData.matches.length === 0) {
                    // Если matches пустой, запрашиваем данные заново
                    await fetchTournamentData();
                } else {
                    setTournament(tournamentData);
                    setMatches(tournamentData.matches);
                }
            }
            
            setMessage('');
        } catch (error) {
            console.error('Ошибка при генерации сетки:', error);
            setMessage(error.response?.data?.error || 'Ошибка при генерации сетки');
            
            // Пытаемся синхронизировать данные с сервера
            try {
                await fetchTournamentData();
            } catch (fetchError) {
                console.error('Ошибка при синхронизации данных:', fetchError);
            }
        }
    };

    const handleTeamClick = (teamId, matchId) => {
        // Если это дерево, то matchId уже предоставлен напрямую
        // Если это классическая сетка, то matchId предоставляется отдельно
        const actualMatchId = typeof matchId === 'number' ? matchId : parseInt(matchId);
        
        console.log(`Клик по команде: teamId=${teamId}, matchId=${actualMatchId}`);
        
        if (!canEditMatches) return;
        
        setSelectedMatch(actualMatchId);
        setSelectedWinnerId(teamId);
        
        // Ищем матч в обоих представлениях
        const selectedGame = games.find(g => parseInt(g.id) === actualMatchId);
        
        if (selectedGame) {
            // Получаем текущие счета из игры
            const team1Score = selectedGame.participants[0]?.score || 0;
            const team2Score = selectedGame.participants[1]?.score || 0;
            
            setMatchScores({
                team1: team1Score,
                team2: team2Score
            });
            
            setShowConfirmModal(true);
        } else {
            console.error(`Матч с ID ${actualMatchId} не найден`);
        }
    };

    const handleUpdateMatch = async (updatedMatch) => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы обновить результаты');
            return;
        }
        
        try {
            // Получаем ID участников и счета
            const team1Id = updatedMatch?.participants?.[0]?.id;
            const team2Id = updatedMatch?.participants?.[1]?.id;
            const score1 = matchScores.team1;
            const score2 = matchScores.team2;
            const winnerId = selectedWinnerId;
            
            // Проверяем, что все необходимые данные существуют
            if (!team1Id || !team2Id || !updatedMatch.id) {
                throw new Error('Неверные данные участников матча');
            }
            
            // Обновляем результаты
            const response = await api.post(
                `/api/tournaments/matches/${updatedMatch.id}/result`,
                {
                    winner_team_id: winnerId,
                    score1,
                    score2,
                    team1_id: team1Id,
                    team2_id: team2Id
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            console.log('Ответ на обновление матча:', response.data);
            
            // Обновляем данные турнира после изменения
            if (response.data.tournament) {
                setTournament(response.data.tournament);
                
                // Обновляем матчи, если они включены в ответ
                if (Array.isArray(response.data.tournament.matches)) {
                    setMatches(response.data.tournament.matches);
                } else {
                    // Если матчи не включены, запрашиваем турнир снова
                    await fetchTournamentData();
                }
                
                setMessage('Результаты успешно обновлены');
                
                // Очищаем сообщение через 3 секунды
                setTimeout(() => {
                    setMessage('');
                }, 3000);
            } else {
                // Если турнир не пришел в ответе, запрашиваем данные снова
                await fetchTournamentData();
                setMessage('Результаты обновлены, синхронизируем данные');
            }
            
            // Закрываем модальное окно
            setShowConfirmModal(false);
            setSelectedMatch(null);
        } catch (error) {
            console.error('Ошибка обновления результатов:', error);
            setMessage(`Ошибка: ${error.response?.data?.error || error.message}`);
            
            // Обновляем данные турнира, чтобы синхронизировать изменения
            await fetchTournamentData();
        }
    };

    const handleCloseModal = () => {
        setShowConfirmModal(false);
        setSelectedMatch(null);
        setSelectedWinnerId(null);
        setMatchScores({ team1: 0, team2: 0 });
    };

    const handleConfirmWinner = (action) => {
        if (action !== 'yes') {
            handleCloseModal();
            return;
        }
        
        // Ищем выбранный матч
        const matchToUpdate = games.find(g => parseInt(g.id) === selectedMatch);
        
        if (!matchToUpdate) {
            console.error(`Матч с ID ${selectedMatch} не найден`);
            handleCloseModal();
            return;
        }
        
        // Вызываем функцию обновления матча
        handleUpdateMatch(matchToUpdate);
    };

    const handleInvite = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Пожалуйста, войдите, чтобы отправить приглашение');
            return;
        }
        try {
            const payload =
                inviteMethod === 'username' ? { username: inviteUsername } : { email: inviteEmail };
            const inviteResponse = await api.post(`/api/tournaments/${id}/invite`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setMessage(inviteResponse.data.message);
            setInviteUsername('');
            setInviteEmail('');
        } catch (error) {
            setMessage(error.response?.data?.error || 'Ошибка при отправке приглашения');
        }
    };

    if (!tournament) return <p>Загрузка...</p>;

    const isCreator = user && tournament.created_by === user.id;
    const canRequestAdmin = user && !isCreator && !adminRequestStatus;
    const canGenerateBracket = user && (isCreator || adminRequestStatus === 'accepted') && matches.length === 0;
    const canEditMatches = user && (isCreator || adminRequestStatus === 'accepted');

    // Определение призёров
    let winners = [];
    if (Array.isArray(matches) && matches.length > 0) {
        if (tournament.format === 'double_elimination') {
            // Для Double Elimination
            // Находим Grand Final (матч с bracket_type = 'grand_final')
            const grandFinalMatch = matches.find((m) => m.bracket_type === 'grand_final');
            if (grandFinalMatch && grandFinalMatch.winner_team_id) {
                const firstPlace = (tournament.participants || []).find((p) => p.id === grandFinalMatch.winner_team_id)?.name || '';
                const secondPlace = (tournament.participants || []).find(
                    (p) =>
                        p.id !== grandFinalMatch.winner_team_id &&
                        (p.id === grandFinalMatch.team1_id || p.id === grandFinalMatch.team2_id)
                )?.name || '';
                winners = [[1, firstPlace], [2, secondPlace]];

                // Находим финал нижней сетки (Losers Bracket Final) — последний матч с bracket_type = 'loser' перед Grand Final
                const loserMatches = matches.filter((m) => m.bracket_type === 'loser');
                const maxLoserRound = Math.max(...loserMatches.map((m) => m.round));
                const loserFinalMatch = loserMatches.find((m) => m.round === maxLoserRound);

                if (loserFinalMatch && loserFinalMatch.winner_team_id) {
                    const thirdPlace = (tournament.participants || []).find(
                        (p) =>
                            p.id !== loserFinalMatch.winner_team_id &&
                            (p.id === loserFinalMatch.team1_id || p.id === loserFinalMatch.team2_id)
                    )?.name || '';
                    winners.push([3, thirdPlace]);
                }
            }
        } else {
            // Для Single Elimination (старая логика)
            let finalMatch = null;
            const rounds = matches.map((m) => m.round);
            const maxRound = rounds.length > 0 ? Math.max(...rounds) : -1;
            if (maxRound !== -1) {
                const relevantMatches = matches.filter(
                    (m) => m.round === maxRound && !m.is_third_place_match
                );
                const matchNumbers = relevantMatches.map((m) => m.match_number);
                const maxMatchNumber = matchNumbers.length > 0 ? Math.max(...matchNumbers) : -1;
                if (maxMatchNumber !== -1) {
                    finalMatch = relevantMatches.find(
                        (m) => m.match_number === maxMatchNumber
                    );
                }
            }

            if (finalMatch && finalMatch.winner_team_id) {
                const firstPlace = (tournament.participants || []).find((p) => p.id === finalMatch.winner_team_id)?.name || '';
                const secondPlace = (tournament.participants || []).find(
                    (p) =>
                        p.id !== finalMatch.winner_team_id &&
                        (p.id === finalMatch.team1_id || p.id === finalMatch.team2_id)
                )?.name || '';
                winners = [[1, firstPlace], [2, secondPlace]];

                if (tournament.format === 'single_elimination' && thirdPlaceMatch) {
                    const thirdPlaceMatchResult = matches.find((m) => m.is_third_place_match);
                    const thirdPlace = thirdPlaceMatchResult?.winner_team_id
                        ? (tournament.participants || []).find((p) => p.id === thirdPlaceMatchResult.winner_team_id)?.name
                        : '';
                    if (thirdPlace) winners.push([3, thirdPlace]);
                }
            }
        }
    }

    // Отображение участников турнира с аватарами
    const renderParticipants = () => {
        if (!tournament || !tournament.participants || tournament.participants.length === 0) {
            return <p>Пока нет участников</p>;
        }

        return (
            <div className="participants-list">
                <h4>Участники ({tournament.participants.length})</h4>
                <ul>
                    {tournament.participants.map((participant) => (
                        <li key={participant.id} className="participant-item">
                            {/* Проверяем, является ли участник текущим авторизованным пользователем */}
                            <Link 
                                to={user && participant.user_id === user.id ? '/profile' : `/user/${participant.user_id}`} 
                                className="participant-link"
                            >
                                <div className="participant-avatar">
                                    <img 
                                        src={participant.avatar_url || '/default-avatar.png'} 
                                        alt={`${participant.name} аватар`} 
                                        className="participant-avatar-img"
                                    />
                                </div>
                                <div className="participant-info">
                                    <span className="participant-name">{participant.name}</span>
                                    {participant.is_admin && <span className="admin-badge">Админ</span>}
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <section className="tournament-details">
            <h2>
                {tournament.name} ({tournament.status === 'active' ? 'Активен' : 'Завершён'})
            </h2>
            <p>
                <strong>Описание:</strong> {tournament.description || 'Нет описания'}
            </p>
            <p>
                <strong>Формат:</strong> {tournament.format}
            </p>
            <p>
                <strong>Дата старта:</strong> {new Date(tournament.start_date).toLocaleDateString('ru-RU')}
            </p>
            {tournament.end_date && (
                <p>
                    <strong>Дата окончания:</strong>{' '}
                    {new Date(tournament.end_date).toLocaleDateString('ru-RU')}
                </p>
            )}
            <p>
                <strong>Участники ({tournament.participant_count || 0}):</strong>
            </p>
            {renderParticipants()}
            {user && tournament.status === 'active' && (
                <div className="participation-controls">
                    {!isParticipating && matches.length === 0 ? (
                        <>
                            {tournament.participant_type === 'team' && (
                                <div className="team-selection">
                                    <label>Выберите команду или создайте новую:</label>
                                    <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
                                        <option value="">Создать новую команду</option>
                                        {(teams || []).map((team) => (
                                            <option key={team.id} value={team.id}>
                                                {team.name}
                                            </option>
                                        ))}
                                    </select>
                                    {!selectedTeam && (
                                        <input
                                            type="text"
                                            placeholder="Название новой команды"
                                            value={newTeamName}
                                            onChange={(e) => setNewTeamName(e.target.value)}
                                        />
                                    )}
                                </div>
                            )}
                            <button onClick={handleParticipate}>Участвовать в турнире</button>
                        </>
                    ) : (
                        isParticipating &&
                        matches.length === 0 && (
                            <button onClick={handleWithdraw}>Отказаться от участия</button>
                        )
                    )}
                    {isCreator && matches.length === 0 && (
                        <div className="invite-participant">
                            <h3>Выслать приглашение на турнир</h3>
                            <select value={inviteMethod} onChange={(e) => setInviteMethod(e.target.value)}>
                                <option value="username">По никнейму</option>
                                <option value="email">По email</option>
                            </select>
                            {inviteMethod === 'username' ? (
                                <input
                                    type="text"
                                    placeholder="Никнейм пользователя"
                                    value={inviteUsername}
                                    onChange={(e) => {
                                        setInviteUsername(e.target.value);
                                        setInviteEmail('');
                                    }}
                                />
                            ) : (
                                <input
                                    type="email"
                                    placeholder="Email пользователя"
                                    value={inviteEmail}
                                    onChange={(e) => {
                                        setInviteEmail(e.target.value);
                                        setInviteUsername('');
                                    }}
                                />
                            )}
                            <button onClick={handleInvite}>Пригласить</button>
                        </div>
                    )}
                    {(isCreator || adminRequestStatus === 'accepted') && matches.length === 0 && (
                        <div className="add-participant">
                            <h3>Добавить неавторизованного участника</h3>
                            <input
                                type="text"
                                placeholder="Имя участника"
                                value={addParticipantName}
                                onChange={(e) => setAddParticipantName(e.target.value)}
                            />
                            <button onClick={handleAddParticipant}>Добавить</button>
                        </div>
                    )}
                    {canRequestAdmin && (
                        <button onClick={handleRequestAdmin}>Администрировать турнир</button>
                    )}
                </div>
            )}
            <h3>Турнирная сетка</h3>
            {Array.isArray(matches) && matches.length > 0 ? (
                <>
                    {console.log('Рендеринг сетки. Количество матчей:', matches.length)}
                    {console.log('Games для визуализации сетки:', games)}
                    {Array.isArray(games) && games.length > 0 ? (
                        <div className="custom-tournament-bracket">
                            <div className="bracket-toggle-container">
                                <button
                                    className={`bracket-toggle-button ${bracketView === 'tree' ? 'active' : ''}`}
                                    onClick={() => setBracketView('tree')}
                                >
                                    Древовидная сетка
                                </button>
                                <button
                                    className={`bracket-toggle-button ${bracketView === 'classic' ? 'active' : ''}`}
                                    onClick={() => setBracketView('classic')}
                                >
                                    Классическая сетка
                                </button>
                            </div>
                            
                            {bracketView === 'tree' ? (
                                <TreeBracketRenderer
                                    games={adaptGamesForTreeRenderer}
                                    canEdit={canEditMatches}
                                    onMatchClick={(match) => setSelectedMatch(parseInt(match.id))}
                                    selectedMatchId={selectedMatch}
                                    formatParticipantName={(name) => name}
                                    tournamentType={tournament.format === 'double_elimination' ? 'DOUBLE_ELIMINATION' : 'SINGLE_ELIMINATION'}
                                />
                            ) : (
                                <BracketRenderer
                                    games={games}
                                    canEditMatches={canEditMatches}
                                    selectedMatch={selectedMatch}
                                    setSelectedMatch={setSelectedMatch}
                                    handleTeamClick={handleTeamClick}
                                    format={tournament.format}
                                />
                            )}
                        </div>
                    ) : (
                        <p>Ошибка формирования данных для сетки. Пожалуйста, обновите страницу.</p>
                    )}
                </>
            ) : (
                <>
                    <p>Сетка ещё не сгенерирована</p>
                    {canGenerateBracket && (
                        <div className="generation-options">
                            {tournament.format === 'single_elimination' && (
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={thirdPlaceMatch}
                                        onChange={(e) => setThirdPlaceMatch(e.target.checked)}
                                    />{' '}
                                    Нужен матч за третье место?
                                </label>
                            )}
                            <button className="generate-bracket-button" onClick={handleGenerateBracket}>
                                Сгенерировать сетку
                            </button>
                        </div>
                    )}
                </>
            )}
            {winners.length > 0 && (
                <div className="winners-list">
                    <h3>Призёры турнира</h3>
                    <ul>
                        {winners.map(([place, name]) => (
                            <li key={place}>
                                {place} место: {name || 'Не определён'}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {showConfirmModal && selectedMatch && (
                <div className="modal" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Подтверждение победителя</h3>
                        <p>
                            Победитель:{' '}
                            <span className="winner-name">
                                {games
                                    ?.find((m) => m.id === selectedMatch.toString())
                                    ?.participants.find((p) => p.id === selectedWinnerId)?.name || 'Не определён'}
                            </span>
                        </p>
                        <div className="score-inputs">
                            <div className="score-container">
                                <span className="participant-name">
                                    {games?.find((m) => m.id === selectedMatch.toString())?.participants[0]?.name ||
                                        'Участник 1'}
                                </span>
                                <input
                                    type="number"
                                    value={matchScores.team1}
                                    onChange={(e) => setMatchScores({ ...matchScores, team1: Number(e.target.value) })}
                                    className="score-input"
                                    min="0"
                                />
                            </div>
                            <div className="score-container">
                                <span className="participant-name">
                                    {games?.find((m) => m.id === selectedMatch.toString())?.participants[1]?.name ||
                                        'Участник 2'}
                                </span>
                                <input
                                    type="number"
                                    value={matchScores.team2}
                                    onChange={(e) => setMatchScores({ ...matchScores, team2: Number(e.target.value) })}
                                    className="score-input"
                                    min="0"
                                />
                            </div>
                        </div>
                        <div className="modal-buttons">
                            <button onClick={() => handleConfirmWinner('yes')}>Подтвердить</button>
                            <button onClick={handleCloseModal}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}
            {message && (
                <p className={message.includes('успешно') ? 'success' : 'error'}>{message}</p>
            )}
        </section>
    );
}

export default TournamentDetails;