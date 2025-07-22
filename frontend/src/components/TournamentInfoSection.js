import React, { useState, useEffect } from 'react';
import './TournamentInfoSection.css';
import { ensureHttps } from '../utils/userHelpers';
import ParticipationConfirmModal from './tournament/modals/ParticipationConfirmModal';
import TeamSelectionModal from './modals/TeamSelectionModal';
import axios from 'axios'; // Added axios import

const TournamentInfoSection = ({ 
    tournament, 
    user, 
    isCreator, 
    isAdminOrCreator,
    onParticipationUpdate, // Колбэк для обновления данных турнира
    userTeams = [] // Команды пользователя
}) => {
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isEditingRegulations, setIsEditingRegulations] = useState(false);
    const [description, setDescription] = useState(tournament?.description || '');
    const [regulations, setRegulations] = useState(tournament?.rules || '');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const [showActions, setShowActions] = useState(false);
    
    // 🆕 Состояния для управления отображением регламента
    const [showRegulationsTooltip, setShowRegulationsTooltip] = useState(false);

    // 🆕 Состояния для участия в турнире
    const [showParticipationConfirm, setShowParticipationConfirm] = useState(false);
    const [showTeamSelection, setShowTeamSelection] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [participationLoading, setParticipationLoading] = useState(false);
    const [isParticipating, setIsParticipating] = useState(false); // Added isParticipating state

    // 🆕 Состояния для управления типом рейтинга
    const [ratingTypeLoading, setRatingTypeLoading] = useState(false);

    // Обновляем значения при изменении турнира
    useEffect(() => {
        console.log('🏁 Первичная инициализация данных турнира:', {
            tournamentDescription: tournament?.description,
            tournamentRules: tournament?.rules,
            tournamentId: tournament?.id,
            tournamentName: tournament?.name
        });
        setDescription(tournament?.description || '');
        setRegulations(tournament?.rules || '');
    }, [tournament?.description, tournament?.rules]);

    // 🔧 УПРОЩЕННАЯ СИНХРОНИЗАЦИЯ: только для случаев когда турнир полностью обновился
    useEffect(() => {
        if (tournament?.id && !isEditingDescription && !isEditingRegulations) {
            console.log('🔄 Полная синхронизация с обновленными данными турнира:', {
                tournamentId: tournament.id,
                tournamentRules: tournament?.rules,
                tournamentDescription: tournament?.description
            });
            setDescription(tournament?.description || '');
            setRegulations(tournament?.rules || '');
        }
    }, [tournament]);

    // 🆕 Проверка, является ли пользователь участником
    const isUserParticipant = () => {
        if (!user || !tournament?.participants) {
            console.log('🔍 isUserParticipant: нет пользователя или участников', {
                hasUser: !!user,
                hasParticipants: !!tournament?.participants,
                participantsLength: tournament?.participants?.length
            });
            return false;
        }
        
        // 🔧 УЛУЧШЕННАЯ ПРОВЕРКА: проверяем разные поля участников
        const isParticipating = tournament.participants.some(participant => {
            const isMatch = participant.user_id === user.id || 
                           participant.id === user.id ||
                           participant.participant_id === user.id; // Дополнительная проверка
            
            if (isMatch) {
                console.log('✅ Найден участник:', {
                    participantData: participant,
                    userId: user.id,
                    matchField: participant.user_id === user.id ? 'user_id' : 
                               participant.id === user.id ? 'id' : 'participant_id'
                });
            }
            
            return isMatch;
        });
        
        console.log('🔍 isUserParticipant результат:', {
            isParticipating,
            userId: user.id,
            username: user.username,
            tournamentId: tournament.id,
            participantsCount: tournament.participants.length,
            participants: tournament.participants.map(p => ({
                id: p.id,
                user_id: p.user_id,
                participant_id: p.participant_id,
                name: p.name,
                username: p.username
            }))
        });
        
        return isParticipating;
    };

    // 🆕 Проверка возможности участия
    const canParticipate = () => {
        console.log('🔍 canParticipate: начинаем проверку');
        
        if (!user) {
            console.log('❌ canParticipate: нет пользователя');
            return false;
        }
        
        if (!tournament) {
            console.log('❌ canParticipate: нет турнира');
            return false;
        }
        
        if (tournament.status !== 'active') {
            console.log('❌ canParticipate: турнир не активен:', tournament.status);
            return false;
        }
        
        const userIsParticipant = isUserParticipant();
        if (userIsParticipant) {
            console.log('❌ canParticipate: пользователь уже участвует');
            return false;
        }
        
        // Проверка лимита участников
        if (tournament.max_participants && tournament.participants?.length >= tournament.max_participants) {
            console.log('❌ canParticipate: достигнут лимит участников:', {
                max: tournament.max_participants,
                current: tournament.participants?.length
            });
            return false;
        }
        
        console.log('✅ canParticipate: участие разрешено', {
            hasUser: !!user,
            hasTournament: !!tournament,
            tournamentStatus: tournament.status,
            isParticipant: userIsParticipant,
            participantsCount: tournament.participants?.length,
            maxParticipants: tournament.max_participants
        });
        
        return true;
    };

    // 🆕 Получение команд пользователя для конкретной игры
    const getEligibleTeams = () => {
        if (!userTeams || !tournament?.game) return [];
        
        return userTeams.filter(team => {
            // Проверяем, что команда подходит по дисциплине
            return team.game === tournament.game || team.game === null; // null означает универсальную команду
        });
    };

    // 🆕 Обработчик нажатия на кнопку участия
    const handleParticipateClick = () => {
        if (!canParticipate()) return;

        const participantType = tournament.participant_type;

        if (participantType === 'team') {
            const eligibleTeams = getEligibleTeams();
            
            if (eligibleTeams.length === 0) {
                // Нет подходящих команд - предлагаем создать временную
                setShowTeamSelection(true);
            } else {
                // Есть команды - показываем выбор
                setShowTeamSelection(true);
            }
        } else {
            // Solo или Mix - сразу показываем подтверждение
            setShowParticipationConfirm(true);
        }
    };

    // 🆕 Подтверждение участия для Solo/Mix турниров
    const handleConfirmParticipation = async () => {
        setParticipationLoading(true);
        
        try {
            const token = localStorage.getItem('token');
            console.log('🚀 Отправляем запрос на участие:', {
                tournamentId: tournament.id,
                participantType: tournament.participant_type,
                userId: user?.id,
                username: user?.username
            });
            
            const response = await fetch(`/api/tournaments/${tournament.id}/participate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    participant_type: tournament.participant_type
                })
            });

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error('❌ Ошибка парсинга ответа от сервера:', parseError);
                data = { message: 'Ошибка обработки ответа сервера' };
            }

            console.log('📨 Ответ сервера:', {
                status: response.status,
                ok: response.ok,
                statusText: response.statusText,
                data: data
            });

            if (response.ok) {
                console.log('✅ Успешное участие в турнире');
                setShowParticipationConfirm(false);
                
                // 🔧 ПРИНУДИТЕЛЬНАЯ ОЧИСТКА КЕША для получения актуальных данных
                const cacheKey = `tournament_cache_${tournament.id}`;
                const cacheTimestampKey = `tournament_cache_timestamp_${tournament.id}`;
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimestampKey);
                console.log('🗑️ Кеш турнира очищен после успешного участия');
                
                if (onParticipationUpdate) {
                    onParticipationUpdate();
                }
            } else {
                // 🔧 УЛУЧШЕННАЯ ОБРАБОТКА ОШИБОК: показываем конкретную ошибку от backend
                const errorMessage = data?.error || data?.message || `Ошибка сервера (${response.status})`;
                console.error('❌ Ошибка от сервера:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorMessage: errorMessage,
                    fullData: data
                });
                
                // Закрываем модальное окно даже при ошибке
                setShowParticipationConfirm(false);
                
                // Показываем понятное сообщение пользователю
                alert(`❌ ${errorMessage}`);
            }
        } catch (error) {
            console.error('❌ Сетевая ошибка при участии в турнире:', error);
            setShowParticipationConfirm(false);
            alert(`❌ Сетевая ошибка: ${error.message}`);
        } finally {
            setParticipationLoading(false);
        }
    };

    // 🆕 Обработчик выбора команды для участия
    const handleTeamSelected = async (team) => {
        setSelectedTeam(team);
        setShowTeamSelection(false);
        setShowParticipationConfirm(true);
    };

    // 🆕 Подтверждение участия с командой
    const handleConfirmTeamParticipation = async () => {
        if (!selectedTeam) return;

        setParticipationLoading(true);
        
        try {
            const token = localStorage.getItem('token');
            console.log('🚀 Отправляем запрос на участие команды:', {
                tournamentId: tournament.id,
                teamId: selectedTeam.id,
                teamName: selectedTeam.name,
                userId: user?.id,
                username: user?.username
            });
            
            const response = await fetch(`/api/tournaments/${tournament.id}/participate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    teamId: selectedTeam.id
                })
            });

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error('❌ Ошибка парсинга ответа от сервера:', parseError);
                data = { message: 'Ошибка обработки ответа сервера' };
            }

            console.log('📨 Ответ сервера (команда):', {
                status: response.status,
                ok: response.ok,
                statusText: response.statusText,
                data: data
            });

            if (response.ok) {
                console.log('✅ Успешное участие команды в турнире');
                setShowParticipationConfirm(false);
                setSelectedTeam(null);
                
                // 🔧 ПРИНУДИТЕЛЬНАЯ ОЧИСТКА КЕША для получения актуальных данных
                const cacheKey = `tournament_cache_${tournament.id}`;
                const cacheTimestampKey = `tournament_cache_timestamp_${tournament.id}`;
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimestampKey);
                console.log('🗑️ Кеш турнира очищен после успешного участия команды');
                
                if (onParticipationUpdate) {
                    onParticipationUpdate();
                }
            } else {
                // 🔧 УЛУЧШЕННАЯ ОБРАБОТКА ОШИБОК: показываем конкретную ошибку от backend
                const errorMessage = data?.error || data?.message || `Ошибка сервера (${response.status})`;
                console.error('❌ Ошибка от сервера (команда):', {
                    status: response.status,
                    statusText: response.statusText,
                    errorMessage: errorMessage,
                    fullData: data
                });
                
                // Закрываем модальное окно и сбрасываем выбранную команду даже при ошибке
                setShowParticipationConfirm(false);
                setSelectedTeam(null);
                
                // Показываем понятное сообщение пользователю
                alert(`❌ ${errorMessage}`);
            }
        } catch (error) {
            console.error('❌ Сетевая ошибка при участии команды в турнире:', error);
            setShowParticipationConfirm(false);
            setSelectedTeam(null);
            alert(`❌ Сетевая ошибка: ${error.message}`);
        } finally {
            setParticipationLoading(false);
        }
    };

    // 🆕 Закрытие модальных окон
    const handleCloseModals = () => {
        setShowParticipationConfirm(false);
        setShowTeamSelection(false);
        setSelectedTeam(null);
    };

    // Функция для получения читаемого названия дисциплины
    const getGameDisplayName = (game) => {
        const gameNames = {
            'Counter-Strike 2': 'Counter-Strike 2',
            'Counter Strike 2': 'Counter-Strike 2',
            'cs2': 'Counter-Strike 2',
            'dota2': 'Dota 2',
            'Dota 2': 'Dota 2',
            'valorant': 'Valorant',
            'lol': 'League of Legends',
            'overwatch': 'Overwatch 2'
        };
        return gameNames[game] || game || 'Не указана';
    };

    // Функция для получения читаемого названия формата
    const getFormatDisplayName = (format) => {
        const formatNames = {
            'single_elimination': 'Single Elimination',
            'double_elimination': 'Double Elimination',
            'round_robin': 'Круговой турнир',
            'swiss': 'Швейцарская система',
            'mix': 'Микс-турнир'
        };
        return formatNames[format] || format || 'Не указан';
    };

    // 🆕 Функция для получения отображаемого имени типа участников
    const getParticipantTypeDisplayName = (participantType) => {
      const names = {
        'cs2_classic_5v5': 'Классический 5х5',
        'cs2_wingman_2v2': 'Wingman 2х2',
        'team': 'Командный',
        'solo': 'Одиночный'
      };
      return names[participantType] || participantType;
    };

    // 🆕 Функция для определения минимального размера команды
    const getMinTeamSize = (participantType) => {
      const minSizes = {
        'cs2_classic_5v5': 5,
        'cs2_wingman_2v2': 2,
        'team': 1,
        'solo': 1
      };
      return minSizes[participantType] || 1;
    };

    // 🆕 Функция для проверки является ли турнир командным (включая CS2)
    const isTeamTournament = (participantType) => {
      return ['team', 'cs2_classic_5v5', 'cs2_wingman_2v2'].includes(participantType);
    };

    // 🆕 Функция для получения читаемого статуса турнира
    const getStatusDisplayName = (status) => {
        const statusConfig = {
            // 🔧 ИСПРАВЛЕННЫЕ СТАТУСЫ - соответствуют backend API
            'active': { label: '🟢 Активный', class: 'status-active' },
            'in_progress': { label: '🟢 Идет', class: 'status-in-progress' },
            'in-progress': { label: '🟢 Идет', class: 'status-in-progress' }, // Альтернативное написание
            'completed': { label: '✅ Завершен', class: 'status-completed' },
            
            // 🔧 ДОПОЛНИТЕЛЬНЫЕ СТАТУСЫ (если будут добавлены в будущем)
            'upcoming': { label: '🔜 Предстоящий', class: 'status-upcoming' },
            'ongoing': { label: '🟢 Идет', class: 'status-ongoing' },
            'cancelled': { label: '❌ Отменен', class: 'status-cancelled' },
            'paused': { label: '⏸️ Приостановлен', class: 'status-paused' },
            'pending': { label: '⏳ Ожидание', class: 'status-pending' }
        };
        
        const result = statusConfig[status] || { label: `❓ ${status || 'Неизвестно'}`, class: 'status-unknown' };
        
        // 🔧 ОТЛАДОЧНАЯ ИНФОРМАЦИЯ
        console.log('🔍 getStatusDisplayName:', {
            inputStatus: status,
            inputType: typeof status,
            foundConfig: !!statusConfig[status],
            result: result
        });
        
        return result;
    };

    // Функция для форматирования даты
    const formatDate = (dateString) => {
        if (!dateString) return 'Не указана';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Некорректная дата';
        }
    };

    // Сохранение описания
    const handleSaveDescription = async () => {
        setIsLoading(true);
        console.log('📝 Начинаем сохранение описания:', {
            tournamentId: tournament.id,
            newDescription: description,
            currentTournamentDescription: tournament?.description
        });
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/tournaments/${tournament.id}/description`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: description
                })
            });

            const data = await response.json();

            if (response.ok) {
                console.log('✅ Описание успешно сохранено на сервере:', data);
                
                // 1. Выходим из режима редактирования
                setIsEditingDescription(false);
                
                // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Очищаем кеш турнира
                const cacheKey = `tournament_cache_${tournament.id}`;
                const cacheTimestampKey = `tournament_cache_timestamp_${tournament.id}`;
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimestampKey);
                console.log('🗑️ Кеш турнира очищен для получения актуальных данных');
                
                // 2. Обновляем данные турнира
                if (onParticipationUpdate) {
                    console.log('🔄 Вызываем onParticipationUpdate для обновления данных турнира');
                    await onParticipationUpdate();
                    console.log('✅ onParticipationUpdate завершен');
                } else {
                    console.warn('⚠️ onParticipationUpdate не предоставлен');
                }
                
                console.log('✅ Описание успешно сохранено и состояние обновлено');
            } else {
                throw new Error(data.message || 'Ошибка при сохранении описания');
            }
        } catch (error) {
            console.error('❌ Ошибка сохранения описания:', error);
            alert(`Ошибка сохранения описания: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Сохранение регламента
    const handleSaveRegulations = async () => {
        setIsLoading(true);
        console.log('📝 Начинаем сохранение регламента:', {
            tournamentId: tournament.id,
            newRegulations: regulations,
            currentTournamentRules: tournament?.rules
        });
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/tournaments/${tournament.id}/rules`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rules: regulations
                })
            });

            const data = await response.json();

            if (response.ok) {
                console.log('✅ Регламент успешно сохранен на сервере:', data);
                
                // 1. Выходим из режима редактирования
                setIsEditingRegulations(false);
                
                // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Очищаем кеш турнира
                const cacheKey = `tournament_cache_${tournament.id}`;
                const cacheTimestampKey = `tournament_cache_timestamp_${tournament.id}`;
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimestampKey);
                console.log('🗑️ Кеш турнира очищен для получения актуальных данных');
                
                // 2. Обновляем данные турнира
                if (onParticipationUpdate) {
                    console.log('🔄 Вызываем onParticipationUpdate для обновления данных турнира');
                    await onParticipationUpdate();
                    console.log('✅ onParticipationUpdate завершен');
                } else {
                    console.warn('⚠️ onParticipationUpdate не предоставлен');
                }
                
                console.log('✅ Регламент успешно сохранен и состояние обновлено');
            } else {
                throw new Error(data.message || 'Ошибка при сохранении регламента');
            }
        } catch (error) {
            console.error('❌ Ошибка сохранения регламента:', error);
            alert(`Ошибка сохранения регламента: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Отмена редактирования описания
    const handleCancelDescription = () => {
        setDescription(tournament?.description || '');
        setIsEditingDescription(false);
    };

    // Отмена редактирования регламента
    const handleCancelRegulations = () => {
        setRegulations(tournament?.rules || '');
        setIsEditingRegulations(false);
    };

    const handleParticipantClick = (participant) => {
        setSelectedParticipant(participant);
        setShowActions(true);
    };

    const handleOpenProfile = () => {
        if (selectedParticipant) {
            window.open(`/user/${selectedParticipant.id}`, '_blank');
            setShowActions(false);
            setSelectedParticipant(null);
        }
    };

    // 🆕 Получение информации о создателе турнира
    const getCreatorInfo = () => {
        if (tournament?.creator_username) {
            return {
                id: tournament.created_by,
                username: tournament.creator_username,
                avatar_url: tournament.creator_avatar_url
            };
        }
        return null;
    };

    // 🆕 Получение списка администраторов
    const getAdmins = () => {
        if (Array.isArray(tournament?.admins)) {
            return tournament.admins;
        }
        return [];
    };
    
    // 🆕 Функция для обрезки текста до указанного количества символов
    const truncateText = (text, maxLength = 400) => {
        if (!text || text.length <= maxLength) return text;
        
        // Находим последний пробел до максимальной длины
        const truncated = text.substring(0, maxLength);
        const lastSpaceIndex = truncated.lastIndexOf(' ');
        
        // Если нашли пробел, обрезаем до него, иначе просто по максимальной длине
        return lastSpaceIndex > 0 ? 
            truncated.substring(0, lastSpaceIndex) + '...' : 
            truncated + '...';
    };

    // 🆕 Функция для открытия полного регламента в новой вкладке
    const openFullRegulations = () => {
        if (!regulations) return;
        
        // Создаем HTML для полного регламента в стиле проекта
        const fullRegulationsHTML = `
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Регламент турнира - ${tournament?.name || 'Турнир'}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        background-color: #000000;
                        color: #ffffff;
                        line-height: 1.6;
                        min-height: 100vh;
                        padding: 40px 20px;
                    }
                    
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    
                    .header {
                        text-align: center;
                        margin-bottom: 40px;
                        padding-bottom: 20px;
                        border-bottom: 1px solid #333333;
                    }
                    
                    .header h1 {
                        font-size: 2rem;
                        font-weight: 300;
                        letter-spacing: -0.025em;
                        margin-bottom: 8px;
                        color: #ffffff;
                    }
                    
                    .header .tournament-name {
                        font-size: 1.125rem;
                        color: #e0e0e0;
                        font-weight: 400;
                    }
                    
                    .header .logo {
                        display: inline-block;
                        margin-right: 12px;
                        font-size: 2rem;
                        color: #ef4444;
                    }
                    
                    .content {
                        background: #111111;
                        border: 1px solid #2a2a2a;
                        border-radius: 8px;
                        padding: 32px;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    }
                    
                    .regulation-text {
                        white-space: pre-wrap;
                        font-size: 0.875rem;
                        line-height: 1.8;
                        color: #e0e0e0;
                    }
                    
                    .footer {
                        text-align: center;
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #333333;
                        color: #666666;
                        font-size: 0.75rem;
                    }
                    
                    .footer .accent {
                        color: #ef4444;
                        font-weight: 500;
                    }
                    
                    /* Прокрутка в стиле проекта */
                    ::-webkit-scrollbar {
                        width: 8px;
                    }
                    
                    ::-webkit-scrollbar-track {
                        background: #1a1a1a;
                    }
                    
                    ::-webkit-scrollbar-thumb {
                        background: #333333;
                        border-radius: 4px;
                    }
                    
                    ::-webkit-scrollbar-thumb:hover {
                        background: #555555;
                    }
                    
                    /* Адаптивность */
                    @media (max-width: 768px) {
                        body {
                            padding: 20px 16px;
                        }
                        
                        .header h1 {
                            font-size: 1.5rem;
                        }
                        
                        .content {
                            padding: 24px;
                        }
                        
                        .regulation-text {
                            font-size: 0.8rem;
                        }
                    }
                    
                    @media print {
                        body {
                            background-color: white;
                            color: black;
                        }
                        
                        .content {
                            background: white;
                            border: 1px solid #ddd;
                            box-shadow: none;
                        }
                        
                        .regulation-text {
                            color: black;
                        }
                        
                        .header .logo {
                            color: #333;
                        }
                        
                        .footer .accent {
                            color: #333;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>
                            <span class="logo">📋</span>
                            Регламент турнира
                        </h1>
                        <div class="tournament-name">${tournament?.name || 'Турнир'}</div>
                    </div>
                    
                    <div class="content">
                        <div class="regulation-text">${regulations.replace(/\n/g, '<br>')}</div>
                    </div>
                    
                    <div class="footer">
                        Создано в <span class="accent">1337 Community</span> Tournament System
                    </div>
                </div>
            </body>
            </html>
        `;
        
        // Открываем новое окно с полным регламентом
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write(fullRegulationsHTML);
            newWindow.document.close();
        }
    };

    // 🆕 Проверка, нужно ли сокращать регламент
    const shouldTruncateRegulations = (text) => {
        return text && text.length > 400;
    };

    // Обработка участия в турнире
    const handleParticipate = async () => {
        if (!user) {
            // Сохраняем контекст турнира для возврата после авторизации
            localStorage.setItem('returnToTournament', tournament.id);
            localStorage.setItem('tournamentAction', 'participate');
            
            // Перенаправляем на страницу входа/регистрации
            window.location.href = '/register?action=participate';
            return;
        }

        setIsParticipating(true);

        try {
            const participantType = tournament.participant_type;
            
            console.log('🎯 Попытка участия:', {
                tournamentId: tournament.id,
                participantType: participantType,
                userId: user.id
            });

            // Формируем данные запроса в зависимости от типа турнира
            let requestData = {
                participant_type: participantType
            };

            // 🆕 Для командных турниров (включая CS2) запрашиваем команду
            if (isTeamTournament(participantType)) {
                console.log('👥 Командный турнир, показываем диалог создания/выбора команды');
                
                // Для CS2 турниров показываем информацию о минимальных требованиях
                const minTeamSize = getMinTeamSize(participantType);
                const typeName = getParticipantTypeDisplayName(participantType);
                
                const teamChoice = prompt(
                    `${typeName} турнир требует команду минимум ${minTeamSize} игроков.\n\n` +
                    `Введите название новой команды или оставьте пустым для выбора существующей:`
                );
                
                if (teamChoice === null) {
                    // Пользователь отменил
                    setIsParticipating(false);
                    return;
                }
                
                if (teamChoice.trim()) {
                    requestData.newTeamName = teamChoice.trim();
                } else {
                    // Здесь можно показать модальное окно выбора существующей команды
                    alert('Выбор существующей команды пока не реализован. Создайте новую команду.');
                    setIsParticipating(false);
                    return;
                }
            }

            console.log('📤 Отправляем запрос на участие:', requestData);

            const response = await axios.post(
                `/api/tournaments/${tournament.id}/participate`,
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }
            );

            console.log('✅ Успешное участие:', response.data);
            
            // Уведомляем родительский компонент
            if (onParticipationUpdate) {
                onParticipationUpdate();
            }

        } catch (error) {
            console.error('❌ Ошибка участия в турнире:', error);
            
            const errorMessage = error.response?.data?.error || 
                               error.response?.data?.message || 
                               'Произошла ошибка при регистрации в турнире';
            
            alert(errorMessage);
        } finally {
            setIsParticipating(false);
        }
    };

    // 🆕 Функция для изменения типа рейтинга турнира
    const handleRatingTypeChange = async (newRatingType) => {
        if (!tournament?.id || !isAdminOrCreator) {
            console.log('❌ Нет прав для изменения типа рейтинга');
            return;
        }

        if (tournament.mix_rating_type === newRatingType) {
            console.log('ℹ️ Тип рейтинга уже установлен:', newRatingType);
            return;
        }

        setRatingTypeLoading(true);
        console.log('🔄 Изменяем тип рейтинга турнира:', {
            tournamentId: tournament.id,
            oldType: tournament.mix_rating_type,
            newType: newRatingType
        });

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/tournaments/${tournament.id}/rating-type`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mix_rating_type: newRatingType
                })
            });

            const data = await response.json();

            if (response.ok) {
                console.log('✅ Тип рейтинга успешно изменен:', data);
                
                // Очищаем кеш турнира
                const cacheKey = `tournament_cache_${tournament.id}`;
                const cacheTimestampKey = `tournament_cache_timestamp_${tournament.id}`;
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimestampKey);
                console.log('🗑️ Кеш турнира очищен после смены типа рейтинга');
                
                // Обновляем данные турнира
                if (onParticipationUpdate) {
                    await onParticipationUpdate();
                }

                // Уведомляем об успешной смене
                const typeNames = {
                    'faceit': 'FACEIT ELO',
                    'premier': 'CS2 Premier Rank',
                    'mixed': 'Случайный микс'
                };
                
                alert(`✅ Тип рейтинга изменен на: ${typeNames[newRatingType] || newRatingType}`);
            } else {
                throw new Error(data.message || 'Ошибка при изменении типа рейтинга');
            }
        } catch (error) {
            console.error('❌ Ошибка изменения типа рейтинга:', error);
            alert(`❌ Ошибка: ${error.message}`);
        } finally {
            setRatingTypeLoading(false);
        }
    };

    // 🆕 Проверка, можно ли изменять тип рейтинга
    const canChangeRatingType = () => {
        return tournament?.format === 'mix' && 
               tournament?.status === 'active' && 
               isAdminOrCreator &&
               !tournament?.teams?.length; // Если команды еще не сформированы
    };

    // 🆕 Получение отображаемого названия типа рейтинга
    const getRatingTypeDisplayName = (ratingType) => {
        const names = {
            'faceit': 'FACEIT ELO',
            'premier': 'CS2 Premier Rank',
            'mixed': 'Случайный микс'
        };
        return names[ratingType] || ratingType || 'Не указан';
    };

    const creatorInfo = getCreatorInfo();
    const adminsList = getAdmins();
    const statusInfo = getStatusDisplayName(tournament?.status);

    return (
        <div className="tournament-info-section">
            <div className="section-header">
                <h2>📋 Информация о турнире</h2>
            </div>

            {/* Основная информация о турнире */}
            <div className="tournament-meta-grid">
                <div className="meta-row">
                    <div className="meta-item">
                        <strong>🎮 Дисциплина:</strong>
                        <span>{getGameDisplayName(tournament?.game)}</span>
                    </div>
                    
                    <div className="meta-item">
                        <strong>🏆 Формат турнира:</strong>
                        <span>{getFormatDisplayName(tournament?.format)}</span>
                    </div>
                </div>

                <div className="meta-row">
                    <div className="meta-item">
                        <strong>👥 Тип участия:</strong>
                        <span>{getParticipantTypeDisplayName(tournament?.participant_type)}</span>
                    </div>
                    
                    <div className="meta-item">
                        <strong>📊 Участников:</strong>
                        <span>
                            {tournament?.participants?.length || 0}
                            {tournament?.max_participants && ` / ${tournament.max_participants}`}
                        </span>
                    </div>
                </div>

                {/* 🆕 Блок с размером команды для командных и микс турниров */}
                {(isTeamTournament(tournament?.participant_type) || tournament?.format === 'mix') && tournament?.team_size && (
                    <div className="meta-row">
                        <div className="meta-item">
                            <strong>👨‍👩‍👧‍👦 Игроков в команде:</strong>
                            <span>{tournament.team_size}</span>
                        </div>
                        
                        {/* 🆕 Дополнительная информация для микс турниров */}
                        {tournament?.format === 'mix' && (
                            <div className="meta-item">
                                <strong>🎲 Тип микса:</strong>
                                <span>
                                    {tournament.mix_rating_type === 'faceit' && 'По FACEIT ELO'}
                                    {tournament.mix_rating_type === 'premier' && 'По CS2 Premier Rank'}
                                    {(!tournament.mix_rating_type || tournament.mix_rating_type === 'mixed') && 'Случайный микс'}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* 🆕 Блок управления типом рейтинга для микс-турниров */}
                {canChangeRatingType() && (
                    <div className="meta-row">
                        <div className="meta-item rating-type-control">
                            <strong>⚙️ Управление типом рейтинга:</strong>
                            <div className="rating-type-selector">
                                <div className="rating-type-info">
                                    <span className="current-type">
                                        Текущий: {getRatingTypeDisplayName(tournament.mix_rating_type)}
                                    </span>
                                </div>
                                <div className="rating-type-buttons">
                                    <button 
                                        className={`rating-type-btn ${tournament.mix_rating_type === 'faceit' ? 'active' : ''}`}
                                        onClick={() => handleRatingTypeChange('faceit')}
                                        disabled={ratingTypeLoading || tournament.mix_rating_type === 'faceit'}
                                        title="Формировать команды по FACEIT ELO рейтингу"
                                    >
                                        {ratingTypeLoading && tournament.mix_rating_type !== 'faceit' ? (
                                            <span className="loading-spinner-small"></span>
                                        ) : (
                                            '🎯'
                                        )}
                                        FACEIT ELO
                                    </button>
                                    <button 
                                        className={`rating-type-btn ${tournament.mix_rating_type === 'premier' ? 'active' : ''}`}
                                        onClick={() => handleRatingTypeChange('premier')}
                                        disabled={ratingTypeLoading || tournament.mix_rating_type === 'premier'}
                                        title="Формировать команды по CS2 Premier рангу"
                                    >
                                        {ratingTypeLoading && tournament.mix_rating_type !== 'premier' ? (
                                            <span className="loading-spinner-small"></span>
                                        ) : (
                                            '🏆'
                                        )}
                                        CS2 Premier
                                    </button>
                                    <button 
                                        className={`rating-type-btn ${(!tournament.mix_rating_type || tournament.mix_rating_type === 'mixed') ? 'active' : ''}`}
                                        onClick={() => handleRatingTypeChange('mixed')}
                                        disabled={ratingTypeLoading || (!tournament.mix_rating_type || tournament.mix_rating_type === 'mixed')}
                                        title="Случайное формирование команд"
                                    >
                                        {ratingTypeLoading && tournament.mix_rating_type !== 'mixed' ? (
                                            <span className="loading-spinner-small"></span>
                                        ) : (
                                            '🎲'
                                        )}
                                        Случайный
                                    </button>
                                </div>
                                {ratingTypeLoading && (
                                    <div className="rating-type-loading">
                                        <span className="loading-text">Изменяем тип рейтинга...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="meta-row">
                    <div className="meta-item">
                        <strong>📅 Дата создания:</strong>
                        <span>{formatDate(tournament?.created_at)}</span>
                    </div>
                    
                    <div className="meta-item">
                        <strong>🚀 Дата старта:</strong>
                        <span>{formatDate(tournament?.start_date) || 'Не назначена'}</span>
                    </div>
                </div>

                <div className="meta-row">
                    <div className="meta-item">
                        <strong>⚡ Статус:</strong>
                        <span className={`status-badge ${statusInfo.class}`}>
                            {statusInfo.label}
                        </span>
                    </div>

                    {tournament?.prize_pool && (
                        <div className="meta-item">
                            <strong>💰 Призовой фонд:</strong>
                            <span>{tournament.prize_pool}</span>
                        </div>
                    )}
                </div>

                {/* 🆕 Кнопка участия в турнире */}
                {(() => {
                    const canParticipateResult = canParticipate();
                    const isParticipantResult = isUserParticipant();
                    
                    console.log('🎯 Рендеринг блока участия:', {
                        canParticipate: canParticipateResult,
                        isUserParticipant: isParticipantResult,
                        userId: user?.id,
                        username: user?.username,
                        tournamentId: tournament?.id,
                        tournamentStatus: tournament?.status,
                        participantsCount: tournament?.participants?.length
                    });
                    
                    return canParticipateResult ? (
                        <div className="meta-row">
                            <div className="meta-item participation-section">
                                <strong>🎯 Участие в турнире:</strong>
                                <div className="participation-controls">
                                    <button 
                                        className="participate-btn"
                                        onClick={handleParticipateClick}
                                        disabled={participationLoading}
                                    >
                                        {participationLoading ? (
                                            <>
                                                <span className="loading-spinner"></span>
                                                Участвую...
                                            </>
                                        ) : (
                                            <>
                                                🚀 Участвовать в турнире
                                            </>
                                        )}
                                    </button>
                                    
                                    {tournament.participant_type === 'team' && (
                                        <div className="participation-hint">
                                            <span className="hint-icon">💡</span>
                                            <span>Для участия потребуется выбрать команду</span>
                                        </div>
                                    )}
                                    
                                    {tournament.participant_type === 'mix' && (
                                        <div className="participation-hint">
                                            <span className="hint-icon">🎲</span>
                                            <span>Команды будут сформированы автоматически</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : null;
                })()}

                {/* Отображение статуса участия для уже участвующих */}
                {(() => {
                    const isParticipantResult = isUserParticipant();
                    
                    console.log('✅ Рендеринг статуса участия:', {
                        isUserParticipant: isParticipantResult,
                        shouldShowStatus: isParticipantResult,
                        userId: user?.id,
                        username: user?.username
                    });
                    
                    return isParticipantResult ? (
                        <div className="meta-row">
                            <div className="meta-item participation-status">
                                <strong>✅ Ваш статус:</strong>
                                <span className="participant-status-badge">
                                    🎯 Вы участвуете в турнире
                                </span>
                            </div>
                        </div>
                    ) : null;
                })()}

                {/* 🆕 Блок с создателем и администраторами */}
                <div className="meta-row">
                    <div className="meta-item creator-meta">
                        <strong>👤 Создатель турнира:</strong>
                        <div className="creator-display">
                            <div className="creator-avatar">
                                {creatorInfo?.avatar_url ? (
                                    <img 
                                        src={ensureHttps(creatorInfo.avatar_url)} 
                                        alt={creatorInfo.username}
                                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                    />
                                ) : (
                                    <div className="avatar-placeholder">
                                        {(creatorInfo?.username || 'U')[0].toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="creator-info">
                                {creatorInfo ? (
                                    <a 
                                        href={`/user/${creatorInfo.id}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="creator-link"
                                    >
                                        {creatorInfo.username}
                                    </a>
                                ) : (
                                    <span className="creator-name">Неизвестный создатель</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 🆕 Администраторы турнира */}
                    {adminsList.length > 0 && (
                        <div className="meta-item admins-meta">
                            <strong>👑 Администраторы ({adminsList.length}):</strong>
                            <div className="admins-list">
                                {adminsList.slice(0, 3).map((admin, index) => (
                                    <div key={admin.id || index} className="admin-item">
                                        <div className="admin-avatar">
                                            {admin.avatar_url ? (
                                                <img 
                                                    src={ensureHttps(admin.avatar_url)} 
                                                    alt={admin.username}
                                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                                />
                                            ) : (
                                                <div className="avatar-placeholder admin-placeholder">
                                                    {(admin.username || 'A')[0].toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="admin-info">
                                            <a 
                                                href={`/user/${admin.user_id || admin.id}`}
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="admin-link"
                                                title={`Администратор с ${formatDate(admin.assigned_at)}`}
                                            >
                                                {admin.username}
                                            </a>
                                        </div>
                                    </div>
                                ))}
                                {adminsList.length > 3 && (
                                    <div className="more-admins">
                                        +{adminsList.length - 3} еще
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Блок описания */}
            <div className="description-block">
                <div className="block-header">
                    <h3>📝 Описание турнира</h3>
                    {isAdminOrCreator && !isEditingDescription && (
                        <div className="edit-controls">
                            <button 
                                className="edit-btn"
                                onClick={() => setIsEditingDescription(true)}
                                disabled={isLoading}
                            >
                                ✏️ Редактировать
                            </button>
                        </div>
                    )}
                    {isEditingDescription && (
                        <div className="edit-actions">
                            <button 
                                className="save-btn"
                                onClick={handleSaveDescription}
                                disabled={isLoading}
                            >
                                💾 Сохранить
                            </button>
                            <button 
                                className="cancel-btn"
                                onClick={handleCancelDescription}
                                disabled={isLoading}
                            >
                                ❌ Отмена
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="tournament-description-content">
                    {isEditingDescription ? (
                        <textarea
                            className="description-editor"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Введите описание турнира..."
                            disabled={isLoading}
                        />
                    ) : (
                        <>
                            {description ? (
                                <div className="tournament-description">
                                    {description.split('\n').map((line, index) => (
                                        <p key={index}>{line}</p>
                                    ))}
                                </div>
                            ) : (
                                <div className="no-description">
                                    {isAdminOrCreator ? (
                                        <p>Описание турнира не добавлено. Нажмите "Редактировать" для добавления.</p>
                                    ) : (
                                        <p>Описание турнира не предоставлено.</p>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Блок регламента */}
            <div className="rules-block">
                <div className="block-header">
                    <h3>📋 Регламент турнира</h3>
                    {isAdminOrCreator && !isEditingRegulations && (
                        <div className="edit-controls">
                            <button 
                                className="edit-btn"
                                onClick={() => setIsEditingRegulations(true)}
                                disabled={isLoading}
                            >
                                ✏️ Редактировать
                            </button>
                        </div>
                    )}
                    {isEditingRegulations && (
                        <div className="edit-actions">
                            <button 
                                className="save-btn"
                                onClick={handleSaveRegulations}
                                disabled={isLoading}
                            >
                                💾 Сохранить
                            </button>
                            <button 
                                className="cancel-btn"
                                onClick={handleCancelRegulations}
                                disabled={isLoading}
                            >
                                ❌ Отмена
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="tournament-rules-content">
                    {isEditingRegulations ? (
                        <textarea
                            className="rules-editor"
                            value={regulations}
                            onChange={(e) => setRegulations(e.target.value)}
                            placeholder="Введите регламент турнира..."
                            disabled={isLoading}
                        />
                    ) : (
                        <>
                            {regulations ? (
                                <div className="rules-text">
                                    {/* 🆕 Сокращенное отображение регламента с тултипом */}
                                    {shouldTruncateRegulations(regulations) ? (
                                        <div className="rules-container">
                                            {/* Сокращенный текст */}
                                            <div 
                                                className="rules-truncated"
                                                onMouseEnter={() => setShowRegulationsTooltip(true)}
                                                onMouseLeave={() => setShowRegulationsTooltip(false)}
                                                style={{ position: 'relative' }}
                                            >
                                                {truncateText(regulations).split('\n').map((line, index) => (
                                                    <div key={index} className="rule-item">{line}</div>
                                                ))}
                                                
                                                {/* Тултип для показа полного регламента */}
                                                {showRegulationsTooltip && (
                                                    <div className="regulations-tooltip">
                                                        <div className="tooltip-content">
                                                            <p>📋 Показать полный регламент</p>
                                                            <button 
                                                                className="tooltip-link"
                                                                onClick={openFullRegulations}
                                                                title="Открыть полный регламент в новой вкладке"
                                                            >
                                                                🔗 Открыть в новой вкладке
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        // Полный текст, если он короткий
                                        <div>
                                            {regulations.split('\n').map((line, index) => (
                                                <div key={index} className="rule-item">{line}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="default-rules">
                                    {isAdminOrCreator ? (
                                        <div 
                                            className="no-rules-admin"
                                            onClick={() => setIsEditingRegulations(true)}
                                        >
                                            <p>Регламент турнира не добавлен. Нажмите здесь для добавления.</p>
                                        </div>
                                    ) : (
                                        <div className="rule-section">
                                            <h4>🎯 Общие правила</h4>
                                            <ul>
                                                <li>Соблюдение правил Fair Play</li>
                                                <li>Запрет на использование читов и эксплойтов</li>
                                                <li>Уважительное отношение к соперникам</li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Участники турнира - скрываем для микс-турниров с сформированными командами */}
            {!(tournament?.format === 'mix' && tournament?.teams && tournament?.teams.length > 0) && (
                <div className="participants-section">
                    <h3>👥 Участники турнира</h3>
                    <div className="participants-list">
                        {tournament?.participants?.map(participant => (
                            <div 
                                key={participant.id} 
                                className="participant-item"
                                onClick={() => handleParticipantClick(participant)}
                            >
                                <img 
                                    src={ensureHttps(participant.avatar_url) || '/default-avatar.png'} 
                                    alt={participant.username || participant.name || 'Участник'}
                                    className="participant-avatar"
                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                />
                                <span className="participant-name">
                                    {participant.username || participant.name || 'Участник'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {showActions && selectedParticipant && (
                        <div className="participant-actions-modal" onClick={() => setShowActions(false)}>
                            <div className="actions-content" onClick={(e) => e.stopPropagation()}>
                                <h4>Действия с участником</h4>
                                <button 
                                    className="action-button profile-button"
                                    onClick={handleOpenProfile}
                                >
                                    👤 Открыть профиль
                                </button>
                                {isAdminOrCreator && (
                                    <button 
                                        className="action-button remove-button"
                                        onClick={() => {
                                            // TODO: Добавить функцию удаления участника
                                            console.log('Удаление участника:', selectedParticipant);
                                            setShowActions(false);
                                        }}
                                    >
                                        🗑️ Удалить из турнира
                                    </button>
                                )}
                                <button 
                                    className="action-button cancel-button"
                                    onClick={() => setShowActions(false)}
                                >
                                    ❌ Отмена
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 🆕 Модальные окна */}
            {/* Модальное окно подтверждения участия */}
            <ParticipationConfirmModal
                isOpen={showParticipationConfirm}
                onClose={handleCloseModals}
                onConfirm={selectedTeam ? handleConfirmTeamParticipation : handleConfirmParticipation}
                tournament={tournament}
                isLoading={participationLoading}
                participationType={tournament?.participant_type}
            />

            {/* Модальное окно выбора команды */}
            {showTeamSelection && (
                <TeamSelectionModal
                    onClose={handleCloseModals}
                    onTeamSelected={handleTeamSelected}
                    tournamentId={tournament?.id}
                    user={user}
                />
            )}

            {/* Убираем LoginModal полностью */}
        </div>
    );
};

export default TournamentInfoSection; 