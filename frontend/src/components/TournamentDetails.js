/**
 * TournamentDetails v4.1.0 - Full Feature Restoration
 * 
 * @version 4.1.0 (Полный функционал)
 * @created 2025-01-22
 * @author 1337 Community Development Team
 * @purpose Восстановление всех функций турнирной системы
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../utils/api';
import './TournamentDetails.css';
import TeamGenerator from './TeamGenerator';
import BracketRenderer from './BracketRenderer';
import { ensureHttps } from '../utils/userHelpers';

// Error Boundary для критических ошибок
class TournamentErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('🚨 TournamentDetails Critical Error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="tournament-critical-error">
                    <h2>Произошла критическая ошибка</h2>
                    <p>Пожалуйста, обновите страницу или попробуйте позже.</p>
                    <button onClick={() => window.location.reload()}>
                        Обновить страницу
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

function TournamentDetails() {
    const { id } = useParams();
    
    // 🎯 ОСНОВНЫЕ СОСТОЯНИЯ
    const [tournament, setTournament] = useState(null);
    const [user, setUser] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('info');
    
    // 🎯 UI СОСТОЯНИЯ
    const [message, setMessage] = useState('');
    const [wsConnected, setWsConnected] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [mixedTeams, setMixedTeams] = useState([]);
    const [ratingType, setRatingType] = useState('faceit');
    const [dataLoadingStates, setDataLoadingStates] = useState({
        tournament: false,
        matches: false,
        user: false
    });
    
    // 🎯 ФУНКЦИЯ РАСЧЕТА СРЕДНЕГО РЕЙТИНГА КОМАНДЫ
    const calculateTeamAverageRating = useCallback((team) => {
        if (!team.members || team.members.length === 0) return '—';
        
        const ratings = team.members.map(member => {
            if (ratingType === 'faceit') {
                return parseInt(member.faceit_elo) || 1000; // Базовый рейтинг FACEIT
            } else {
                return parseInt(member.cs2_premier_rank) || 0; // Базовый ранг CS2
            }
        }).filter(rating => rating > 0);
        
        if (ratings.length === 0) return '—';
        
        const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        return Math.round(average);
    }, [ratingType]);

    // 🎯 ПРАВА ПОЛЬЗОВАТЕЛЯ
    const userPermissions = useMemo(() => {
        if (!user || !tournament) {
            return {
                isParticipating: false,
                isCreator: false,
                isAdminOrCreator: false,
                canEdit: false
            };
        }

        const isCreator = tournament.creator_id === user.id;
        const isParticipating = tournament.participants?.some(
            p => p.user_id === user.id || p.id === user.id
        ) || false;

        return {
            isParticipating,
            isCreator,
            isAdminOrCreator: isCreator,
            canEdit: isCreator
        };
    }, [user, tournament]);

    // 🎯 ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ
    const loadUser = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            setDataLoadingStates(prev => ({ ...prev, user: true }));
            const response = await api.get('/api/users/me');
            setUser(response.data);
        } catch (error) {
            console.warn('⚠️ Пользователь не загружен:', error.message);
        } finally {
            setDataLoadingStates(prev => ({ ...prev, user: false }));
        }
    }, []);

    // 🎯 ФУНКЦИЯ ТРАНСФОРМАЦИИ МАТЧЕЙ ДЛЯ BRACKETRENDERER (УЛУЧШЕНА ДЛЯ МИКС ТУРНИРОВ)
    const transformMatchesToGames = useCallback((matchesArray, teamsArray = null) => {
        if (!matchesArray || !Array.isArray(matchesArray)) {
            console.warn('transformMatchesToGames: некорректные данные матчей', matchesArray);
            return [];
        }

        console.log('🔄 Трансформация матчей для BracketRenderer:', {
            matchesCount: matchesArray.length,
            teamsCount: teamsArray?.length || 0,
            hasTournamentData: !!tournament
        });
        
        // Получаем команды из переданного параметра или из состояния
        const teams = teamsArray || mixedTeams || tournament?.teams || [];
        console.log('🔄 Используем команды:', teams.length);

        return matchesArray.map((match, index) => {
            // Создаем участников из данных матча
            const participants = [];
            
            // Функция поиска команды по ID
            const findTeamById = (teamId) => {
                if (!teamId || !teams.length) return null;
                return teams.find(team => team.id === teamId);
            };
            
            // Участник 1
            let team1Name = match.team1_name || match.participant1_name;
            let team1Avatar = match.team1_avatar_url;
            
            // Если есть team1_id, ищем команду в списке
            if (match.team1_id && teams.length > 0) {
                const team1 = findTeamById(match.team1_id);
                if (team1) {
                    team1Name = team1.name;
                    team1Avatar = team1.avatar_url || team1Avatar;
                    console.log(`🔍 Найдена команда 1: ${team1.name} (ID: ${match.team1_id})`);
                }
            }
            
            if (match.team1_id || team1Name) {
                participants.push({
                    id: match.team1_id || `team1_${match.id}`,
                    name: team1Name || 'TBD',
                    score: match.score1 !== undefined ? Number(match.score1) : 
                           (match.team1_score !== undefined ? Number(match.team1_score) : 0),
                    isWinner: match.winner_team_id && (match.winner_team_id === match.team1_id),
                    avatarUrl: team1Avatar || null
                });
            }

            // Участник 2
            let team2Name = match.team2_name || match.participant2_name;
            let team2Avatar = match.team2_avatar_url;
            
            // Если есть team2_id, ищем команду в списке
            if (match.team2_id && teams.length > 0) {
                const team2 = findTeamById(match.team2_id);
                if (team2) {
                    team2Name = team2.name;
                    team2Avatar = team2.avatar_url || team2Avatar;
                    console.log(`🔍 Найдена команда 2: ${team2.name} (ID: ${match.team2_id})`);
                }
            }
            
            if (match.team2_id || team2Name) {
                participants.push({
                    id: match.team2_id || `team2_${match.id}`,
                    name: team2Name || 'TBD',
                    score: match.score2 !== undefined ? Number(match.score2) : 
                           (match.team2_score !== undefined ? Number(match.team2_score) : 0),
                    isWinner: match.winner_team_id && (match.winner_team_id === match.team2_id),
                    avatarUrl: team2Avatar || null
                });
            }

            // Если участников меньше 2, создаем пустых (для будущих матчей)
            while (participants.length < 2) {
                participants.push({
                    id: `empty_${match.id}_${participants.length}`,
                    name: 'TBD',
                    score: 0,
                    isWinner: false,
                    avatarUrl: null
                });
            }

            // Определяем раунд
            let round = 0;
            if (match.round !== undefined && match.round !== null) {
                round = Number(match.round);
            } else if (match.round_number !== undefined && match.round_number !== null) {
                round = Number(match.round_number);
            }

            // Определяем тип матча
            let bracket_type = 'winner';
            if (match.bracket_type) {
                bracket_type = match.bracket_type;
            } else if (match.match_type) {
                bracket_type = match.match_type;
            }

            // Определяем статус матча
            let state = 'OPEN';
            if (match.status === 'completed' || match.status === 'DONE' || match.state === 'DONE' || match.winner_team_id) {
                state = 'DONE';
            } else if (match.status === 'in_progress' || match.status === 'PENDING') {
                state = 'PENDING';
            }

            // Возвращаем объект в формате, ожидаемом BracketRenderer
            const transformedGame = {
                id: match.id,
                round: round,
                match_number: match.match_number || match.number || index + 1,
                bracket_type: bracket_type,
                is_third_place_match: Boolean(match.is_third_place_match || match.is_third_place),
                state: state,
                name: match.name || `Матч ${match.match_number || match.number || index + 1}`,
                participants: participants,
                winner_id: match.winner_team_id || match.winner_id || null,
                status: match.status || 'pending',
                // Дополнительные поля для совместимости
                completed_at: match.completed_at || match.updated_at,
                maps_data: match.maps_data || null
            };

            console.log(`🔄 Матч ${match.id} трансформирован:`, {
                round: transformedGame.round,
                bracket_type: transformedGame.bracket_type,
                state: transformedGame.state,
                participants: transformedGame.participants.map(p => p.name),
                hasWinner: !!transformedGame.winner_id,
                scores: transformedGame.participants.map(p => p.score)
            });

            return transformedGame;
        });
    }, [mixedTeams, tournament?.format]);

    // 🎯 УЛУЧШЕННАЯ ЗАГРУЗКА ТУРНИРА И ДАННЫХ
    const loadTournamentData = useCallback(async () => {
        if (!id) return;

        try {
            setLoading(true);
            setError(null);
            setDataLoadingStates(prev => ({ ...prev, tournament: true }));

            console.log('🔍 Загружаем данные турнира:', id);

            // Основной запрос турнира
            const tournamentResponse = await api.get(`/api/tournaments/${id}`);
            const tournamentData = tournamentResponse.data;
            
            console.log('✅ Турнир загружен:', {
                name: tournamentData.name,
                status: tournamentData.status,
                participantsCount: tournamentData.participants?.length,
                hasMatches: !!tournamentData.matches
            });
            
            setTournament(tournamentData);

            // Загружаем матчи с несколькими источниками
            let matchesData = [];
            
            // Источник 1: Матчи из основного ответа турнира
            if (tournamentData.matches && Array.isArray(tournamentData.matches) && tournamentData.matches.length > 0) {
                matchesData = tournamentData.matches;
                console.log('✅ Матчи загружены из основного ответа турнира:', matchesData.length);
            } 
            // Источник 2: Отдельный запрос матчей (fallback)
            else {
                try {
                    setDataLoadingStates(prev => ({ ...prev, matches: true }));
                    console.log('🔍 Пробуем загрузить матчи отдельным запросом...');
                    
                    const matchesResponse = await api.get(`/api/tournaments/${id}/matches`);
                    matchesData = matchesResponse.data || [];
                    
                    if (matchesData.length > 0) {
                        console.log('✅ Матчи загружены отдельным запросом:', matchesData.length);
                    } else {
                        console.log('ℹ️ Отдельный запрос матчей вернул пустой массив');
                    }
                } catch (matchesError) {
                    console.warn('⚠️ Ошибка загрузки матчей отдельным запросом:', matchesError.message);
                    
                    // Источник 3: Проверяем альтернативные поля в турнире
                    if (tournamentData.bracket_matches) {
                        matchesData = tournamentData.bracket_matches;
                        console.log('✅ Матчи найдены в bracket_matches:', matchesData.length);
                    } else if (tournamentData.tournament_matches) {
                        matchesData = tournamentData.tournament_matches;
                        console.log('✅ Матчи найдены в tournament_matches:', matchesData.length);
                    } else {
                        console.log('ℹ️ Матчи не найдены ни в одном источнике');
                        matchesData = [];
                    }
                }
            }

            // Логируем структуру данных матчей для диагностики
            if (matchesData.length > 0) {
                console.log('🔍 Структура первого матча:', matchesData[0]);
                console.log('🔍 Все ключи первого матча:', Object.keys(matchesData[0]));
                
                // Проверяем наличие результатов
                const completedMatches = matchesData.filter(m => 
                    m.status === 'completed' || m.state === 'DONE' || m.status === 'DONE'
                );
                console.log(`📊 Завершенных матчей: ${completedMatches.length} из ${matchesData.length}`);
            }

            setMatches(matchesData);
            
            // Загружаем команды для mix турниров И командных турниров
            if (tournamentData.format === 'mix' || tournamentData.participant_type === 'team') {
                let teamsData = [];
                
                // Источник 1: Команды из основного ответа (новое поле)
                if (tournamentData.teams && Array.isArray(tournamentData.teams)) {
                    teamsData = tournamentData.teams;
                    console.log('✅ Команды загружены из teams:', teamsData.length);
                }
                // Источник 2: Команды из mixed_teams (обратная совместимость)
                else if (tournamentData.mixed_teams && Array.isArray(tournamentData.mixed_teams)) {
                    teamsData = tournamentData.mixed_teams;
                    console.log('✅ Команды загружены из mixed_teams:', teamsData.length);
                }
                // Источник 3: Отдельный запрос команд (fallback)
                else {
                    try {
                        const teamsResponse = await api.get(`/api/tournaments/${id}/teams`);
                        if (teamsResponse.data && Array.isArray(teamsResponse.data)) {
                            teamsData = teamsResponse.data;
                            console.log('✅ Команды загружены отдельным запросом:', teamsData.length);
                        }
                    } catch (teamsError) {
                        console.warn('⚠️ Ошибка загрузки команд:', teamsError.message);
                        teamsData = [];
                    }
                }
                
                setMixedTeams(teamsData);
                
                // Логируем структуру команд для диагностики
                if (teamsData.length > 0) {
                    console.log('🔍 Структура первой команды:', teamsData[0]);
                    console.log('🔍 Составы команд:', teamsData.map(team => ({
                        name: team.name,
                        membersCount: team.members?.length || 0,
                        members: team.members?.map(m => m.name || m.username || 'Неизвестно')
                    })));
                }
            }

        } catch (tournamentError) {
            console.error('❌ Ошибка загрузки турнира:', tournamentError);
            setError(`Ошибка загрузки турнира: ${tournamentError.message}`);
        } finally {
            setLoading(false);
            setDataLoadingStates(prev => ({ 
                ...prev, 
                tournament: false, 
                matches: false 
            }));
        }
    }, [id]);

    // 🎯 WEBSOCKET ПОДКЛЮЧЕНИЕ
    const setupWebSocket = useCallback(() => {
        if (!user?.id || !tournament?.id) return null;

        const token = localStorage.getItem('token');
        if (!token) return null;

        try {
            console.log('🔌 Подключение к WebSocket для турнира', tournament.id);
            
            const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:3000', {
                query: { token },
                transports: ['websocket', 'polling'],
                timeout: 10000,
                forceNew: true
            });

            socket.on('connect', () => {
                console.log('✅ WebSocket подключен к турниру', tournament.id);
                setWsConnected(true);
                
                socket.emit('join-tournament', tournament.id);
                
                socket.emit('join_tournament_chat', tournament.id);
                
                console.log(`📡 Присоединился к турниру ${tournament.id} и чату`);
            });

            socket.on('disconnect', (reason) => {
                console.log('🔌 WebSocket отключен:', reason);
                setWsConnected(false);
            });

            socket.on('tournament-update', (data) => {
                console.log('📡 Обновление турнира через WebSocket:', data);
                setTournament(prev => ({ ...prev, ...data }));
                
                if (data.message) {
                    setMessage(data.message);
                    setTimeout(() => setMessage(''), 3000);
                }
            });

            socket.on('tournament_message', (data) => {
                console.log('💬 Сообщение чата турнира:', data);
            });

            socket.on('connect_error', (error) => {
                console.warn('⚠️ WebSocket ошибка подключения:', error.message);
                setWsConnected(false);
            });

            socket.on('error', (error) => {
                console.warn('⚠️ WebSocket ошибка:', error.message);
                setWsConnected(false);
            });

            return socket;
        } catch (error) {
            console.warn('⚠️ WebSocket не удалось создать:', error.message);
            return null;
        }
    }, [user?.id, tournament?.id]);

    // 🎯 ЭФФЕКТЫ
    useEffect(() => {
        loadUser();
    }, []);

    useEffect(() => {
        if (id) {
            loadTournamentData();
        }
    }, [id, loadTournamentData]);

    useEffect(() => {
        const socket = setupWebSocket();
        
        return () => {
            if (socket) {
                console.log('🔌 Отключение WebSocket');
                socket.disconnect();
            }
        };
    }, [setupWebSocket]);

    // 🎯 ОБРАБОТЧИКИ ДЕЙСТВИЙ
    const handleParticipate = useCallback(async () => {
        if (!user || !tournament) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/participate`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Вы успешно зарегистрировались в турнире!');
            setTimeout(() => setMessage(''), 3000);
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка участия:', error);
            setMessage(`❌ Ошибка регистрации: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [user, tournament, id, loadTournamentData]);

    // 🎯 МЕМОИЗИРОВАННЫЕ ДАННЫЕ ДЛЯ BRACKETRENDERER
    const bracketGames = useMemo(() => {
        if (!matches || matches.length === 0) {
            console.log('🎯 Нет матчей для трансформации');
            return [];
        }

        console.log('🎯 Начинаем трансформацию матчей:', {
            totalMatches: matches.length,
            teamsAvailable: mixedTeams?.length || 0,
            tournamentFormat: tournament?.format,
            sampleMatch: matches[0] ? {
                id: matches[0].id,
                status: matches[0].status,
                hasTeam1: !!matches[0].team1_id,
                hasTeam2: !!matches[0].team2_id,
                hasScore: matches[0].score1 !== undefined || matches[0].team1_score !== undefined,
                winner: matches[0].winner_team_id || matches[0].winner_id
            } : 'нет матчей'
        });

        // Передаем команды в функцию трансформации
        const transformedGames = transformMatchesToGames(matches, mixedTeams);
        
        console.log('🎯 Трансформированные игры для BracketRenderer:', {
            totalGames: transformedGames.length,
            validGames: transformedGames.filter(g => g.participants.length >= 2).length,
            completedGames: transformedGames.filter(g => g.state === 'DONE').length,
            gamesWithResults: transformedGames.filter(g => g.participants.some(p => p.score > 0)).length
        });
        
        return transformedGames;
    }, [matches, mixedTeams, tournament?.format]);

    const handleWithdraw = useCallback(async () => {
        if (!user || !tournament) return;

        try {
            const token = localStorage.getItem('token');
            await api.delete(`/api/tournaments/${id}/participate`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Вы покинули турнир');
            setTimeout(() => setMessage(''), 3000);
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка выхода:', error);
            setMessage(`❌ Ошибка выхода: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [user, tournament, id, loadTournamentData]);

    const handleGenerateBracket = useCallback(async () => {
        if (!userPermissions.canEdit) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/generate-bracket`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Сетка турнира сгенерирована!');
            setTimeout(() => setMessage(''), 3000);
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка генерации сетки:', error);
            setMessage(`❌ Ошибка генерации: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [userPermissions.canEdit, id, loadTournamentData]);

    const handleStartTournament = useCallback(async () => {
        if (!userPermissions.canEdit) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/start`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Турнир запущен!');
            setTimeout(() => setMessage(''), 3000);
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка запуска турнира:', error);
            setMessage(`❌ Ошибка запуска: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [userPermissions.canEdit, id, loadTournamentData]);

    const handleEndTournament = useCallback(async () => {
        if (!userPermissions.canEdit || !window.confirm('Вы уверены, что хотите завершить турнир?')) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/end`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Турнир завершен!');
            setTimeout(() => setMessage(''), 3000);
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка завершения турнира:', error);
            setMessage(`❌ Ошибка завершения: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [userPermissions.canEdit, id, loadTournamentData]);

    const handleClearResults = useCallback(async () => {
        if (!userPermissions.canEdit || !window.confirm('Вы уверены? Все результаты будут удалены!')) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/api/tournaments/${id}/clear-results`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Результаты очищены!');
            setTimeout(() => setMessage(''), 3000);
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка очистки результатов:', error);
            setMessage(`❌ Ошибка очистки: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [userPermissions.canEdit, id, loadTournamentData]);

    const handleTeamClick = useCallback((teamName) => {
        console.log('Клик по команде:', teamName);
        // Здесь может быть логика показа состава команды
    }, []);

    const handleMatchClick = useCallback((matchParam) => {
        // Определяем ID матча - может прийти как число или как объект с полем id
        const matchId = typeof matchParam === 'object' ? matchParam.id : matchParam;
        
        console.log('🔍 Клик по матчу для просмотра деталей:', matchId);
        console.log('🔍 Тип параметра:', typeof matchParam, ', значение:', matchParam);
        
        // Специальная диагностика для турнира 54
        if (tournament?.id === 54 || tournament?.id === '54') {
            console.log('🎯 СПЕЦИАЛЬНАЯ ДИАГНОСТИКА ТУРНИРА 54:');
            console.log('- ID турнира:', tournament.id);
            console.log('- Игра турнира:', tournament.game);
            console.log('- Все матчи:', matches.length, 'шт.');
            console.log('- Матчи с maps_data:', matches.filter(m => m.maps_data).length, 'шт.');
            matches.filter(m => m.maps_data).forEach((m, i) => {
                console.log(`  Матч ${i + 1} (ID ${m.id}): maps_data =`, m.maps_data);
            });
            
            // Дополнительная диагностика поиска матча
            console.log('🔍 ДИАГНОСТИКА ПОИСКА МАТЧА:');
            console.log('- Ищем матч с ID:', matchId);
            console.log('- Все ID матчей в массиве:', matches.map(m => m.id));
            console.log('- Типы ID в массиве:', matches.map(m => typeof m.id));
            console.log('- Тип искомого ID:', typeof matchId);
        }
        
        // Ищем полные данные матча в исходном массиве matches
        // Пробуем найти как по числовому, так и по строковому ID
        let fullMatchData = matches.find(m => m.id === matchId);
        
        // Если не найден, пробуем преобразовать типы
        if (!fullMatchData) {
            fullMatchData = matches.find(m => 
                String(m.id) === String(matchId) || 
                Number(m.id) === Number(matchId)
            );
        }
        
        // Если все еще не найден и у нас есть объект матча, пробуем по другим полям
        if (!fullMatchData && typeof matchParam === 'object') {
            fullMatchData = matches.find(m => 
                m.match_number === matchParam.match_number ||
                m.number === matchParam.match_number ||
                (m.round === matchParam.round && m.match_number === matchParam.match_number)
            );
        }
        
        if (fullMatchData) {
            console.log('✅ НАЙДЕН МАТЧ В МАССИВЕ!');
            console.log('- Найденный матч ID:', fullMatchData.id);
            console.log('- maps_data найденного матча:', fullMatchData.maps_data);
            
            // Дополнительная диагностика для любого матча
            console.log('📊 ДИАГНОСТИКА ДАННЫХ МАТЧА:');
            console.log('- ID матча:', fullMatchData.id);
            console.log('- maps_data:', fullMatchData.maps_data);
            console.log('- Тип maps_data:', typeof fullMatchData.maps_data);
            console.log('- Длина (если массив):', Array.isArray(fullMatchData.maps_data) ? fullMatchData.maps_data.length : 'N/A');
            console.log('- Содержимое maps_data:', fullMatchData.maps_data);
            
            // ДОПОЛНИТЕЛЬНАЯ ДЕТАЛЬНАЯ ДИАГНОСТИКА СТРУКТУРЫ КАРТ
            if (Array.isArray(fullMatchData.maps_data)) {
                console.log('🗺️ ДЕТАЛЬНАЯ ДИАГНОСТИКА КАРТ:');
                fullMatchData.maps_data.forEach((mapData, index) => {
                    console.log(`Карта ${index + 1}:`, mapData);
                    console.log(`- Все ключи:`, Object.keys(mapData));
                    console.log(`- Название (map):`, mapData.map);
                    console.log(`- Название (name):`, mapData.name);
                    console.log(`- Счет 1 (score1):`, mapData.score1);
                    console.log(`- Счет 2 (score2):`, mapData.score2);
                    console.log(`- Счет команды 1 (team1_score):`, mapData.team1_score);
                    console.log(`- Счет команды 2 (team2_score):`, mapData.team2_score);
                    console.log(`- Объект карты (если есть):`, mapData.map && typeof mapData.map === 'object' ? mapData.map : 'N/A');
                });
            }
            
            // Обогащаем данные матча информацией из game объекта (если был передан объект)
            const enrichedMatch = {
                ...fullMatchData,
                // Добавляем имена команд из переданного объекта, если их нет в полных данных
                team1_name: fullMatchData.team1_name || 
                           (typeof matchParam === 'object' && matchParam.participants?.[0] 
                            ? matchParam.participants[0].name : 'Команда 1'),
                team2_name: fullMatchData.team2_name || 
                           (typeof matchParam === 'object' && matchParam.participants?.[1] 
                            ? matchParam.participants[1].name : 'Команда 2')
            };
            
            console.log('🎯 Устанавливаем selectedMatch:', enrichedMatch);
            setSelectedMatch(enrichedMatch);
        } else {
            console.warn('⚠️ Полные данные матча не найдены в массиве matches');
            console.log('- Параметр матча:', matchParam);
            console.log('- Искомый ID:', matchId);
            console.log('- Доступные ID в matches:', matches.map(m => m.id));
            
            // Все равно показываем модальное окно с доступными данными
            const fallbackMatch = {
                id: matchId,
                team1_name: typeof matchParam === 'object' && matchParam.participants?.[0]?.name || 'Команда 1',
                team2_name: typeof matchParam === 'object' && matchParam.participants?.[1]?.name || 'Команда 2',
                score1: typeof matchParam === 'object' && matchParam.participants?.[0]?.score || 0,
                score2: typeof matchParam === 'object' && matchParam.participants?.[1]?.score || 0,
                winner_team_id: typeof matchParam === 'object' ? matchParam.winner_id : null,
                maps_data: null // Нет данных карт
            };
            
            console.log('🎯 Используем fallback данные:', fallbackMatch);
            setSelectedMatch(fallbackMatch);
        }
    }, [matches, tournament]);

    const handleRemoveParticipant = useCallback(async (participantId) => {
        if (!userPermissions.canEdit || !window.confirm('Удалить участника?')) return;

        try {
            const token = localStorage.getItem('token');
            await api.delete(`/api/tournaments/${id}/participants/${participantId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMessage('✅ Участник удален');
            setTimeout(() => setMessage(''), 3000);
            loadTournamentData();
        } catch (error) {
            console.error('❌ Ошибка удаления участника:', error);
            setMessage(`❌ Ошибка: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    }, [userPermissions.canEdit, id, loadTournamentData]);

    const handleTeamsGenerated = useCallback((teams) => {
        console.log('✅ Команды сгенерированы:', teams);
        setMixedTeams(teams);
        loadTournamentData();
    }, [loadTournamentData]);

    const handleTeamsUpdated = useCallback(() => {
        console.log('✅ Команды обновлены');
        loadTournamentData();
    }, [loadTournamentData]);

    // 🎯 НАВИГАЦИЯ ПО ВКЛАДКАМ
    const tabs = useMemo(() => [
        { id: 'info', label: 'Информация', icon: 'ℹ️' },
        { id: 'participants', label: 'Участники', icon: '👥' },
        { id: 'bracket', label: 'Сетка', icon: '🏆' },
        { id: 'results', label: 'Результаты', icon: '📊' },
        { id: 'admin', label: 'Управление', icon: '⚙️', adminOnly: true }
    ], []);

    const visibleTabs = useMemo(() => 
        tabs.filter(tab => !tab.adminOnly || userPermissions.isAdminOrCreator),
        [tabs, userPermissions.isAdminOrCreator]
    );

    // 🎯 СОСТОЯНИЯ ЗАГРУЗКИ
    if (loading) {
        return (
            <div className="tournament-details-tournamentdetails tournament-loading">
                <div className="loading-spinner"></div>
                <h2>Загружаем турнир...</h2>
                <div className="loading-details">
                    {dataLoadingStates.tournament && <p>📄 Загрузка данных турнира...</p>}
                    {dataLoadingStates.matches && <p>🏆 Загрузка матчей...</p>}
                    {dataLoadingStates.user && <p>👤 Загрузка профиля...</p>}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="tournament-details-tournamentdetails tournament-error">
                <h2>❌ Ошибка</h2>
                <p>{error}</p>
                <div className="error-actions">
                    <button onClick={() => {
                        setError(null);
                        loadTournamentData();
                    }}>
                        🔄 Попробовать снова
                    </button>
                    <Link to="/tournaments">
                        ← Вернуться к турнирам
                    </Link>
                </div>
            </div>
        );
    }

    if (!tournament) {
        return (
            <div className="tournament-details-tournamentdetails tournament-not-found">
                <h2>🔍 Турнир не найден</h2>
                <p>Турнир с ID {id} не существует или был удален.</p>
                <Link to="/tournaments">← Вернуться к списку турниров</Link>
            </div>
        );
    }

    return (
        <TournamentErrorBoundary>
            <section className="tournament-details-tournamentdetails">
                {/* 🎯 ЗАГОЛОВОК ТУРНИРА */}
                <div className="tournament-header-tournamentdetails">
                    <h2>{tournament.name}</h2>
                    <div className="tournament-meta">
                        <span className={`status-badge ${tournament.status?.toLowerCase()}`}>
                            {tournament.status === 'registration' && '📋 Регистрация'}
                            {tournament.status === 'active' && '🎮 Активный'}
                            {tournament.status === 'in_progress' && '⚔️ В процессе'}
                            {tournament.status === 'completed' && '🏆 Завершен'}
                        </span>
                        {wsConnected && (
                            <span className="websocket-indicator connected" title="Обновления в реальном времени">
                                🟢 Online
                            </span>
                        )}
                        <span className="participants-count">
                            👥 {tournament.participants?.length || 0}
                            {tournament.max_participants && ` / ${tournament.max_participants}`}
                        </span>
                    </div>
                </div>

                {/* 🎯 НАВИГАЦИЯ ПО ВКЛАДКАМ */}
                <nav className="tabs-navigation-tournamentdetails">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-button-tournamentdetails ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="tab-icon">{tab.icon}</span>
                            <span className="tab-label-tournamentdetails">{tab.label}</span>
                        </button>
                    ))}
                </nav>

                {/* 🎯 СОДЕРЖИМОЕ ВКЛАДОК */}
                <div className="tournament-content-tournamentdetails">
                    {/* ВКЛАДКА: ИНФОРМАЦИЯ */}
                    {activeTab === 'info' && (
                        <div className="tab-content-tournamentdetails tab-info-tournamentdetails">
                            <div className="tournament-info-grid-tournamentdetails">
                                <div className="info-main-tournamentdetails">
                                    <div className="info-block-tournamentdetails">
                                        <h3>📋 Основная информация</h3>
                                        <div className="tournament-meta-info-tournamentdetails">
                                            <div className="meta-item-tournamentdetails">
                                                <strong>🎮 Игра:</strong> {tournament.game || 'Не указана'}
                                            </div>
                                            <div className="meta-item-tournamentdetails">
                                                <strong>🏆 Формат:</strong> {tournament.format || 'Не указан'}
                                            </div>
                                            <div className="meta-item-tournamentdetails">
                                                <strong>👥 Участников:</strong> {tournament.participants?.length || 0}
                                                {tournament.max_participants && ` из ${tournament.max_participants}`}
                                            </div>
                                            <div className="meta-item-tournamentdetails">
                                                <strong>📅 Создан:</strong> {new Date(tournament.created_at).toLocaleString('ru-RU')}
                                            </div>
                                            {tournament.start_date && (
                                                <div className="meta-item-tournamentdetails">
                                                    <strong>🕐 Начало:</strong> {new Date(tournament.start_date).toLocaleString('ru-RU')}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {tournament.description && (
                                        <div className="info-block-tournamentdetails">
                                            <h3>📝 Описание</h3>
                                            <p className="tournament-description">{tournament.description}</p>
                                        </div>
                                    )}

                                    {tournament.rules && (
                                        <div className="info-block-tournamentdetails">
                                            <h3>📜 Правила</h3>
                                            <p className="tournament-rules">{tournament.rules}</p>
                                        </div>
                                    )}

                                    {tournament.prize_pool && (
                                        <div className="info-block-tournamentdetails">
                                            <h3>💰 Призовой фонд</h3>
                                            <p className="tournament-prize">{tournament.prize_pool}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* КНОПКИ УЧАСТИЯ */}
                            {user && tournament.status === 'registration' && (
                                <div className="participation-controls">
                                    {!userPermissions.isParticipating ? (
                                        <button 
                                            className="btn btn-primary participate-btn"
                                            onClick={handleParticipate}
                                        >
                                            🎯 Участвовать в турнире
                                        </button>
                                    ) : (
                                        <button 
                                            className="btn btn-secondary withdraw-btn"
                                            onClick={handleWithdraw}
                                        >
                                            ❌ Покинуть турнир
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ВКЛАДКА: УЧАСТНИКИ */}
                    {activeTab === 'participants' && (
                        <div className="tab-content-tournamentdetails">
                            <h3>👥 Участники турнира ({tournament.participants?.length || 0})</h3>
                            
                            {tournament.participants && tournament.participants.length > 0 ? (
                                <>
                                    <div className="original-participants-list-wrapper">
                                        <h3>📋 Список участников</h3>
                                        <div className="original-participants-grid">
                                            {tournament.participants.map((participant, index) => (
                                                <div key={participant.id || index} className="participant-card">
                                                    <div className="participant-avatar">
                                                        {participant.avatar_url ? (
                                                            <img 
                                                                src={ensureHttps(participant.avatar_url)} 
                                                                alt={participant.name || participant.username || 'Участник'}
                                                                onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                            />
                                                        ) : (
                                                            <div className="avatar-placeholder">
                                                                {(participant.name || participant.username || 'У').charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="participant-info">
                                                        <Link 
                                                            to={`/profile/${participant.user_id || participant.id}`}
                                                            className="participant-name"
                                                        >
                                                            {participant.name || participant.username || 'Участник'}
                                                        </Link>
                                                        {participant.faceit_elo && (
                                                            <div className="participant-elo">
                                                                FACEIT: {participant.faceit_elo}
                                                            </div>
                                                        )}
                                                        {participant.cs2_rank && (
                                                            <div className="participant-rank">
                                                                CS2: {participant.cs2_rank}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {userPermissions.isAdminOrCreator && (
                                                        <button
                                                            className="remove-participant"
                                                            onClick={() => handleRemoveParticipant(participant.id)}
                                                            title="Удалить участника"
                                                        >
                                                            ❌
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* MIX ТУРНИРЫ: ОТОБРАЖЕНИЕ КОМАНД */}
                                    {tournament.format === 'mix' && mixedTeams && mixedTeams.length > 0 && (
                                        <div className="mixed-teams">
                                            <h3>🎲 Сформированные команды</h3>
                                            <div className="mixed-teams-grid">
                                                {mixedTeams.map((team, index) => (
                                                    <div key={team.id || index} className="team-card">
                                                        <h4>
                                                            {team.name || `Команда ${index + 1}`}
                                                            <span className="team-rating">
                                                                Средний рейтинг: {calculateTeamAverageRating(team)}
                                                            </span>
                                                        </h4>
                                                        <table className="team-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>Игрок</th>
                                                                    <th>{ratingType === 'faceit' ? 'FACEIT ELO' : 'CS2 Premier'}</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {team.members?.map((member, memberIndex) => (
                                                                    <tr key={member.user_id || member.participant_id || memberIndex}>
                                                                        <td>
                                                                            <Link to={`/profile/${member.user_id || member.participant_id}`}>
                                                                                {member.name || member.username || 'Игрок'}
                                                                            </Link>
                                                                        </td>
                                                                        <td>
                                                                            {ratingType === 'faceit' 
                                                                                ? member.faceit_elo || '—'
                                                                                : member.cs2_premier_rank || '—'
                                                                            }
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="empty-state">
                                    <p>👤 Пока нет участников</p>
                                    {user && tournament.status === 'registration' && !userPermissions.isParticipating && (
                                        <button 
                                            className="btn btn-primary"
                                            onClick={handleParticipate}
                                        >
                                            Стать первым участником
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* MIX ТУРНИРЫ: ГЕНЕРАЦИЯ КОМАНД */}
                            {tournament.format === 'mix' && userPermissions.isAdminOrCreator && tournament.status === 'registration' && (
                                <div className="team-generator-section">
                                    <h3>⚡ Управление командами</h3>
                                    <div className="rating-type-selector">
                                        <label>Тип рейтинга для балансировки:</label>
                                        <select 
                                            value={ratingType} 
                                            onChange={(e) => setRatingType(e.target.value)}
                                        >
                                            <option value="faceit">FACEIT ELO</option>
                                            <option value="cs2">CS2 Premier</option>
                                        </select>
                                    </div>
                                    <TeamGenerator 
                                        tournament={tournament}
                                        participants={tournament.participants || []}
                                        onTeamsGenerated={handleTeamsGenerated}
                                        onTeamsUpdated={handleTeamsUpdated}
                                        onRemoveParticipant={handleRemoveParticipant}
                                        isAdminOrCreator={userPermissions.isAdminOrCreator}
                                        toast={(msg) => {
                                            setMessage(msg);
                                            setTimeout(() => setMessage(''), 3000);
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ВКЛАДКА: СЕТКА */}
                    {activeTab === 'bracket' && (
                        <div className="tab-content-tournamentdetails">
                            <h3>🏆 Турнирная сетка</h3>
                            
                            {matches && matches.length > 0 ? (
                                <div className="custom-tournament-bracket">
                                    <BracketRenderer 
                                        games={bracketGames}
                                        canEditMatches={userPermissions.canEdit}
                                        selectedMatch={selectedMatch}
                                        setSelectedMatch={setSelectedMatch}
                                        handleTeamClick={handleTeamClick}
                                        format={tournament.format}
                                        onMatchClick={handleMatchClick}
                                    />
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p>🏆 Сетка турнира еще не создана</p>
                                    {userPermissions.isAdminOrCreator && tournament.status === 'registration' && (
                                        <button 
                                            className="btn btn-primary generate-bracket-button"
                                            onClick={handleGenerateBracket}
                                        >
                                            ⚡ Создать сетку
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ВКЛАДКА: РЕЗУЛЬТАТЫ */}
                    {activeTab === 'results' && (
                        <div className="tab-content-tournamentdetails">
                            <h3>📊 Результаты матчей</h3>
                            
                            {matches && matches.filter(m => m.status === 'completed').length > 0 ? (
                                <div className="results-compact-list">
                                    {matches
                                        .filter(match => match.status === 'completed')
                                        .sort((a, b) => b.round - a.round || new Date(b.completed_at) - new Date(a.completed_at))
                                        .map(match => (
                                            <div key={match.id} className="result-compact-item">
                                                <div className="result-compact-content">
                                                    <div className="result-compact-round">
                                                        Раунд {match.round}
                                                        {match.is_third_place_match && (
                                                            <span className="third-place-indicator">🥉 Матч за 3-е место</span>
                                                        )}
                                                    </div>
                                                    <div className="result-compact-match">
                                                        <button 
                                                            className={`team-name-btn ${match.winner_team_id === match.team1_id ? 'winner' : ''}`}
                                                            onClick={() => handleTeamClick(match.team1_name)}
                                                        >
                                                            {match.team1_name || 'Команда 1'}
                                                        </button>
                                                        <span className="match-score">
                                                            {match.team1_score || 0} : {match.team2_score || 0}
                                                        </span>
                                                        <button 
                                                            className={`team-name-btn ${match.winner_team_id === match.team2_id ? 'winner' : ''}`}
                                                            onClick={() => handleTeamClick(match.team2_name)}
                                                        >
                                                            {match.team2_name || 'Команда 2'}
                                                        </button>
                                                    </div>
                                                    <button 
                                                        className="details-btn"
                                                        onClick={() => handleMatchClick(match)}
                                                    >
                                                        Подробнее
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p>📊 Результатов пока нет</p>
                                    <p>Результаты появятся после завершения матчей</p>
                                </div>
                            )}

                            {/* ПОБЕДИТЕЛИ */}
                            {tournament.status === 'completed' && tournament.winner_id && (
                                <div className="winners-section">
                                    <h3>🏆 Призёры турнира</h3>
                                    <div className="winners-podium">
                                        {/* Первое место */}
                                        <div className="winner-card place-1">
                                            <div className="medal-icon gold-medal">🥇</div>
                                            <div className="winner-info">
                                                {tournament.format === 'mix' ? (
                                                    <div className="team-winner">
                                                        <h4>{tournament.winner_name || 'Команда победитель'}</h4>
                                                        {/* Здесь можно показать состав команды */}
                                                    </div>
                                                ) : (
                                                    <Link to={`/profile/${tournament.winner_id}`} className="winner-name">
                                                        {tournament.winner_name || 'Победитель'}
                                                    </Link>
                                                )}
                                            </div>
                                        </div>

                                        {/* Второе место */}
                                        {tournament.second_place_id && (
                                            <div className="winner-card place-2">
                                                <div className="medal-icon silver-medal">🥈</div>
                                                <div className="winner-info">
                                                    {tournament.format === 'mix' ? (
                                                        <div className="team-winner">
                                                            <h4>{tournament.second_place_name || 'Второе место'}</h4>
                                                        </div>
                                                    ) : (
                                                        <Link to={`/profile/${tournament.second_place_id}`} className="winner-name">
                                                            {tournament.second_place_name || 'Второе место'}
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Третье место */}
                                        {tournament.third_place_id && (
                                            <div className="winner-card place-3">
                                                <div className="medal-icon bronze-medal">🥉</div>
                                                <div className="winner-info">
                                                    {tournament.format === 'mix' ? (
                                                        <div className="team-winner">
                                                            <h4>{tournament.third_place_name || 'Третье место'}</h4>
                                                        </div>
                                                    ) : (
                                                        <Link to={`/profile/${tournament.third_place_id}`} className="winner-name">
                                                            {tournament.third_place_name || 'Третье место'}
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ВКЛАДКА: УПРАВЛЕНИЕ */}
                    {activeTab === 'admin' && userPermissions.isAdminOrCreator && (
                        <div className="tab-content-tournamentdetails">
                            <div className="tournament-management-panel">
                                <h3 className="management-title">⚙️ Панель управления турниром</h3>
                                
                                <div className="management-actions">
                                    {/* Управление турниром */}
                                    <div className="action-group">
                                        <h4 className="action-group-title">🎮 Управление турниром</h4>
                                        <div className="action-buttons">
                                            {tournament.status === 'registration' && (
                                                <>
                                                    {(!matches || matches.length === 0) && (
                                                        <button 
                                                            className="management-btn generate-bracket-button"
                                                            onClick={handleGenerateBracket}
                                                            title="Создать турнирную сетку"
                                                        >
                                                            <span className="btn-icon">⚡</span>
                                                            Создать сетку
                                                        </button>
                                                    )}
                                                    
                                                    {matches && matches.length > 0 && (
                                                        <button 
                                                            className="management-btn start-tournament"
                                                            onClick={handleStartTournament}
                                                            title="Запустить турнир"
                                                        >
                                                            <span className="btn-icon">🚀</span>
                                                            Запустить турнир
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            
                                            {(tournament.status === 'active' || tournament.status === 'in_progress') && (
                                                <button 
                                                    className="management-btn end-tournament"
                                                    onClick={handleEndTournament}
                                                    title="Завершить турнир"
                                                >
                                                    <span className="btn-icon">🏁</span>
                                                    Завершить турнир
                                                </button>
                                            )}
                                            
                                            {matches && matches.length > 0 && tournament.status !== 'completed' && (
                                                <button 
                                                    className="management-btn regenerate-bracket"
                                                    onClick={handleGenerateBracket}
                                                    title="Пересоздать сетку"
                                                >
                                                    <span className="btn-icon">🔄</span>
                                                    Пересоздать сетку
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Управление результатами */}
                                    <div className="action-group">
                                        <h4 className="action-group-title">📊 Управление результатами</h4>
                                        <div className="action-buttons">
                                            {matches && matches.some(m => m.status === 'completed') && (
                                                <button 
                                                    className="management-btn clear-results-button"
                                                    onClick={handleClearResults}
                                                    title="Очистить все результаты"
                                                >
                                                    <span className="btn-icon">🗑️</span>
                                                    Очистить результаты
                                                </button>
                                            )}
                                            
                                            <button 
                                                className="management-btn"
                                                onClick={loadTournamentData}
                                                title="Обновить данные турнира"
                                            >
                                                <span className="btn-icon">🔄</span>
                                                Обновить данные
                                            </button>
                                        </div>
                                    </div>

                                    {/* Статистика */}
                                    <div className="action-group">
                                        <h4 className="action-group-title">📈 Статистика турнира</h4>
                                        <div className="tournament-stats">
                                            <div className="stat-item">
                                                <span className="stat-label">Участников:</span>
                                                <span className="stat-value">{tournament.participants?.length || 0}</span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-label">Матчей:</span>
                                                <span className="stat-value">{matches?.length || 0}</span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-label">Завершено:</span>
                                                <span className="stat-value">
                                                    {matches?.filter(m => m.status === 'completed').length || 0}
                                                </span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-label">В процессе:</span>
                                                <span className="stat-value">
                                                    {matches?.filter(m => m.status === 'in_progress').length || 0}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Информация о завершенном турнире */}
                                {tournament.status === 'completed' && (
                                    <div className="tournament-completed-info">
                                        <div className="completed-status">
                                            <span className="btn-icon">🏆</span>
                                            <div className="status-text">
                                                <p>Турнир завершен</p>
                                                {tournament.winner_name && (
                                                    <p>Победитель: <strong>{tournament.winner_name}</strong></p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 🎯 СООБЩЕНИЯ */}
                {message && (
                    <div className={`message-notification ${message.includes('✅') ? 'success' : 'error'}`}>
                        {message}
                    </div>
                )}

                {/* 🎯 МОДАЛЬНОЕ ОКНО ДЕТАЛЕЙ МАТЧА */}
                {selectedMatch && (
                    <div className="modal" onClick={() => setSelectedMatch(null)}>
                        <div className="match-details-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-content match-details-modal-content">
                                {/* 🔍 Диагностика данных матча */}
                                {process.env.NODE_ENV === 'development' && (
                                    <div style={{ background: '#f0f0f0', padding: '10px', margin: '10px', fontSize: '12px', fontFamily: 'monospace' }}>
                                        <strong>🔍 DEBUG:</strong>
                                        <br />selectedMatch.maps_data: {JSON.stringify(selectedMatch.maps_data, null, 2)}
                                        <br />тип maps_data: {typeof selectedMatch.maps_data}
                                        <br />tournament.game: {tournament?.game}
                                        <br />tournament.id: {tournament?.id}
                                        <br />длина maps_data: {selectedMatch.maps_data ? (typeof selectedMatch.maps_data === 'string' ? selectedMatch.maps_data.length : 'не строка') : 'null/undefined'}
                                        {selectedMatch.maps_data && (
                                            <>
                                                <br />попытка парсинга: {(() => {
                                                    try {
                                                        const parsed = typeof selectedMatch.maps_data === 'string' 
                                                            ? JSON.parse(selectedMatch.maps_data) 
                                                            : selectedMatch.maps_data;
                                                        return `успешно, ${Array.isArray(parsed) ? `массив из ${parsed.length} элементов` : `объект: ${typeof parsed}`}`;
                                                    } catch (e) {
                                                        return `ошибка: ${e.message}`;
                                                    }
                                                })()}
                                            </>
                                        )}
                                    </div>
                                )}
                                
                                <div className="team-modal-header">
                                    <h3>Детали матча</h3>
                                    <button 
                                        className="close-btn"
                                        onClick={() => setSelectedMatch(null)}
                                        title="Закрыть"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="match-summary">
                                    <h4>Общая информация</h4>
                                    <div className="match-teams">
                                        <div className={`team-info ${selectedMatch.winner_team_id === selectedMatch.team1_id ? 'winner' : ''}`}>
                                            <h5>{selectedMatch.team1_name || 'Команда 1'}</h5>
                                            <div className="team-score">{selectedMatch.score1 || 0}</div>
                                            {selectedMatch.winner_team_id === selectedMatch.team1_id && (
                                                <div className="winner-badge">🏆 Победитель</div>
                                            )}
                                        </div>
                                        
                                        <div className="vs-separator">VS</div>
                                        
                                        <div className={`team-info ${selectedMatch.winner_team_id === selectedMatch.team2_id ? 'winner' : ''}`}>
                                            <h5>{selectedMatch.team2_name || 'Команда 2'}</h5>
                                            <div className="team-score">{selectedMatch.score2 || 0}</div>
                                            {selectedMatch.winner_team_id === selectedMatch.team2_id && (
                                                <div className="winner-badge">🏆 Победитель</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="final-score">
                                        <div className="score-item">
                                            <span className="score-label">Итоговый счет:</span>
                                            <span className={`score-value ${selectedMatch.winner_team_id === selectedMatch.team1_id ? 'winner-score' : ''}`}>
                                                {selectedMatch.score1 || 0}
                                            </span>
                                            <span className="score-separator">:</span>
                                            <span className={`score-value ${selectedMatch.winner_team_id === selectedMatch.team2_id ? 'winner-score' : ''}`}>
                                                {selectedMatch.score2 || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* ДЕТАЛИ КАРТ/ИГР */}
                                {selectedMatch.maps_data && (() => {
                                    try {
                                        const mapsData = typeof selectedMatch.maps_data === 'string' 
                                            ? JSON.parse(selectedMatch.maps_data) 
                                            : selectedMatch.maps_data;
                                        
                                        console.log('🗺️ ОБРАБОТКА MAPS_DATA В МОДАЛЬНОМ ОКНЕ:', mapsData);
                                        
                                        if (Array.isArray(mapsData) && mapsData.length > 0) {
                                            // Подсчет выигранных карт
                                            let team1MapsWon = 0;
                                            let team2MapsWon = 0;
                                            let totalTeam1Score = 0;
                                            let totalTeam2Score = 0;

                                            mapsData.forEach((map, index) => {
                                                console.log(`🗺️ Обработка карты ${index + 1}:`, map);
                                                
                                                // Гибкое извлечение счета - пробуем разные поля
                                                const score1 = parseInt(map.score1) || parseInt(map.team1_score) || 0;
                                                const score2 = parseInt(map.score2) || parseInt(map.team2_score) || 0;
                                                
                                                console.log(`- Извлеченный счет: ${score1} : ${score2}`);
                                                
                                                totalTeam1Score += score1;
                                                totalTeam2Score += score2;
                                                
                                                if (score1 > score2) {
                                                    team1MapsWon++;
                                                } else if (score2 > score1) {
                                                    team2MapsWon++;
                                                }
                                            });

                                            return (
                                                <div className="maps-results">
                                                    <h4>📋 Результаты по картам</h4>
                                                    
                                                    <div className="maps-statistics">
                                                        <h5>Общая статистика</h5>
                                                        <div className="maps-stats">
                                                            <div className="stat-item">
                                                                <span className="stat-label">Карт выиграно:</span>
                                                                <span className="stat-value-maps">
                                                                    {team1MapsWon} : {team2MapsWon}
                                                                </span>
                                                            </div>
                                                            <div className="stat-item">
                                                                <span className="stat-label">Общий счет:</span>
                                                                <span className="stat-value-maps">
                                                                    {totalTeam1Score} : {totalTeam2Score}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <table className="maps-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Карта</th>
                                                                <th>{selectedMatch.team1_name || 'Команда 1'}</th>
                                                                <th>{selectedMatch.team2_name || 'Команда 2'}</th>
                                                                <th>Победитель</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {mapsData.map((map, index) => {
                                                                // Гибкое извлечение названия карты
                                                                let mapName = 'Карта ' + (index + 1);
                                                                
                                                                if (map.name) {
                                                                    mapName = map.name;
                                                                } else if (typeof map.map === 'string') {
                                                                    mapName = map.map;
                                                                } else if (typeof map.map === 'object' && map.map?.name) {
                                                                    mapName = map.map.name;
                                                                } else if (map.mapName) {
                                                                    mapName = map.mapName;
                                                                }
                                                                
                                                                // Гибкое извлечение счета
                                                                const score1 = parseInt(map.score1) || parseInt(map.team1_score) || 0;
                                                                const score2 = parseInt(map.score2) || parseInt(map.team2_score) || 0;
                                                                const mapWinner = score1 > score2 ? 'team1' : 
                                                                                 score2 > score1 ? 'team2' : 'draw';
                                                                
                                                                console.log(`🗺️ Рендер карты ${index + 1}: название="${mapName}", счет="${score1}:${score2}"`);
                                                                
                                                                return (
                                                                    <tr key={index}>
                                                                        <td>{mapName}</td>
                                                                        <td className={mapWinner === 'team1' ? 'map-winner' : ''}>
                                                                            {score1}
                                                                        </td>
                                                                        <td className={mapWinner === 'team2' ? 'map-winner' : ''}>
                                                                            {score2}
                                                                        </td>
                                                                        <td>
                                                                            {mapWinner === 'team1' && (
                                                                                <span>🏆 {selectedMatch.team1_name || 'Команда 1'}</span>
                                                                            )}
                                                                            {mapWinner === 'team2' && (
                                                                                <span>🏆 {selectedMatch.team2_name || 'Команда 2'}</span>
                                                                            )}
                                                                            {mapWinner === 'draw' && (
                                                                                <span>🤝 Ничья</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        }
                                    } catch (error) {
                                        console.error('❌ Ошибка обработки данных карт:', error);
                                        console.log('Исходные данные maps_data:', selectedMatch.maps_data);
                                        return (
                                            <div className="maps-results">
                                                <h4>📋 Результаты по картам</h4>
                                                <p>⚠️ Ошибка обработки данных карт</p>
                                                <details>
                                                    <summary>Показать техническую информацию</summary>
                                                    <pre>{JSON.stringify(selectedMatch.maps_data, null, 2)}</pre>
                                                </details>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* ОТСУТСТВИЕ ДЕТАЛЕЙ ПО КАРТАМ */}
                                {(!selectedMatch.maps_data || 
                                  (typeof selectedMatch.maps_data === 'string' && selectedMatch.maps_data === '[]') ||
                                  (Array.isArray(selectedMatch.maps_data) && selectedMatch.maps_data.length === 0)) && (
                                    <div className="no-maps-info">
                                        <p>ℹ️ Детальная информация по картам недоступна</p>
                                        <p>Отображается только общий результат матча</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </TournamentErrorBoundary>
    );
}

export default TournamentDetails;