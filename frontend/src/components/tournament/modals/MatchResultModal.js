import React, { useState, useEffect, useCallback } from 'react';
import { isCounterStrike2, getDefaultCS2Maps } from '../../../utils/mapHelpers';
import { useMatchResultModal } from '../../../hooks/useModalSystem';
import '../../../styles/modal-system.css';
import './MatchResultModal.css';

/**
 * MatchResultModal v5.0 - Унифицированная модальная система
 * Создано опытным UI/UX разработчиком
 * Использует единую дизайн-систему модальных окон
 * 
 * @version 5.0 (Использует modal-system + сохранена вся функциональность)
 * @features Выбор победителя, тултипы команд, расширенная статистика, валидация, карты CS2
 */
const MatchResultModal = ({
    isOpen,
    onClose,
    selectedMatch,        
    matchResultData,      
    setMatchResultData,   
    onSave,
    isLoading = false,
    tournament = null     
}) => {
    const [availableMaps, setAvailableMaps] = useState([]);
    const [validationErrors, setValidationErrors] = useState({});
    const [hasChanges, setHasChanges] = useState(false);
    const [selectedWinner, setSelectedWinner] = useState(null); // null, 'team1', 'team2'
    const [autoCalculateScore, setAutoCalculateScore] = useState(true); // 🆕 Автоматический расчет
    
    // СОСТОЯНИЯ ДЛЯ ТУЛТИПОВ
    const [showTeam1Tooltip, setShowTeam1Tooltip] = useState(false);
    const [showTeam2Tooltip, setShowTeam2Tooltip] = useState(false);

    // Используем унифицированный хук модальной системы
    const modalSystem = useMatchResultModal({
        onClose: () => {
            if (hasChanges && !isLoading) {
                const confirmed = window.confirm(
                    'У вас есть несохраненные изменения. Закрыть без сохранения?'
                );
                if (!confirmed) return;
            }
            setShowTeam1Tooltip(false);
            setShowTeam2Tooltip(false);
            setSelectedWinner(null);
            setHasChanges(false);
            onClose();
        }
    });

    // УЛУЧШЕННОЕ: Определение игры турнира
    const getTournamentGame = useCallback(() => {
        console.log('Определяем игру турнира для карт...');
        
        // Приоритет 1: Прямо переданный турнир
        if (tournament?.game) {
            console.log('✅ Игра определена из пропса tournament:', tournament.game);
            return tournament.game;
        }
        
        // Приоритет 2: Турнир из localStorage
        try {
            const tournamentData = localStorage.getItem('currentTournament');
            if (tournamentData) {
                const parsedTournament = JSON.parse(tournamentData);
                if (parsedTournament.game) {
                    console.log('✅ Игра определена из localStorage:', parsedTournament.game);
                    return parsedTournament.game;
                }
            }
        } catch (error) {
            console.warn('Ошибка получения турнира из localStorage:', error);
        }
        
        // Приоритет 3: Проверка данных матча
        if (selectedMatch?.maps_data || selectedMatch?.game === 'Counter-Strike 2') {
            console.log('✅ Игра определена из данных матча: Counter-Strike 2');
            return 'Counter-Strike 2';
        }
        
        // Приоритет 4: Проверка URL
        try {
            const pathMatch = window.location.pathname.match(/\/tournaments\/(\d+)/);
            if (pathMatch) {
                console.log('Определяем игру по URL для турнира:', pathMatch[1]);
                // Для демонстрации считаем CS2 по умолчанию
                console.log('Принимаем Counter-Strike 2 как игру по умолчанию');
                return 'Counter-Strike 2';
            }
        } catch (error) {
            console.warn('Ошибка определения игры по URL:', error);
        }
        
        console.log('❌ Не удалось определить игру турнира');
        return null;
    }, [tournament, selectedMatch]);

    // 🎯 ИНИЦИАЛИЗАЦИЯ WINNER ИЗ ДАННЫХ МАТЧА
    useEffect(() => {
        if (selectedMatch && matchResultData) {
            const winnerId = selectedMatch.winner_team_id || selectedMatch.winner_id;
            if (winnerId) {
                if (winnerId === selectedMatch.team1_id) {
                    setSelectedWinner('team1');
                } else if (winnerId === selectedMatch.team2_id) {
                    setSelectedWinner('team2');
                } else {
                    setSelectedWinner(null);
                }
            } else {
                // Автоопределение победителя по счету
                const score1 = parseInt(matchResultData.score1) || 0;
                const score2 = parseInt(matchResultData.score2) || 0;
                if (score1 > score2) {
                    setSelectedWinner('team1');
                } else if (score2 > score1) {
                    setSelectedWinner('team2');
                } else {
                    setSelectedWinner(null);
                }
            }
        }
    }, [selectedMatch, matchResultData]);

    // 🎯 ИСПРАВЛЕННАЯ ЗАГРУЗКА ДОСТУПНЫХ КАРТ
    useEffect(() => {
        const gameType = getTournamentGame();
        console.log('🗺️ Загружаем карты для игры:', gameType);
        
        if (gameType && isCounterStrike2(gameType)) {
            // Получаем карты через хелпер или стандартные карты
            const maps = getDefaultCS2Maps();
            setAvailableMaps(maps);
            console.log('🗺️ Загружены карты для игры:', gameType, '- карт:', maps.length, 'список:', maps);
        } else if (gameType) {
            // Для других игр - попробуем получить с сервера или используем пустой массив
            console.log('🗺️ Игра', gameType, 'пока не поддерживается, устанавливаем пустой массив карт');
            setAvailableMaps([]);
        } else {
            console.log('🗺️ Игра не определена, карты недоступны');
            setAvailableMaps([]);
        }
    }, [getTournamentGame]);

    // 🎯 ОТСЛЕЖИВАНИЕ ИЗМЕНЕНИЙ
    useEffect(() => {
        if (matchResultData && selectedMatch) {
            const hasScoreChanges = 
                matchResultData.score1 !== (selectedMatch.score1 || 0) ||
                matchResultData.score2 !== (selectedMatch.score2 || 0);
            
            const hasMapsChanges = 
                JSON.stringify(matchResultData.maps_data || []) !== 
                JSON.stringify(selectedMatch.maps_data || []);
            
            const hasWinnerChanges = selectedWinner !== null;
            
            setHasChanges(hasScoreChanges || hasMapsChanges || hasWinnerChanges);
        }
    }, [matchResultData, selectedMatch, selectedWinner]);

    // 🎯 УЛУЧШЕННАЯ ВАЛИДАЦИЯ (разрешены отрицательные счета)
    const validateResults = useCallback(() => {
        const errors = {};
        
        if (!matchResultData) {
            errors.general = 'Отсутствуют данные матча';
            return errors;
        }

        const score1 = parseInt(matchResultData.score1) || 0;
        const score2 = parseInt(matchResultData.score2) || 0;
        
        // Убираем ограничение на отрицательные счета
        if (score1 === 0 && score2 === 0 && !selectedWinner) {
            errors.scores = 'Укажите счет матча или выберите победителя';
        }

        // Валидация карт для CS2
        const isCS2 = isCounterStrike2(getTournamentGame());
        if (isCS2 && matchResultData.maps_data && matchResultData.maps_data.length > 0) {
            matchResultData.maps_data.forEach((mapData, index) => {
                if (!mapData.map || mapData.map.trim() === '') {
                    errors[`map_${index}_name`] = `Выберите название для карты ${index + 1}`;
                }
            });
        }

        return errors;
    }, [matchResultData, selectedWinner, getTournamentGame]);

    // 🎯 ОБНОВЛЕНИЕ ВАЛИДАЦИИ
    useEffect(() => {
        if (matchResultData) {
            const errors = validateResults();
            setValidationErrors(errors);
        }
    }, [matchResultData, validateResults]);

    // 🎯 ФУНКЦИЯ ВЫБОРА ПОБЕДИТЕЛЯ
    const selectWinner = useCallback((team) => {
        console.log('🏆 Выбран победитель вручную:', {
            selectedTeam: team,
            previousWinner: selectedWinner,
            team1Name: selectedMatch?.team1_name || 'Команда 1',
            team2Name: selectedMatch?.team2_name || 'Команда 2',
            currentScore: `${matchResultData.score1}:${matchResultData.score2}`
        });
        
        setSelectedWinner(team);
        
        // Автоматически обновляем счет, если нужно
        if (team === 'team1' && parseInt(matchResultData.score1 || 0) <= parseInt(matchResultData.score2 || 0)) {
            const newScore = Math.max(1, parseInt(matchResultData.score2 || 0) + 1);
            console.log(`🎯 Автоматически увеличиваем счет команды 1 до ${newScore}`);
            setMatchResultData(prev => ({
                ...prev,
                score1: newScore
            }));
        } else if (team === 'team2' && parseInt(matchResultData.score2 || 0) <= parseInt(matchResultData.score1 || 0)) {
            const newScore = Math.max(1, parseInt(matchResultData.score1 || 0) + 1);
            console.log(`🎯 Автоматически увеличиваем счет команды 2 до ${newScore}`);
            setMatchResultData(prev => ({
                ...prev,
                score2: newScore
            }));
        }
        
        // Временно отключаем автоматический расчет при ручном выборе
        if (autoCalculateScore) {
            console.log('⚠️ Внимание: При ручном выборе победителя автоматический расчет может конфликтовать');
        }
    }, [matchResultData, setMatchResultData, selectedWinner, selectedMatch, autoCalculateScore]);

    // 🎯 РАСЧЕТ СТАТИСТИКИ ПО КАРТАМ
    const getMapStatistics = useCallback(() => {
        const mapsData = matchResultData.maps_data || [];
        if (mapsData.length === 0) return null;
        
        let team1Wins = 0;
        let team2Wins = 0;
        let team1TotalScore = 0;
        let team2TotalScore = 0;
        let draws = 0;
        
        mapsData.forEach(map => {
            const score1 = parseInt(map.score1) || 0;
            const score2 = parseInt(map.score2) || 0;
            
            team1TotalScore += score1;
            team2TotalScore += score2;
            
            if (score1 > score2) {
                team1Wins++;
            } else if (score2 > score1) {
                team2Wins++;
            } else {
                draws++;
            }
        });
        
        return {
            mapsCount: mapsData.length,
            team1Wins,
            team2Wins,
            draws,
            team1TotalScore,
            team2TotalScore,
            scoreDifference: Math.abs(team1TotalScore - team2TotalScore)
        };
    }, [matchResultData.maps_data]);

    // 🎯 АВТОМАТИЧЕСКИЙ РАСЧЕТ ОБЩЕГО СЧЕТА ПО КАРТАМ
    const calculateOverallScoreFromMaps = useCallback(() => {
        const mapsData = matchResultData.maps_data || [];
        if (mapsData.length === 0) return;
        
        let team1Wins = 0;
        let team2Wins = 0;
        
        mapsData.forEach(map => {
            const score1 = parseInt(map.score1) || 0;
            const score2 = parseInt(map.score2) || 0;
            
            if (score1 > score2) {
                team1Wins++;
            } else if (score2 > score1) {
                team2Wins++;
            }
            // Ничьи не засчитываются в общий счет
        });
        
        // Обновляем общий счет матча
        setMatchResultData(prev => ({
            ...prev,
            score1: team1Wins,
            score2: team2Wins
        }));
        
        // 🔧 ИСПРАВЛЕНО: Улучшенное автоматическое определение победителя
        // 🏆 ПРИОРИТЕТНЫЙ КРИТЕРИЙ: Количество выигранных карт важнее общего счета
        let newWinner = null;
        if (team1Wins > team2Wins) {
            newWinner = 'team1';
        } else if (team2Wins > team1Wins) {
            newWinner = 'team2';
        }
        // Если равный счет - оставляем null (ничья)
        
        // Обновляем победителя только если он изменился
        if (newWinner !== selectedWinner) {
            console.log('🏆 Автоматически обновляем победителя (ПРИОРИТЕТ: карты):', {
                previousWinner: selectedWinner,
                newWinner: newWinner,
                reason: 'calculateOverallScoreFromMaps - карты имеют приоритет'
            });
            setSelectedWinner(newWinner);
        }
        
        console.log('📊 Автоматический расчет счета:', {
            mapsPlayed: mapsData.length,
            team1Wins,
            team2Wins,
            previousWinner: selectedWinner,
            newWinner: newWinner,
            team1Name: selectedMatch?.team1_name || 'Команда 1',
            team2Name: selectedMatch?.team2_name || 'Команда 2'
        });
    }, [matchResultData.maps_data, setMatchResultData, selectedWinner, selectedMatch]);

    // 🎯 ОТСЛЕЖИВАНИЕ ИЗМЕНЕНИЙ РЕЗУЛЬТАТОВ ПО КАРТАМ
    useEffect(() => {
        // Автоматически пересчитываем общий счет когда изменяются результаты по картам
        if (!autoCalculateScore) return; // Пропускаем если автоматический расчет отключен
        
        const mapsData = matchResultData.maps_data || [];
        
        // Проверяем, есть ли карты с результатами
        const hasMapResults = mapsData.some(map => 
            (parseInt(map.score1) || 0) !== 0 || (parseInt(map.score2) || 0) !== 0
        );
        
        if (hasMapResults && mapsData.length > 0) {
            calculateOverallScoreFromMaps();
        }
    }, [matchResultData.maps_data, calculateOverallScoreFromMaps, autoCalculateScore]);

    // 🎯 ТУЛТИП С СОСТАВОМ КОМАНДЫ (ОБНОВЛЕННЫЙ ДЛЯ МОДАЛЬНОЙ СИСТЕМЫ)
    const TeamTooltip = ({ team, composition, show }) => {
        if (!show || !composition) return null;

        return (
            <div className="modal-system-tooltip modal-system-tooltip-bottom">
                <div className="modal-system-section">
                    <h5 className="modal-system-bold modal-system-text-center modal-system-mb-10">
                        {composition.name}
                    </h5>
                    <div className="modal-system-list">
                        {composition.members.map((member, index) => (
                            <div key={index} className="modal-system-list-item">
                                <span className="modal-system-bold">{member.name}</span>
                                {member.rating && (
                                    <span className="modal-system-badge modal-system-badge-success">
                                        ({member.rating})
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    if (!isOpen || !selectedMatch) return null;

    // 🎯 ОБРАБОТЧИКИ СОБЫТИЙ
    const handleScoreChange = (team, value) => {
        const score = parseInt(value) || 0; // Убираем ограничение Math.max(0, ...)
        const scoreField = team === 1 ? 'score1' : 'score2';
        const otherScoreField = team === 1 ? 'score2' : 'score1';
        const otherScore = parseInt(matchResultData[otherScoreField]) || 0;
        
        console.log('📊 Изменение счета:', {
            team: team,
            newScore: score,
            otherTeamScore: otherScore,
            field: scoreField
        });
        
        setMatchResultData(prev => ({
            ...prev,
            [scoreField]: score
        }));
        
        // 🔧 ИСПРАВЛЕНО: Улучшенное автоопределение победителя при изменении счета
        let newWinner = selectedWinner;
        
        // 🏆 УЧИТЫВАЕМ ПРИОРИТЕТ КАРТ: Если есть карты, они важнее общего счета
        const mapsData = matchResultData.maps_data || [];
        let shouldUpdateWinnerByScore = true;
        
        if (mapsData.length > 0) {
            // Если есть карты, проверяем их результаты
            let team1MapWins = 0;
            let team2MapWins = 0;
            
            mapsData.forEach(map => {
                const mapScore1 = parseInt(map.score1) || 0;
                const mapScore2 = parseInt(map.score2) || 0;
                
                if (mapScore1 > mapScore2) {
                    team1MapWins++;
                } else if (mapScore2 > mapScore1) {
                    team2MapWins++;
                }
            });
            
            // Если есть определенный победитель по картам, не меняем его
            if (team1MapWins !== team2MapWins) {
                console.log('Карты определяют победителя, игнорируем изменение общего счета');
                shouldUpdateWinnerByScore = false;
            }
        }
        
        // Обновляем победителя по счету только если карты не определяют результат
        if (shouldUpdateWinnerByScore) {
            if (score > otherScore) {
                newWinner = team === 1 ? 'team1' : 'team2';
            } else if (score < otherScore) {
                newWinner = team === 1 ? 'team2' : 'team1';
            } else if (score === otherScore) {
                // При равном счете сбрасываем победителя только если не было ручного выбора
                if (autoCalculateScore) {
                    newWinner = null;
                }
            }
            
            // Обновляем победителя только если изменился
            if (newWinner !== selectedWinner) {
                console.log('🏆 Автоматически обновляем победителя при изменении счета:', {
                    previousWinner: selectedWinner,
                    newWinner: newWinner,
                    reason: 'handleScoreChange - общий счет (нет карт или равные победы на картах)',
                    scores: `${team === 1 ? score : otherScore}:${team === 2 ? score : otherScore}`
                });
                setSelectedWinner(newWinner);
            }
        }
    };

    // 🎯 ОБНОВЛЕННАЯ ФУНКЦИЯ ИЗМЕНЕНИЯ СЧЕТА КАРТЫ
    const handleMapScoreChange = (mapIndex, team, value) => {
        const score = parseInt(value) || 0;
        setMatchResultData(prev => {
            const newMapsData = [...(prev.maps_data || [])];
            if (!newMapsData[mapIndex]) {
                newMapsData[mapIndex] = { map: '', score1: 0, score2: 0 };
            }
            newMapsData[mapIndex] = {
                ...newMapsData[mapIndex],
                [team === 1 ? 'score1' : 'score2']: score
            };
            
            // Возвращаем обновленные данные
            return { ...prev, maps_data: newMapsData };
        });
        
        console.log(`🗺️ Изменен счет карты ${mapIndex + 1}, команда ${team}: ${score}`);
    };

    const handleMapNameChange = (mapIndex, mapName) => {
        setMatchResultData(prev => {
            const newMapsData = [...(prev.maps_data || [])];
            if (!newMapsData[mapIndex]) {
                newMapsData[mapIndex] = { map: '', score1: 0, score2: 0 };
            }
            newMapsData[mapIndex] = {
                ...newMapsData[mapIndex],
                map: mapName
            };
            return { ...prev, maps_data: newMapsData };
        });
    };

    const addMap = () => {
        const mapsCount = (matchResultData.maps_data || []).length;
        if (mapsCount >= 7) return;
        
        setMatchResultData(prev => ({
            ...prev,
            maps_data: [
                ...(prev.maps_data || []),
                { map: '', score1: 0, score2: 0 }
            ]
        }));
    };

    const removeMap = (mapIndex) => {
        setMatchResultData(prev => {
            const newMapsData = prev.maps_data?.filter((_, index) => index !== mapIndex) || [];
            return { ...prev, maps_data: newMapsData };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // 🎯 ПРОВЕРЯЕМ ДАННЫЕ ПЕРЕД ОТПРАВКОЙ
        console.log('🎯 handleSubmit: начало обработки:', {
            selectedMatch: selectedMatch,
            selectedMatchType: typeof selectedMatch,
            selectedMatchId: selectedMatch?.id,
            isNumber: typeof selectedMatch === 'number',
            matchResultData: matchResultData,
            selectedWinner: selectedWinner
        });

        // 🔧 ОБРАБОТКА ID МАТЧА (ИСПРАВЛЕНО: теперь всегда получаем объект)
        let matchId = null;
        
        if (typeof selectedMatch === 'number') {
            // Если selectedMatch является числом, то это и есть ID матча
            matchId = selectedMatch;
            console.log('✅ selectedMatch является числом (ID матча):', matchId);
        } else if (selectedMatch && typeof selectedMatch === 'object') {
            // Если selectedMatch является объектом, извлекаем ID
            matchId = selectedMatch.id;
            console.log('✅ selectedMatch является объектом, извлекаем ID:', matchId);
        } else {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: selectedMatch имеет неподдерживаемый тип!', {
                selectedMatch,
                type: typeof selectedMatch
            });
        }

        // 🔧 ПРОВЕРЯЕМ ВАЛИДНОСТЬ ID МАТЧА
        if (!matchId && matchId !== 0) {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: не удалось определить ID матча!', {
                selectedMatch,
                matchId,
                selectedMatchType: typeof selectedMatch
            });
            alert('Ошибка: не удалось определить ID матча. Попробуйте закрыть и открыть модальное окно снова.');
            return;
        }
        
        console.log('✅ ID матча успешно определен:', matchId);
        
        const errors = validateResults();
        if (Object.keys(errors).length > 0) {
            console.warn('🚫 Валидация не прошла:', errors);
            return;
        }
        
        // 🔧 ИСПРАВЛЕНО: УЛУЧШЕННАЯ ЛОГИКА АВТОМАТИЧЕСКОГО ОПРЕДЕЛЕНИЯ ПОБЕДИТЕЛЯ
        let finalWinner = selectedWinner;
        
        console.log('🏆 Определение победителя (универсальное для соло/команд):', {
            currentSelectedWinner: selectedWinner,
            score1: matchResultData.score1,
            score2: matchResultData.score2,
            autoCalculateScore: autoCalculateScore,
            mapsCount: (matchResultData.maps_data || []).length,
            participant_type: tournament?.participant_type,
            team1_id: selectedMatch?.team1_id,
            team2_id: selectedMatch?.team2_id
        });
        
        // Если победитель не выбран вручную, определяем автоматически
        if (!finalWinner) {
            const mapsData = matchResultData.maps_data || [];
            
            // 🔧 ПРИОРИТЕТ 1: Определяем по картам (если есть)
            if (mapsData.length > 0) {
                let team1MapWins = 0;
                let team2MapWins = 0;
                
                mapsData.forEach(map => {
                    const mapScore1 = parseInt(map.score1) || 0;
                    const mapScore2 = parseInt(map.score2) || 0;
                    
                    if (mapScore1 > mapScore2) {
                        team1MapWins++;
                    } else if (mapScore2 > mapScore1) {
                        team2MapWins++;
                    }
                });
                
                console.log('🗺️ Приоритетное определение победителя по картам:', {
                    team1MapWins,
                    team2MapWins,
                    mapsPlayed: mapsData.length
                });
                
                if (team1MapWins > team2MapWins) {
                    finalWinner = 'team1';
                    console.log('🏆 Победитель определен по картам: team1');
                } else if (team2MapWins > team1MapWins) {
                    finalWinner = 'team2';
                    console.log('🏆 Победитель определен по картам: team2');
                }
                // Если равное количество побед на картах, переходим к общему счету
            }
            
            // 🔧 ПРИОРИТЕТ 2: Если карт нет или равное количество побед - определяем по общему счету
            if (!finalWinner) {
                const score1 = parseInt(matchResultData.score1) || 0;
                const score2 = parseInt(matchResultData.score2) || 0;
                
                console.log('🤖 Определение победителя по общему счету:', { score1, score2 });
                
                if (score1 > score2) {
                    finalWinner = 'team1';
                    console.log('🏆 Победитель определен по общему счету: team1');
                } else if (score2 > score1) {
                    finalWinner = 'team2';
                    console.log('🏆 Победитель определен по общему счету: team2');
                } else {
                    console.log('🤝 Ничья - равный счет и равное количество побед на картах');
                    finalWinner = null;
                }
            }
        }
        
        // Обновляем состояние если победитель изменился
        if (finalWinner !== selectedWinner) {
            console.log('🔄 Обновляем selectedWinner:', finalWinner);
            setSelectedWinner(finalWinner);
        }
        
        // 🔧 УНИВЕРСАЛЬНОЕ ИСПРАВЛЕНИЕ: Передаем информацию о winner_team_id для бэкенда
        let winner_team_id = null;
        if (finalWinner && selectedMatch) {
            if (finalWinner === 'team1') {
                winner_team_id = selectedMatch.team1_id;
            } else if (finalWinner === 'team2') {
                winner_team_id = selectedMatch.team2_id;
            }
        }
        
        // 🆕 УНИВЕРСАЛЬНАЯ ВАЛИДАЦИЯ: Проверяем тип турнира для логирования
        const participantType = tournament?.participant_type || 'unknown';
        const entityType = participantType === 'solo' ? 'участника' : 'команды';
        
        const submitData = {
            ...matchResultData,
            winner: finalWinner,
            winner_team_id: winner_team_id  // ✅ Универсально работает для команд и соло
        };
        
        console.log('💾 Финальные данные для сохранения (универсальные):', {
            matchId: matchId,
            finalWinner: finalWinner,
            winner_team_id: winner_team_id,
            participant_type: participantType,
            entity_type: entityType,
            score: `${submitData.score1}:${submitData.score2}`,
            mapsCount: (submitData.maps_data || []).length,
            submitData: submitData
        });
        
        if (typeof onSave === 'function') {
            onSave(submitData);
        } else {
            console.error('❌ onSave не является функцией:', onSave);
        }
    };

    const handleClose = () => {
        modalSystem.closeModal();
        onClose();
    };

    const isCS2 = isCounterStrike2(getTournamentGame());
    const mapsData = matchResultData.maps_data || [];
    const hasValidationErrors = Object.keys(validationErrors).length > 0;
    const mapStats = getMapStatistics();
    const isInProgressWithMaps = tournament?.status === 'in_progress' && Array.isArray(selectedMatch?.maps_data) && selectedMatch.maps_data.length > 0;

    // 🔧 УЛУЧШЕННАЯ ОТЛАДКА ДЛЯ ДИАГНОСТИКИ ПРОБЛЕМ С КАРТАМИ
    console.log('🗺️ Диагностика карт в MatchResultModal v5.0:', {
        tournamentGame: getTournamentGame(),
        isCS2,
        availableMapsCount: availableMaps.length,
        availableMaps: availableMaps.slice(0, 3), // показываем первые 3 карты
        currentMapsDataCount: mapsData.length,
        selectedMatchId: selectedMatch?.id,
        showModal: isOpen,
        shouldShowMapsSection: isCS2 && availableMaps.length > 0
    });

    // Вспомогательный хелпер для названия карты
    const getMapDisplayName = (m) => (m?.map_name || m?.map || m?.name || 'Неизвестно');

    // Рендер секции карт
    const renderMapsSection = () => {
        // Упрощенный режим: только ввод счёта по уже выбранным картам
        if (isInProgressWithMaps) {
            const mapsData = matchResultData.maps_data || selectedMatch.maps_data || [];
            return (
                <section className="modal-section maps-section">
                    <h3>Карты и счёт</h3>
                    <div className="maps-score-grid">
                        {mapsData.map((m, idx) => (
                            <div key={idx} className="map-score-row">
                                <div className="map-name">{getMapDisplayName(m)}</div>
                                <input
                                    type="number"
                                    min="0"
                                    className="score-input"
                                    value={m.score1 ?? ''}
                                    onChange={(e) => {
                                        const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                        setMatchResultData(prev => {
                                            const next = { ...(prev || {}), maps_data: [...(prev?.maps_data || mapsData)] };
                                            next.maps_data[idx] = { ...(next.maps_data[idx] || m), score1: v };
                                            return next;
                                        });
                                    }}
                                    placeholder={selectedMatch.team1_name || 'Команда 1'}
                                />
                                <span className="score-sep">:</span>
                                <input
                                    type="number"
                                    min="0"
                                    className="score-input"
                                    value={m.score2 ?? ''}
                                    onChange={(e) => {
                                        const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                        setMatchResultData(prev => {
                                            const next = { ...(prev || {}), maps_data: [...(prev?.maps_data || mapsData)] };
                                            next.maps_data[idx] = { ...(next.maps_data[idx] || m), score2: v };
                                            return next;
                                        });
                                    }}
                                    placeholder={selectedMatch.team2_name || 'Команда 2'}
                                />
                            </div>
                        ))}
                    </div>
                </section>
            );
        }

        // Обычный полный редактор карт (существующая логика ниже)
        return (
            <div className="modal-system-section">
                <h3 className="modal-system-section-title">
                    Результаты по картам ({mapsData.length}/7)
                </h3>
                <p className="modal-system-section-content modal-system-mb-20">
                    Укажите результаты на каждой карте для детальной статистики
                </p>
                
                <div className="modal-system-flex-column">
                    {mapsData.map((mapData, index) => (
                        <div key={index} className="modal-system-info">
                            <div className="modal-system-flex-between modal-system-mb-10">
                                <select
                                    className="modal-system-select"
                                    value={mapData.map || ''}
                                    onChange={(e) => handleMapNameChange(index, e.target.value)}
                                    disabled={isLoading}
                                    style={{ flex: 1, marginRight: '10px' }}
                                >
                                    <option value="">Выберите карту</option>
                                    {availableMaps.map((mapName) => (
                                        <option key={mapName} value={mapName}>{mapName}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="modal-system-btn modal-system-btn-danger modal-system-btn-small"
                                    onClick={() => removeMap(index)}
                                    disabled={isLoading}
                                    title="Удалить карту"
                                >
                                    🗑️
                                </button>
                            </div>
                            
                            <div className="modal-system-grid-3">
                                <div className="modal-system-form-group">
                                    <label className="modal-system-label">
                                        {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ в секции карт */}
                                        {selectedMatch.team1_name || 
                                         (tournament?.participant_type === 'solo' ? 'Участник 1' : 'Команда 1')}
                                    </label>
                                    <input
                                        type="number"
                                        className={`modal-system-input ${validationErrors[`map_${index}_scores`] ? 'modal-system-input-error' : ''}`}
                                        value={mapData.score1 || 0}
                                        onChange={(e) => handleMapScoreChange(index, 1, e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="modal-system-text-center modal-system-flex-center">
                                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>:</div>
                                </div>
                                <div className="modal-system-form-group">
                                    <label className="modal-system-label">
                                        {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ в секции карт */}
                                        {selectedMatch.team2_name || 
                                         (tournament?.participant_type === 'solo' ? 'Участник 2' : 'Команда 2')}
                                    </label>
                                    <input
                                        type="number"
                                        className={`modal-system-input ${validationErrors[`map_${index}_scores`] ? 'modal-system-input-error' : ''}`}
                                        value={mapData.score2 || 0}
                                        onChange={(e) => handleMapScoreChange(index, 2, e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>
                            {validationErrors[`map_${index}_scores`] && (
                                <div className="modal-system-info modal-system-info-error modal-system-mt-10">
                                    {validationErrors[`map_${index}_scores`]}
                                </div>
                            )}
                        </div>
                    ))}
                    
                    <button 
                        type="button"
                        className="modal-system-btn"
                        onClick={addMap}
                        disabled={isLoading || mapsData.length >= 7}
                    >
                        Добавить карту ({mapsData.length}/7)
                    </button>
                </div>

                {/* Расширенная статистика по картам */}
                {mapStats && (
                    <div className="modal-system-section modal-system-mt-20">
                        <h4 className="modal-system-bold modal-system-mb-10">Расширенная статистика</h4>
                        <div className="modal-system-grid-3">
                            <div className="modal-system-info">
                                <h5 className="modal-system-bold modal-system-mb-10">Победы по картам</h5>
                                <div className="modal-system-flex-column">
                                    <span>
                                        {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ в статистике */}
                                        {selectedMatch.team1_name || 
                                         (tournament?.participant_type === 'solo' ? 'Участник 1' : 'Команда 1')}: {mapStats.team1Wins}
                                    </span>
                                    <span>
                                        {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ в статистике */}
                                        {selectedMatch.team2_name || 
                                         (tournament?.participant_type === 'solo' ? 'Участник 2' : 'Команда 2')}: {mapStats.team2Wins}
                                    </span>
                                    {mapStats.draws > 0 && <span>Ничьи: {mapStats.draws}</span>}
                                </div>
                            </div>
                            
                            <div className="modal-system-info">
                                <h5 className="modal-system-bold modal-system-mb-10">🎯 Общий счет по очкам</h5>
                                <div className="modal-system-flex-column">
                                    <span>
                                        {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ в статистике */}
                                        {selectedMatch.team1_name || 
                                         (tournament?.participant_type === 'solo' ? 'Участник 1' : 'Команда 1')}: {mapStats.team1TotalScore}
                                    </span>
                                    <span>
                                        {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ в статистике */}
                                        {selectedMatch.team2_name || 
                                         (tournament?.participant_type === 'solo' ? 'Участник 2' : 'Команда 2')}: {mapStats.team2TotalScore}
                                    </span>
                                    <span>Разность: ±{mapStats.scoreDifference}</span>
                                </div>
                            </div>
                            
                            <div className="modal-system-info">
                                <h5 className="modal-system-bold modal-system-mb-10">Эффективность</h5>
                                <div className="modal-system-flex-column">
                                    <span>Карт сыграно: {mapStats.mapsCount}</span>
                                    <span>Формат: {mapStats.mapsCount === 1 ? 'BO1' : 
                                                                     mapStats.mapsCount <= 3 ? 'BO3' : 
                                                                     mapStats.mapsCount <= 5 ? 'BO5' : 'BO7'}</span>
                                    <span>Средний счет: {Math.round((mapStats.team1TotalScore + mapStats.team2TotalScore) / mapStats.mapsCount / 2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="modal-system-overlay" onClick={handleClose}>
            <div className={modalSystem.getModalClasses('large')} onClick={(e) => e.stopPropagation()}>
                
                {/* === ЗАГОЛОВОК МОДАЛЬНОГО ОКНА === */}
                <div className="modal-system-header">
                    <div>
                        <h2 className="modal-system-title">
                            ✏️ Редактирование результата матча
                            {hasChanges && (
                                <span className="modal-system-badge modal-system-badge-warning modal-system-ml-10">
                                    *
                                </span>
                            )}
                        </h2>
                    </div>
                    <button 
                        className="modal-system-close" 
                        onClick={handleClose} 
                        aria-label="Закрыть модальное окно"
                    >
                        ✕
                    </button>
                </div>

                {/* === ТЕЛО МОДАЛЬНОГО ОКНА === */}
                <div className="modal-system-body">
                    <form onSubmit={handleSubmit} className="modal-system-flex-column">
                        
                        {/* Информация о матче с выбором победителя */}
                        <div className="modal-system-section">
                            <h3 className="modal-system-section-title">🏆 Выбор победителя</h3>
                            
                            <div className="modal-system-grid-3">
                                <div 
                                    className={`modal-system-info ${selectedWinner === 'team1' ? 'modal-system-info-success' : ''}`}
                                    onClick={() => selectWinner('team1')}
                                    onMouseEnter={() => selectedMatch.team1_composition && setShowTeam1Tooltip(true)}
                                    onMouseLeave={() => setShowTeam1Tooltip(false)}
                                    style={{ cursor: 'pointer', position: 'relative' }}
                                    title="Выбрать победителем"
                                >
                                    <div className="modal-system-text-center">
                                        <div className="modal-system-bold modal-system-mb-10">
                                            {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ: имя участника или команды */}
                                            {selectedMatch.team1_name || 
                                             (tournament?.participant_type === 'solo' ? 'Участник 1' : 'Команда 1')}
                                        </div>
                                        {selectedWinner === 'team1' && (
                                            <div className="modal-system-badge modal-system-badge-success">
                                                👑 Победитель
                                            </div>
                                        )}
                                    </div>
                                    
                                    <TeamTooltip 
                                        team="team1"
                                        composition={selectedMatch.team1_composition}
                                        show={showTeam1Tooltip}
                                    />
                                </div>

                                <div className="modal-system-text-center">
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', margin: '20px 0' }}>VS</div>
                                </div>

                                <div 
                                    className={`modal-system-info ${selectedWinner === 'team2' ? 'modal-system-info-success' : ''}`}
                                    onClick={() => selectWinner('team2')}
                                    onMouseEnter={() => selectedMatch.team2_composition && setShowTeam2Tooltip(true)}
                                    onMouseLeave={() => setShowTeam2Tooltip(false)}
                                    style={{ cursor: 'pointer', position: 'relative' }}
                                    title="Выбрать победителем"
                                >
                                    <div className="modal-system-text-center">
                                        <div className="modal-system-bold modal-system-mb-10">
                                            {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ: имя участника или команды */}
                                            {selectedMatch.team2_name || 
                                             (tournament?.participant_type === 'solo' ? 'Участник 2' : 'Команда 2')}
                                        </div>
                                        {selectedWinner === 'team2' && (
                                            <div className="modal-system-badge modal-system-badge-success">
                                                👑 Победитель
                                            </div>
                                        )}
                                    </div>
                                    
                                    <TeamTooltip 
                                        team="team2"
                                        composition={selectedMatch.team2_composition}
                                        show={showTeam2Tooltip}
                                    />
                                </div>
                            </div>
                            
                            {/* Кнопка сброса выбора победителя */}
                            {selectedWinner && (
                                <div className="modal-system-text-center modal-system-mt-20">
                                    <button 
                                        type="button"
                                        className="modal-system-btn"
                                        onClick={() => setSelectedWinner(null)}
                                        title="Сбросить выбор победителя"
                                    >
                                        🔄 Сбросить выбор победителя
                                    </button>
                                </div>
                            )}
                            
                            {/* 🆕 Информация об автоматическом определении победителя */}
                            {!selectedWinner && (
                                <div className="modal-system-info modal-system-mt-20">
                                    <p className="modal-system-bold">🤖 Автоматическое определение победителя</p>
                                    <p>Если вы не выберете победителя вручную, он будет определен автоматически по приоритетам:</p>
                                    <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                                        <li><strong>1️⃣ По количеству выигранных карт</strong> (главный критерий)</li>
                                        <li><strong>2️⃣ По общему счету матча</strong> (если карт нет или равное количество побед)</li>
                                        <li><strong>3️⃣ Ничья</strong> - если все показатели равны</li>
                                    </ul>
                                    <p className="modal-system-text-sm">💡 В турнирах CS2 количество выигранных карт важнее общего фрагового счета</p>
                                </div>
                            )}
                        </div>

                        {/* Основной счет матча */}
                        <div className="modal-system-section">
                            <h3 className="modal-system-section-title">📊 Счет матча</h3>
                            
                            {/* 🆕 Настройки автоматического расчета */}
                            {isCS2 && availableMaps.length > 0 && (
                                <div className="modal-system-info modal-system-mb-20">
                                    <div className="modal-system-checkbox-group">
                                        <input
                                            type="checkbox"
                                            className="modal-system-checkbox"
                                            checked={autoCalculateScore}
                                            onChange={(e) => setAutoCalculateScore(e.target.checked)}
                                            disabled={isLoading}
                                        />
                                        <span className="modal-system-bold">
                                            🔄 Автоматически рассчитывать общий счет по картам
                                        </span>
                                    </div>
                                    
                                    {autoCalculateScore && mapsData.length > 0 && (
                                        <div className="modal-system-flex-between modal-system-mt-10">
                                            <span>⚡ Счет обновляется автоматически на основе побед на картах</span>
                                            <button
                                                type="button"
                                                className="modal-system-btn modal-system-btn-small"
                                                onClick={calculateOverallScoreFromMaps}
                                                title="Пересчитать счет сейчас"
                                                disabled={isLoading}
                                            >
                                                🔄 Пересчитать
                                            </button>
                                        </div>
                                    )}
                                    
                                    {!autoCalculateScore && mapsData.length > 0 && (
                                        <div className="modal-system-mt-10">
                                            <p>💡 Автоматический расчет отключен. Вы можете пересчитать общий счет вручную:</p>
                                            <button
                                                type="button"
                                                className="modal-system-btn"
                                                onClick={calculateOverallScoreFromMaps}
                                                disabled={isLoading}
                                            >
                                                🧮 Рассчитать счет по картам
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="form-grid-3">
                                <div className="modal-system-form-group">
                                    <label className="modal-system-label">
                                        {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ в секции счета */}
                                        {selectedMatch.team1_name || 
                                         (tournament?.participant_type === 'solo' ? 'Участник 1' : 'Команда 1')}
                                    </label>
                                    <input
                                        type="number"
                                        className={`modal-system-input ${validationErrors.scores ? 'modal-system-input-error' : ''} ${autoCalculateScore && mapsData.length > 0 ? 'modal-system-input-disabled' : ''}`}
                                        value={matchResultData.score1}
                                        onChange={(e) => handleScoreChange(1, e.target.value)}
                                        disabled={isLoading || (autoCalculateScore && mapsData.length > 0)}
                                        title={autoCalculateScore && mapsData.length > 0 ? 'Счет рассчитывается автоматически на основе побед на картах' : ''}
                                    />
                                    {autoCalculateScore && mapsData.length > 0 && (
                                        <div className="modal-system-badge modal-system-mt-10">🤖 Авто</div>
                                    )}
                                </div>

                                <div className="modal-system-text-center modal-system-flex-center">
                                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>:</div>
                                </div>

                                <div className="modal-system-form-group">
                                    <label className="modal-system-label">
                                        {/* 🆕 УНИВЕРСАЛЬНОЕ ОТОБРАЖЕНИЕ в секции счета */}
                                        {selectedMatch.team2_name || 
                                         (tournament?.participant_type === 'solo' ? 'Участник 2' : 'Команда 2')}
                                    </label>
                                    <input
                                        type="number"
                                        className={`modal-system-input ${validationErrors.scores ? 'modal-system-input-error' : ''} ${autoCalculateScore && mapsData.length > 0 ? 'modal-system-input-disabled' : ''}`}
                                        value={matchResultData.score2}
                                        onChange={(e) => handleScoreChange(2, e.target.value)}
                                        disabled={isLoading || (autoCalculateScore && mapsData.length > 0)}
                                        title={autoCalculateScore && mapsData.length > 0 ? 'Счет рассчитывается автоматически на основе побед на картах' : ''}
                                    />
                                    {autoCalculateScore && mapsData.length > 0 && (
                                        <div className="modal-system-badge modal-system-mt-10">🤖 Авто</div>
                                    )}
                                </div>
                            </div>
                            
                            {validationErrors.scores && (
                                <div className="modal-system-info modal-system-info-error modal-system-mt-10">
                                    {validationErrors.scores}
                                </div>
                            )}
                            
                            {/* Подсказка для автоматического расчета */}
                            {autoCalculateScore && mapsData.length > 0 && (
                                <div className="modal-system-info modal-system-mt-20">
                                    <p className="modal-system-bold">💡 Как работает автоматический расчет:</p>
                                    <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                                        <li>Каждая выигранная карта = +1 к общему счету команды</li>
                                        <li>Ничьи на картах не засчитываются в общий счет</li>
                                        <li>Победитель определяется автоматически по большему количеству выигранных карт</li>
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* 🔧 ИСПРАВЛЕННАЯ СЕКЦИЯ КАРТ */}
                        {isCS2 && availableMaps.length > 0 && (
                            renderMapsSection()
                        )}

                        {/* Сообщение если карты не поддерживаются */}
                        {!isCS2 && (
                            <div className="modal-system-info modal-system-info-warning">
                                <p>ℹ️ Игра "{getTournamentGame() || 'неизвестна'}" не поддерживает выбор карт</p>
                            </div>
                        )}

                        {/* Сообщение если CS2 но нет доступных карт */}
                        {isCS2 && availableMaps.length === 0 && (
                            <div className="modal-system-info modal-system-info-error">
                                <p>⚠️ Карты для Counter-Strike 2 не загружены</p>
                            </div>
                        )}

                        {/* Валидационные ошибки */}
                        {hasValidationErrors && (
                            <div className="modal-system-info modal-system-info-error">
                                <h5 className="modal-system-bold">⚠️ Ошибки валидации:</h5>
                                <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                                    {Object.entries(validationErrors).map(([field, error]) => (
                                        <li key={field}>{error}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </form>
                </div>

                {/* === ПОДВАЛ МОДАЛЬНОГО ОКНА === */}
                <div className="modal-system-footer modal-system-space-between">
                    <button 
                        type="button"
                        className="modal-system-btn"
                        onClick={handleClose}
                        disabled={isLoading}
                    >
                        ❌ Отмена
                    </button>
                    <button 
                        type="submit"
                        className="modal-system-btn modal-system-btn-primary"
                        onClick={handleSubmit}
                        disabled={isLoading || hasValidationErrors}
                    >
                        {isLoading ? '⏳ Сохранение...' : '💾 Сохранить результат'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MatchResultModal; 
