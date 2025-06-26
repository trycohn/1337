import React, { useState, useEffect, useCallback } from 'react';
import { isCounterStrike2, getDefaultCS2Maps } from '../../../utils/mapHelpers';
import './MatchResultModal.css';

/**
 * MatchResultModal v4.0 - Комплексное управление результатами матчей
 * 
 * @version 4.0 (Полная реализация с выбором победителя и тултипами)
 * @features Выбор победителя, тултипы команд, расширенная статистика, валидация
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

    // 🎯 УЛУЧШЕННОЕ: Определение игры турнира
    const getTournamentGame = useCallback(() => {
        console.log('🎮 Определяем игру турнира для карт...');
        
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
                console.log('🔍 Определяем игру по URL для турнира:', pathMatch[1]);
                // Для демонстрации считаем CS2 по умолчанию
                console.log('✅ Принимаем Counter-Strike 2 как игру по умолчанию');
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
        console.log('🏆 Выбран победитель:', team);
        setSelectedWinner(team);
        
        // Автоматически обновляем счет, если нужно
        if (team === 'team1' && parseInt(matchResultData.score1 || 0) <= parseInt(matchResultData.score2 || 0)) {
            setMatchResultData(prev => ({
                ...prev,
                score1: Math.max(1, parseInt(prev.score2 || 0) + 1)
            }));
        } else if (team === 'team2' && parseInt(matchResultData.score2 || 0) <= parseInt(matchResultData.score1 || 0)) {
            setMatchResultData(prev => ({
                ...prev,
                score2: Math.max(1, parseInt(prev.score1 || 0) + 1)
            }));
        }
    }, [matchResultData, setMatchResultData]);

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
        
        // Автоматически определяем победителя
        if (team1Wins > team2Wins) {
            setSelectedWinner('team1');
        } else if (team2Wins > team1Wins) {
            setSelectedWinner('team2');
        } else {
            setSelectedWinner(null);
        }
        
        console.log('📊 Автоматический расчет счета:', {
            mapsPlayed: mapsData.length,
            team1Wins,
            team2Wins,
            winner: team1Wins > team2Wins ? 'team1' : team2Wins > team1Wins ? 'team2' : 'draw'
        });
    }, [matchResultData.maps_data, setMatchResultData]);

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

    // 🎯 ТУЛТИП С СОСТАВОМ КОМАНДЫ (МИНИМАЛИСТИЧНЫЙ)
    const TeamTooltip = ({ team, composition, show }) => {
        if (!show || !composition) return null;

        return (
            <div className="team-tooltip">
                <div className="tooltip-header">
                    <h5>{composition.name}</h5>
                </div>
                <div className="tooltip-content">
                    <ul className="team-members-tooltip">
                        {composition.members.map((member, index) => (
                            <li key={index} className="tooltip-member">
                                <span className="member-name">{member.name}</span>
                                {member.rating && (
                                    <span className="member-rating">({member.rating})</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    };

    if (!isOpen || !selectedMatch) return null;

    // 🎯 ОБРАБОТЧИКИ СОБЫТИЙ
    const handleScoreChange = (team, value) => {
        const score = parseInt(value) || 0; // Убираем ограничение Math.max(0, ...)
        setMatchResultData(prev => ({
            ...prev,
            [team === 1 ? 'score1' : 'score2']: score
        }));
        
        // Автоопределение победителя
        const otherScore = team === 1 ? parseInt(matchResultData.score2) || 0 : parseInt(matchResultData.score1) || 0;
        if (score > otherScore) {
            setSelectedWinner(team === 1 ? 'team1' : 'team2');
        } else if (score < otherScore) {
            setSelectedWinner(team === 1 ? 'team2' : 'team1');
        } else {
            setSelectedWinner(null);
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
        
        // Добавляем информацию о победителе
        const submitData = {
            ...matchResultData,
            winner: selectedWinner
        };
        
        console.log('💾 Сохраняем результат матча:', {
            matchId: matchId,
            submitData: submitData,
            hasOnSave: typeof onSave === 'function'
        });
        
        if (typeof onSave === 'function') {
            onSave(submitData);
        } else {
            console.error('❌ onSave не является функцией:', onSave);
        }
    };

    const handleClose = () => {
        if (hasChanges && !isLoading) {
            const confirmed = window.confirm(
                '⚠️ У вас есть несохраненные изменения. Закрыть без сохранения?'
            );
            if (!confirmed) return;
        }
        onClose();
    };

    const isCS2 = isCounterStrike2(getTournamentGame());
    const mapsData = matchResultData.maps_data || [];
    const hasValidationErrors = Object.keys(validationErrors).length > 0;
    const mapStats = getMapStatistics();

    // 🔧 УЛУЧШЕННАЯ ОТЛАДКА ДЛЯ ДИАГНОСТИКИ ПРОБЛЕМ С КАРТАМИ
    console.log('🗺️ Диагностика карт в MatchResultModal:', {
        tournamentGame: getTournamentGame(),
        isCS2,
        availableMapsCount: availableMaps.length,
        availableMaps: availableMaps.slice(0, 3), // показываем первые 3 карты
        currentMapsDataCount: mapsData.length,
        selectedMatchId: selectedMatch?.id,
        showModal: isOpen,
        shouldShowMapsSection: isCS2 && availableMaps.length > 0
    });

    return (
        <div className="modal-overlay enhanced-match-result-overlay" onClick={handleClose}>
            <div className="modal-content match-result-modal enhanced-match-result-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>
                        ✏️ Редактирование результата матча
                        {hasChanges && <span className="changes-indicator">*</span>}
                    </h3>
                    <button className="close-btn" onClick={handleClose} title="Закрыть">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="match-result-form">
                    {/* Информация о матче с выбором победителя */}
                    <div className="match-info">
                        <div className="teams-display">
                            <div 
                                className={`team-display ${selectedWinner === 'team1' ? 'winner-selected' : ''} ${selectedMatch.team1_composition ? 'has-tooltip' : ''}`}
                                onClick={() => selectWinner('team1')}
                                title="Выбрать победителем"
                            >
                                <span className="team-name">{selectedMatch.team1_name || 'Команда 1'}</span>
                                {selectedWinner === 'team1' && <span className="winner-crown">👑</span>}
                                
                                <TeamTooltip 
                                    team="team1"
                                    composition={selectedMatch.team1_composition}
                                    show={true}
                                />
                            </div>
                            <div className="vs-separator">VS</div>
                            <div 
                                className={`team-display ${selectedWinner === 'team2' ? 'winner-selected' : ''} ${selectedMatch.team2_composition ? 'has-tooltip' : ''}`}
                                onClick={() => selectWinner('team2')}
                                title="Выбрать победителем"
                            >
                                <span className="team-name">{selectedMatch.team2_name || 'Команда 2'}</span>
                                {selectedWinner === 'team2' && <span className="winner-crown">👑</span>}
                                
                                <TeamTooltip 
                                    team="team2"
                                    composition={selectedMatch.team2_composition}
                                    show={true}
                                />
                            </div>
                        </div>
                        
                        {/* Кнопка сброса выбора победителя */}
                        {selectedWinner && (
                            <div className="winner-reset">
                                <button 
                                    type="button"
                                    className="reset-winner-btn"
                                    onClick={() => setSelectedWinner(null)}
                                    title="Сбросить выбор победителя"
                                >
                                    🔄 Сбросить выбор победителя
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Основной счет матча */}
                    <div className="match-scores">
                        <h4>📊 Счет матча</h4>
                        
                        {/* 🆕 Настройки автоматического расчета */}
                        {isCS2 && availableMaps.length > 0 && (
                            <div className="auto-calculate-section">
                                <label className="auto-calculate-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={autoCalculateScore}
                                        onChange={(e) => setAutoCalculateScore(e.target.checked)}
                                        disabled={isLoading}
                                    />
                                    <span className="checkmark"></span>
                                    🔄 Автоматически рассчитывать общий счет по картам
                                </label>
                                {autoCalculateScore && mapsData.length > 0 && (
                                    <div className="auto-calculate-indicator">
                                        <span className="indicator-icon">⚡</span>
                                        <span className="indicator-text">Счет обновляется автоматически на основе побед на картах</span>
                                        <button
                                            type="button"
                                            className="recalculate-btn"
                                            onClick={calculateOverallScoreFromMaps}
                                            title="Пересчитать счет сейчас"
                                            disabled={isLoading}
                                        >
                                            🔄
                                        </button>
                                    </div>
                                )}
                                {!autoCalculateScore && mapsData.length > 0 && (
                                    <div className="manual-calculate-section">
                                        <p className="manual-hint">
                                            💡 Автоматический расчет отключен. Вы можете пересчитать общий счет вручную:
                                        </p>
                                        <button
                                            type="button"
                                            className="manual-recalculate-btn"
                                            onClick={calculateOverallScoreFromMaps}
                                            disabled={isLoading}
                                        >
                                            🧮 Рассчитать счет по картам
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <div className="score-inputs">
                            <div className="score-container">
                                <label htmlFor="score1">{selectedMatch.team1_name || 'Команда 1'}</label>
                                <div className="score-input-wrapper">
                                    <input
                                        id="score1"
                                        type="number"
                                        value={matchResultData.score1}
                                        onChange={(e) => handleScoreChange(1, e.target.value)}
                                        disabled={isLoading || (autoCalculateScore && mapsData.length > 0)}
                                        className={`${validationErrors.scores ? 'error' : ''} ${autoCalculateScore && mapsData.length > 0 ? 'auto-calculated' : ''}`}
                                        title={autoCalculateScore && mapsData.length > 0 ? 'Счет рассчитывается автоматически на основе побед на картах' : ''}
                                    />
                                    {autoCalculateScore && mapsData.length > 0 && (
                                        <div className="auto-calculated-badge">🤖</div>
                                    )}
                                </div>
                            </div>
                            <div className="score-separator">:</div>
                            <div className="score-container">
                                <label htmlFor="score2">{selectedMatch.team2_name || 'Команда 2'}</label>
                                <div className="score-input-wrapper">
                                    <input
                                        id="score2"
                                        type="number"
                                        value={matchResultData.score2}
                                        onChange={(e) => handleScoreChange(2, e.target.value)}
                                        disabled={isLoading || (autoCalculateScore && mapsData.length > 0)}
                                        className={`${validationErrors.scores ? 'error' : ''} ${autoCalculateScore && mapsData.length > 0 ? 'auto-calculated' : ''}`}
                                        title={autoCalculateScore && mapsData.length > 0 ? 'Счет рассчитывается автоматически на основе побед на картах' : ''}
                                    />
                                    {autoCalculateScore && mapsData.length > 0 && (
                                        <div className="auto-calculated-badge">🤖</div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {validationErrors.scores && (
                            <div className="validation-error">{validationErrors.scores}</div>
                        )}
                        
                        {/* Подсказка для автоматического расчета */}
                        {autoCalculateScore && mapsData.length > 0 && (
                            <div className="auto-calculate-help">
                                <p>💡 <strong>Как работает автоматический расчет:</strong></p>
                                <ul>
                                    <li>Каждая выигранная карта = +1 к общему счету команды</li>
                                    <li>Ничьи на картах не засчитываются в общий счет</li>
                                    <li>Победитель определяется автоматически по большему количеству выигранных карт</li>
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* 🔧 ИСПРАВЛЕННАЯ СЕКЦИЯ КАРТ */}
                    {isCS2 && availableMaps.length > 0 && (
                        <div className="maps-section">
                            <div className="maps-header">
                                <h4>🗺️ Результаты по картам ({mapsData.length}/7)</h4>
                                <p className="maps-hint">
                                    🎯 Укажите результаты на каждой карте для детальной статистики
                                </p>
                            </div>
                            
                            {/* 🔧 УЛУЧШЕННАЯ ОТЛАДОЧНАЯ ИНФОРМАЦИЯ */}
                            <div className="debug-maps-info" style={{padding: '10px', background: '#f0f0f0', margin: '10px 0', fontSize: '12px'}}>
                                <details>
                                    <summary>🔍 Отладка карт (разработка)</summary>
                                    <ul>
                                        <li>Игра турнира: {getTournamentGame() || 'не определена'}</li>
                                        <li>Поддержка CS2: {isCS2 ? 'Да' : 'Нет'}</li>
                                        <li>Доступно карт: {availableMaps.length}</li>
                                        <li>Названия карт: {availableMaps.join(', ')}</li>
                                        <li>Текущих карт в матче: {mapsData.length}</li>
                                        <li>ID матча: {selectedMatch?.id}</li>
                                        <li>Секция карт показана: {isCS2 && availableMaps.length > 0 ? 'Да' : 'Нет'}</li>
                                    </ul>
                                </details>
                            </div>

                            <div className="maps-container">
                                {mapsData.map((mapData, index) => (
                                    <div key={index} className="map-entry">
                                        <div className="map-select-container">
                                            <select
                                                className="map-select"
                                                value={mapData.map || ''}
                                                onChange={(e) => handleMapNameChange(index, e.target.value)}
                                                disabled={isLoading}
                                            >
                                                <option value="">Выберите карту</option>
                                                {availableMaps.map((mapName) => (
                                                    <option key={mapName} value={mapName}>{mapName}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                className="remove-map-btn"
                                                onClick={() => removeMap(index)}
                                                disabled={isLoading}
                                                title="Удалить карту"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                        
                                        <div className="map-scores">
                                            <div className="map-score-input">
                                                <label>{selectedMatch.team1_name || 'Команда 1'}</label>
                                                <input
                                                    type="number"
                                                    value={mapData.score1 || 0}
                                                    onChange={(e) => handleMapScoreChange(index, 1, e.target.value)}
                                                    disabled={isLoading}
                                                    className={validationErrors[`map_${index}_scores`] ? 'error' : ''}
                                                />
                                            </div>
                                            <div className="map-score-separator">:</div>
                                            <div className="map-score-input">
                                                <label>{selectedMatch.team2_name || 'Команда 2'}</label>
                                                <input
                                                    type="number"
                                                    value={mapData.score2 || 0}
                                                    onChange={(e) => handleMapScoreChange(index, 2, e.target.value)}
                                                    disabled={isLoading}
                                                    className={validationErrors[`map_${index}_scores`] ? 'error' : ''}
                                                />
                                            </div>
                                        </div>
                                        {validationErrors[`map_${index}_scores`] && (
                                            <div className="validation-error">{validationErrors[`map_${index}_scores`]}</div>
                                        )}
                                    </div>
                                ))}
                                
                                <button 
                                    type="button"
                                    className="add-map-btn"
                                    onClick={addMap}
                                    disabled={isLoading || mapsData.length >= 7}
                                >
                                    ➕ Добавить карту ({mapsData.length}/7)
                                </button>
                            </div>

                            {/* Расширенная статистика по картам */}
                            {mapStats && (
                                <div className="maps-summary enhanced-stats">
                                    <h5>📊 Расширенная статистика</h5>
                                    <div className="maps-summary-content">
                                        <div className="stats-grid">
                                            <div className="stat-group">
                                                <h6>🏆 Победы по картам</h6>
                                                <div className="maps-won">
                                                    <span className="team-maps-won">
                                                        {selectedMatch.team1_name}: {mapStats.team1Wins}
                                                    </span>
                                                    <span className="team-maps-won">
                                                        {selectedMatch.team2_name}: {mapStats.team2Wins}
                                                    </span>
                                                    {mapStats.draws > 0 && (
                                                        <span className="team-maps-won draws">
                                                            Ничьи: {mapStats.draws}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="stat-group">
                                                <h6>🎯 Общий счет по очкам</h6>
                                                <div className="total-scores">
                                                    <span className="total-score">
                                                        {selectedMatch.team1_name}: {mapStats.team1TotalScore}
                                                    </span>
                                                    <span className="total-score">
                                                        {selectedMatch.team2_name}: {mapStats.team2TotalScore}
                                                    </span>
                                                    <span className="score-difference">
                                                        Разность: ±{mapStats.scoreDifference}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="stat-group">
                                                <h6>📈 Эффективность</h6>
                                                <div className="performance-stats">
                                                    <span className="performance-stat">
                                                        Карт сыграно: {mapStats.mapsCount}
                                                    </span>
                                                    <span className="performance-stat">
                                                        Формат: {mapStats.mapsCount === 1 ? 'BO1' : 
                                                                 mapStats.mapsCount <= 3 ? 'BO3' : 
                                                                 mapStats.mapsCount <= 5 ? 'BO5' : 'BO7'}
                                                    </span>
                                                    <span className="performance-stat">
                                                        Средний счет: {Math.round((mapStats.team1TotalScore + mapStats.team2TotalScore) / mapStats.mapsCount / 2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Сообщение если карты не поддерживаются */}
                    {!isCS2 && (
                        <div className="no-maps-section">
                            <p>ℹ️ Игра "{getTournamentGame() || 'неизвестна'}" не поддерживает выбор карт</p>
                        </div>
                    )}

                    {/* Сообщение если CS2 но нет доступных карт */}
                    {isCS2 && availableMaps.length === 0 && (
                        <div className="no-maps-section">
                            <p>⚠️ Карты для Counter-Strike 2 не загружены</p>
                        </div>
                    )}

                    {/* Валидационные ошибки */}
                    {hasValidationErrors && (
                        <div className="validation-summary">
                            <h5>⚠️ Ошибки валидации:</h5>
                            <ul>
                                {Object.entries(validationErrors).map(([field, error]) => (
                                    <li key={field} className="validation-error">
                                        {error}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Кнопки управления */}
                    <div className="modal-actions">
                        <button 
                            type="button"
                            className="cancel-btn"
                            onClick={handleClose}
                            disabled={isLoading}
                        >
                            ❌ Отмена
                        </button>
                        <button 
                            type="submit"
                            className="confirm-btn"
                            disabled={isLoading || hasValidationErrors}
                        >
                            {isLoading ? '⏳ Сохранение...' : '💾 Сохранить результат'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MatchResultModal; 
