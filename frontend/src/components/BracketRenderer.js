// frontend/src/components/BracketRenderer.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './BracketRenderer.css';
import { safeParseBracketId } from '../utils/safeParseInt';

const BracketRenderer = ({
    games,
    canEditMatches,
    selectedMatch,
    setSelectedMatch,
    handleTeamClick,
    format,
    onMatchClick
}) => {
    console.log('BracketRenderer: Инициализация с параметрами', { 
        gamesCount: games?.length, 
        canEditMatches, 
        selectedMatch, 
        format 
    });

    // Состояния для масштабирования и позиционирования
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startDragPos, setStartDragPos] = useState({ x: 0, y: 0 });
    const [groupedMatches, setGroupedMatches] = useState({ winnerRounds: {}, loserRounds: {}, placementMatch: null, grandFinalMatch: null });
    const [dataError, setDataError] = useState(null);
    // 🆕 Состояние для показа тултипа о неполном матче
    const [incompleteMatchTooltip, setIncompleteMatchTooltip] = useState({ show: false, message: '', x: 0, y: 0 });

    // Ссылки для работы с DOM
    const wrapperRef = useRef(null);
    const bracketContentRef = useRef(null);
    
    // Refs для отслеживания состояния в обработчиках событий
    const isDraggingRef = useRef(false);
    const positionRef = useRef({ x: 0, y: 0 });
    const startDragPosRef = useRef({ x: 0, y: 0 });
    const scaleRef = useRef(1);
    
    // Обновляем refs при изменении состояний
    useEffect(() => {
        isDraggingRef.current = isDragging;
    }, [isDragging]);
    
    useEffect(() => {
        positionRef.current = position;
    }, [position]);
    
    useEffect(() => {
        startDragPosRef.current = startDragPos;
    }, [startDragPos]);
    
    useEffect(() => {
        scaleRef.current = scale;
    }, [scale]);
    
    // Группировка матчей по раундам и сеткам
    const groupMatchesByRoundAndBracket = useCallback(() => {
        let result = { winnerRounds: {}, loserRounds: {}, placementMatch: null, grandFinalMatch: null };
        
        if (!games || !Array.isArray(games) || games.length === 0) {
            console.log('BracketRenderer: пустой массив games или он не определен', games);
            return result;
        }
        
        console.log('BracketRenderer: Группировка матчей, количество:', games.length);
        console.log('BracketRenderer: Структура первого матча:', games[0]);
        
        try {
            // Проверяем валидность игр
            const validGames = games.filter(game => {
                const isValid = game && 
                game.id !== undefined && 
                Array.isArray(game.participants) && 
                    game.participants.length >= 2;
                
                if (!isValid) {
                    console.warn('BracketRenderer: Невалидная игра:', game);
                }
                return isValid;
            });
            
            if (validGames.length === 0) {
                console.error('BracketRenderer: нет валидных матчей для группировки');
                setDataError('Нет валидных матчей для отображения');
                return result;
            }
            
            if (validGames.length !== games.length) {
                console.warn(`BracketRenderer: Обнаружены невалидные матчи: ${games.length - validGames.length} из ${games.length}`);
            }
            
            // Группируем матчи
            const winnerMatches = validGames.filter(
                (m) => (m.bracket_type === 'winner' || m.bracket_type === 'prelim' || !m.bracket_type) && !m.is_third_place_match
            ) || [];
            const loserMatches = validGames.filter((m) => m.bracket_type === 'loser' && !m.is_third_place_match) || [];
            const placementMatch = validGames.find((m) => m.bracket_type === 'placement' || m.is_third_place_match);
            const grandFinalMatch = validGames.find((m) => m.bracket_type === 'grand_final');

            // 🔧 ДЕТАЛЬНАЯ ОТЛАДКА ГРУППИРОВКИ
            console.log('🔍 Детальная диагностика группировки матчей:', {
                totalValidGames: validGames.length,
                winnerMatchesCount: winnerMatches.length,
                loserMatchesCount: loserMatches.length,
                sampleWinnerMatch: winnerMatches[0] || null,
                allBracketTypes: validGames.map(m => m.bracket_type),
                allRounds: validGames.map(m => m.round),
                winnerRounds: winnerMatches.map(m => ({ id: m.id, round: m.round, bracket_type: m.bracket_type }))
            });

            // 🔧 ИСПРАВЛЕННАЯ ЛОГИКА: учитываем отрицательные раунды
            const winnerRounds = {};
            
            // Сначала находим все уникальные раунды в winner матчах
            const allWinnerRounds = [...new Set(winnerMatches.map(m => Number(m.round)))];
            console.log('🔍 Все раунды в winner матчах:', allWinnerRounds);
            
            // Группируем по всем найденным раундам
            allWinnerRounds.forEach(round => {
                const roundMatches = winnerMatches.filter(m => Number(m.round) === round);
                if (roundMatches && roundMatches.length > 0) {
                    roundMatches.sort((a, b) => Number(a.match_number || 0) - Number(b.match_number || 0));
                    winnerRounds[round] = roundMatches;
                    console.log(`✅ Раунд ${round}: добавлено ${roundMatches.length} матчей`);
                }
            });

            // Группируем loser rounds с проверкой на пустые массивы
            const loserRounds = {};
            const maxLoserRound = (loserMatches && loserMatches.length > 0) ? 
                Math.max(...loserMatches.map(m => Number(m.round))) : 0;
            
            for (let round = 1; round <= maxLoserRound; round++) {
                const roundMatches = loserMatches.filter(m => Number(m.round) === round);
                if (roundMatches && roundMatches.length > 0) {
                    roundMatches.sort((a, b) => Number(a.match_number || 0) - Number(b.match_number || 0));
                    loserRounds[round] = roundMatches;
                }
            }

            result = { winnerRounds, loserRounds, placementMatch, grandFinalMatch };
            console.log('BracketRenderer: Группировка завершена:', {
                winnerRoundsCount: Object.keys(winnerRounds).length,
                loserRoundsCount: Object.keys(loserRounds).length,
                hasPlacement: !!placementMatch,
                hasGrandFinal: !!grandFinalMatch
            });

            // Сбрасываем ошибку, если группировка прошла успешно
            setDataError(null);

        } catch (error) {
            console.error('BracketRenderer: Ошибка при группировке матчей:', error);
            setDataError('Ошибка при обработке данных матчей');
        }
        
        return result;
    }, [games]);
    
    // Сброс вида
    const resetView = useCallback(() => {
        console.log('BracketRenderer: resetView');
        setPosition({ x: 20, y: 20 });
        setScale(1);
    }, []);
    
    // Функции для кнопок управления (упрощенные, без лишних зависимостей)
    const handleZoomIn = () => {
        console.log('handleZoomIn: увеличиваем масштаб');
        setScale(prevScale => Math.min(prevScale + 0.1, 3));
    };
    
    const handleZoomOut = () => {
        console.log('handleZoomOut: уменьшаем масштаб');
        setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
    };
    
    const handleResetView = () => {
        console.log('handleResetView: сбрасываем вид');
        resetView();
    };

    // Функция для открытия сетки в отдельной вкладке
    const handleOpenInNewTab = () => {
        const currentGroupedMatches = groupedMatches || { winnerRounds: {}, loserRounds: {}, placementMatch: null, grandFinalMatch: null };
        
        const bracketData = {
            games: games || [],
            format: format || 'single_elimination',
            groupedMatches: currentGroupedMatches
        };
        
        const html = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Турнирная сетка</title>
            <style>
                body, html { margin: 0; padding: 0; font-family: Arial, sans-serif; }
                .bracket-container { padding: 20px; }
                .bracket-grid { display: flex; gap: 20px; align-items: center; }
                .round-column { display: flex; flex-direction: column; gap: 10px; }
                .match-card { width: 200px; background: white; border: 1px solid #ddd; border-radius: 4px; padding: 10px; }
                .team { display: flex; justify-content: space-between; padding: 5px 0; }
                .winner { font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="bracket-container">
                <h1>Турнирная сетка</h1>
                <div id="bracket-content"></div>
            </div>
            <script>
                const data = ${JSON.stringify(bracketData)};
                function render() {
                    let html = '';
                    if (data.groupedMatches.winnerRounds) {
                        html += '<h2>Основная сетка</h2><div class="bracket-grid">';
                        Object.keys(data.groupedMatches.winnerRounds).sort((a, b) => Number(a) - Number(b)).forEach(round => {
                            html += '<div class="round-column"><h3>' + (round === '-1' ? 'Предварительный' : 'Раунд ' + round) + '</h3>';
                            data.groupedMatches.winnerRounds[round].forEach(match => {
                                html += '<div class="match-card">';
                                if (match.participants) {
                                    match.participants.forEach(p => {
                                        html += '<div class="team' + (p.isWinner ? ' winner' : '') + '"><span>' + (p.name || 'TBD') + '</span><span>' + (p.score || 0) + '</span></div>';
                                    });
                                }
                                html += '</div>';
                            });
                            html += '</div>';
                        });
                        html += '</div>';
                    }
                    document.getElementById('bracket-content').innerHTML = html;
                }
                window.onload = render;
            </script>
        </body>
        </html>`;
        
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    };

    // БЕЗОПАСНАЯ ИНИЦИАЛИЗАЦИЯ DRAG-AND-DROP С ПРОВЕРКАМИ
    useEffect(() => {
        console.log('BracketRenderer: 🚀 Запуск инициализации drag-and-drop');
        
        // Функция безопасной инициализации с повторными попытками
        const initializeDragAndDrop = () => {
            const wrapper = wrapperRef.current;
            if (!wrapper) {
                console.warn('BracketRenderer: ⚠️ wrapperRef еще не готов, попробуем через 100ms');
                return false;
            }
                
            console.log('BracketRenderer: ✅ DOM элемент найден, инициализируем drag-and-drop');
            
            // Устанавливаем базовые стили
            wrapper.style.cursor = 'grab';
            wrapper.style.userSelect = 'none';
            wrapper.style.touchAction = 'none';
            
            // Устанавливаем адаптивную высоту
            const setResponsiveHeight = () => {
                const windowHeight = window.innerHeight;
                if (window.innerWidth < 768) {
                    wrapper.style.height = `${windowHeight - 100}px`;
                } else if (window.innerWidth >= 1028) {
                    wrapper.style.height = '800px';
                } else {
                    wrapper.style.height = '600px';
                }
            };
            setResponsiveHeight();
            
            console.log('BracketRenderer: 📏 Адаптивная высота установлена');

            // СОЗДАЕМ ОБРАБОТЧИКИ СОБЫТИЙ С ИСПРАВЛЕННОЙ ЛОГИКОЙ
            const mouseDownHandler = (e) => {
                console.log('BracketRenderer: 🖱️ mousedown событие');
                
                // Только левая кнопка мыши
                if (e.button !== 0) return;
                
                // ИСПРАВЛЕННАЯ ЛОГИКА ИСКЛЮЧЕНИЙ:
                const isControlButton = e.target.closest('.bracket-controls button');
                const isMatchViewBlock = e.target.closest('.match-view-block');
                
                if (isControlButton || isMatchViewBlock) {
                    console.log('BracketRenderer: ⚠️ Клик по кнопке управления, пропускаем перетаскивание');
                    return;
                }
                
                console.log('BracketRenderer: ✅ mousedown разрешен, начинаем перетаскивание');
                
                // Устанавливаем состояние перетаскивания
                isDraggingRef.current = true;
                setIsDragging(true);
                
                const newStartPos = {
                    x: e.clientX - positionRef.current.x,
                    y: e.clientY - positionRef.current.y,
                };
                startDragPosRef.current = newStartPos;
                setStartDragPos(newStartPos);
                
                wrapper.style.cursor = 'grabbing';
                
                console.log('BracketRenderer: 🎯 Перетаскивание активировано:', {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    currentPosition: positionRef.current,
                    startPos: newStartPos
                });
                
                e.preventDefault();
                e.stopPropagation();
            };

            const mouseMoveHandler = (e) => {
                if (!isDraggingRef.current) return;
                
                const newPosition = {
                    x: e.clientX - startDragPosRef.current.x,
                    y: e.clientY - startDragPosRef.current.y,
                };
                
                // Синхронно обновляем и ref и state
                positionRef.current = newPosition;
                setPosition(newPosition);
                
                console.log('BracketRenderer: 🔄 Перетаскивание:', newPosition);
                e.preventDefault();
            };

            const mouseUpHandler = (e) => {
                if (isDraggingRef.current) {
                    console.log('BracketRenderer: 🎯 Завершение перетаскивания');
                    isDraggingRef.current = false;
                    setIsDragging(false);
                    wrapper.style.cursor = 'grab';
                }
            };

            const wheelHandler = (e) => {
                console.log('BracketRenderer: 🔄 Масштабирование колесом');
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                const newScale = Math.max(0.5, Math.min(3, scaleRef.current + delta));
                scaleRef.current = newScale;
                setScale(newScale);
                console.log('BracketRenderer: 📏 Новый масштаб:', newScale);
            };

            // TOUCH СОБЫТИЯ ДЛЯ МОБИЛЬНЫХ УСТРОЙСТВ
            const touchStartHandler = (e) => {
                if (e.touches.length === 1) {
                    const touch = e.touches[0];
                    console.log('BracketRenderer: 📱 Touch start');
                    
                    isDraggingRef.current = true;
                    setIsDragging(true);
                    
                    const newStartPos = {
                        x: touch.clientX - positionRef.current.x,
                        y: touch.clientY - positionRef.current.y,
                    };
                    startDragPosRef.current = newStartPos;
                    setStartDragPos(newStartPos);
                    
                    console.log('BracketRenderer: 📱 Touch перетаскивание активировано');
                }
                e.preventDefault();
            };

            const touchMoveHandler = (e) => {
                if (!isDraggingRef.current || e.touches.length !== 1) return;
                
                const touch = e.touches[0];
                const newPosition = {
                    x: touch.clientX - startDragPosRef.current.x,
                    y: touch.clientY - startDragPosRef.current.y,
                };
                
                positionRef.current = newPosition;
                setPosition(newPosition);
                
                console.log('BracketRenderer: 📱 Touch move:', newPosition);
                e.preventDefault();
            };

            const touchEndHandler = () => {
                if (isDraggingRef.current) {
                    console.log('BracketRenderer: 📱 Touch end');
                    isDraggingRef.current = false;
                    setIsDragging(false);
                }
            };

            // ПРИВЯЗЫВАЕМ ВСЕ ОБРАБОТЧИКИ
            wrapper.addEventListener('mousedown', mouseDownHandler, { passive: false });
            document.addEventListener('mousemove', mouseMoveHandler, { passive: false });
            document.addEventListener('mouseup', mouseUpHandler, { passive: false });
            wrapper.addEventListener('wheel', wheelHandler, { passive: false });
            wrapper.addEventListener('touchstart', touchStartHandler, { passive: false });
            document.addEventListener('touchmove', touchMoveHandler, { passive: false });
            document.addEventListener('touchend', touchEndHandler, { passive: false });
            window.addEventListener('resize', setResponsiveHeight);
            
            console.log('BracketRenderer: ✅ Все обработчики событий успешно привязаны');
            console.log('BracketRenderer: 🎯 Система перетаскивания полностью готова к работе');
            
            // Возвращаем функцию очистки
            return () => {
                console.log('BracketRenderer: 🧹 Очистка обработчиков событий');
                if (wrapper) {
                    wrapper.removeEventListener('mousedown', mouseDownHandler);
                    wrapper.removeEventListener('wheel', wheelHandler);
                    wrapper.removeEventListener('touchstart', touchStartHandler);
                }
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                document.removeEventListener('touchmove', touchMoveHandler);
                document.removeEventListener('touchend', touchEndHandler);
                window.removeEventListener('resize', setResponsiveHeight);
            };
        };
        
        // Пробуем инициализацию сразу
        const cleanup = initializeDragAndDrop();
        
        // Если не удалось, пробуем через small delay
        if (!cleanup) {
            console.log('BracketRenderer: ⏱️ Первая попытка неудачна, повторяем через 100ms');
            const timeoutId = setTimeout(() => {
                const delayedCleanup = initializeDragAndDrop();
                if (!delayedCleanup) {
                    console.error('BracketRenderer: ❌ Не удалось инициализировать drag-and-drop после повторной попытки');
                }
            }, 100);
            
            return () => {
                clearTimeout(timeoutId);
            };
        }
        
        return cleanup;
    }, []); // БЕЗ ЗАВИСИМОСТЕЙ для предотвращения циклов

    // Обновление сгруппированных матчей при изменении games
    useEffect(() => {
        console.log('BracketRenderer: обновление группировки матчей');
        
        try {
            const grouped = groupMatchesByRoundAndBracket();
            setGroupedMatches(grouped);
            
            // Проверяем результат
            const hasAnyMatches = 
                Object.keys(grouped.winnerRounds).length > 0 || 
                Object.keys(grouped.loserRounds).length > 0 || 
                grouped.placementMatch || 
                grouped.grandFinalMatch;
                
            if (!hasAnyMatches) {
                console.log('BracketRenderer: нет матчей для отображения после группировки');
            }
        } catch (error) {
            console.error('BracketRenderer: ошибка при обновлении группировки:', error);
            setDataError('Ошибка при обработке данных матчей');
        }
    }, [groupMatchesByRoundAndBracket]); // Контролируемая зависимость

    // Защитная проверка входных данных
    useEffect(() => {
        try {
            if (!games || !Array.isArray(games)) {
                console.error('BracketRenderer: games не является массивом или не определен', games);
                setDataError('Ошибка: Неверный формат данных для отображения сетки.');
                return;
            }
            
            // Если есть games, но они не валидные, даем детальную информацию
            if (games.length === 0) {
                console.log('BracketRenderer: массив games пустой');
                setDataError(null); // Пустой массив - не ошибка
                return;
            }
            
            // Проверяем структуру первого элемента для диагностики
            const firstGame = games[0];
            if (!firstGame || !firstGame.id || !Array.isArray(firstGame.participants)) {
                console.error('BracketRenderer: некорректная структура данных игры:', firstGame);
                setDataError('Ошибка: Некорректные данные матчей. Попробуйте обновить страницу.');
                return;
            }
            
            // Если все проверки прошли успешно, сбрасываем ошибку
            setDataError(null);
        } catch (error) {
            console.error('BracketRenderer: ошибка при валидации входных данных', error);
            setDataError('Произошла ошибка при обработке данных турнирной сетки.');
        }
    }, [games]); // Только games в зависимостях

    // 🆕 Функция проверки заполненности матча
    const isMatchIncomplete = useCallback((match) => {
        if (!match.participants || match.participants.length < 2) {
            return true;
        }
        return match.participants.some(participant => 
            !participant || !participant.name || participant.name === 'TBD'
        );
    }, []);

    // 🆕 Функция показа тултипа о неполном матче
    const showIncompleteMatchTooltip = useCallback((event, message = 'Не все участники матча определены') => {
        const rect = event.currentTarget.getBoundingClientRect();
        setIncompleteMatchTooltip({
            show: true,
            message,
            x: rect.left + rect.width / 2,
            y: rect.top - 10
        });
        
        // Автоматически скрываем тултип через 3 секунды
        setTimeout(() => {
            setIncompleteMatchTooltip(prev => ({ ...prev, show: false }));
        }, 3000);
    }, []);

    // 🆕 Обработчик клика по матчу с проверкой заполненности
    const handleMatchClick = useCallback((match, event) => {
        if (!onMatchClick || !match.id) return;

        // Проверяем заполненность матча
        if (isMatchIncomplete(match)) {
            showIncompleteMatchTooltip(event);
            return;
        }

        // Если матч заполнен, открываем модальное окно
        onMatchClick(match);
    }, [onMatchClick, isMatchIncomplete, showIncompleteMatchTooltip]);

    // Рендеринг ошибки данных, если она есть
    if (dataError) {
        return (
            <div className="empty-bracket-message">
                <h3>⚠️ Проблема с данными</h3>
                <p>{dataError}</p>
                <button onClick={() => window.location.reload()}>
                    🔄 Обновить страницу
                </button>
            </div>
        );
    }

    // Если нет данных для отображения, показываем сообщение
    if (!games || !Array.isArray(games) || games.length === 0) {
        console.log('BracketRenderer: пустой массив games или он не определен', games);
        return <div className="empty-bracket-message">Нет доступных матчей для отображения.</div>;
    }

    const { winnerRounds, loserRounds, placementMatch, grandFinalMatch } = groupedMatches || {};
    console.log('BracketRenderer: группировка матчей завершена', { 
        winnerRoundsKeys: winnerRounds ? Object.keys(winnerRounds) : [], 
        loserRoundsKeys: loserRounds ? Object.keys(loserRounds) : [],  
        hasPlacementMatch: !!placementMatch, 
        hasGrandFinalMatch: !!grandFinalMatch 
    });
    
    const winnerRoundKeys = winnerRounds ? Object.keys(winnerRounds) : [];
    const hasWinnerMatches = winnerRoundKeys.length > 0 || 
                            (loserRounds && Object.keys(loserRounds).length > 0) || 
                            placementMatch || 
                            grandFinalMatch;

    if (!hasWinnerMatches) {
        console.log('BracketRenderer: нет матчей для отображения после группировки');
        return <div className="empty-bracket-message">Нет доступных матчей для отображения.</div>;
    }

    return (
        // Внешний контейнер для обработчиков и overflow
        <div
            ref={wrapperRef}
            className={`bracket-renderer-wrapper ${isDragging ? 'dragging' : ''}`}
        >
            {/* Контролы масштабирования */}
            <div className="bracket-controls">
                <button onClick={handleZoomIn} title="Увеличить">+</button>
                <button onClick={handleZoomOut} title="Уменьшить">-</button>
                <button onClick={handleResetView} title="Сбросить вид">↺</button>
                <button onClick={handleOpenInNewTab} title="Открыть в отдельной вкладке">
                    ↗
                </button>
            </div>

            {/* Внутренний контейнер для трансформации */}
            <div
                ref={bracketContentRef}
                className="bracket-renderer-content"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: '0 0'
                }}
            >
                {/* Верхняя сетка (Winners Bracket) */}
                <div className="bracket winners-bracket">
                    <h2 className="bracket-title">Основная сетка</h2>
                    <div className="bracket-grid">
                        {(winnerRoundKeys || []).sort((a, b) => Number(a) - Number(b)).map((round) => {
                            const roundMatches = winnerRounds && winnerRounds[round] ? winnerRounds[round] : [];
                            if (!roundMatches || roundMatches.length === 0) {
                                console.log(`BracketRenderer: 🚫 Раунд ${round} пуст, пропускаем рендеринг`);
                                return null;
                            }

                            console.log(`BracketRenderer: ✅ Рендерим раунд ${round} с ${roundMatches.length} матчами`);

                            return (
                                <div key={`w-${round}`} className="round-column">
                                    <h3>
                                        {round === '-1'
                                            ? 'Предварительный'
                                            : `Раунд ${round}`}
                                    </h3>
                                    {(roundMatches || []).map((match) => {
                                        const isSelected = selectedMatch === safeParseBracketId(match.id);
                                        const isCompleted = match.state === 'DONE';
                                        
                                        // 🏆 Определяем классы для команд-победителей и проигравших
                                        const team1Classes = ['custom-seed'];
                                        const team2Classes = ['custom-seed'];
                                        
                                        if (isSelected) {
                                            team1Classes.push('selected');
                                            team2Classes.push('selected');
                                        }
                                        
                                        if (isCompleted && match.participants) {
                                            const participant1 = match.participants[0];
                                            const participant2 = match.participants[1];
                                            
                                            if (participant1?.isWinner) {
                                                team1Classes.push('winner');
                                            } else if (participant1 && !participant1.isWinner) {
                                                team1Classes.push('loser');
                                            }
                                            
                                            if (participant2?.isWinner) {
                                                team2Classes.push('winner');
                                            } else if (participant2 && !participant2.isWinner) {
                                                team2Classes.push('loser');
                                            }
                                        }
                                        
                                        return (
                                            <div key={match.id} className={`match-container ${isCompleted ? 'completed' : ''}`}>
                                                <div className="match-content">
                                                    <div
                                                        className={team1Classes.join(' ')}
                                                        onClick={(e) => {
                                                            // 🔧 ИСПРАВЛЕНИЕ: Проверяем заполненность матча перед открытием деталей
                                                            if (onMatchClick && match.id) {
                                                                handleMatchClick(match, e);
                                                            }
                                                            // Сохраняем поведение для выбора победителя только для незавершенных матчей
                                                            else if (canEditMatches && match.state !== 'DONE') {
                                                                setSelectedMatch(isSelected ? null : safeParseBracketId(match.id));
                                                                // Добавляем вызов handleTeamClick, передавая ID команды и ID матча
                                                                if (handleTeamClick && !isSelected && match.participants[0]?.id) {
                                                                    handleTeamClick(match.participants[0].id, match.id);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        {match.participants[0]?.avatarUrl && (
                                                            <div className="team-avatar">
                                                                <img 
                                                                    src={match.participants[0].avatarUrl} 
                                                                    alt={`${match.participants[0]?.name || 'TBD'}`}
                                                                    onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                                />
                                                            </div>
                                                        )}
                                                        <span className={`team-name${!match.participants[0]?.name ? ' placeholder' : ''}`}>{match.participants[0]?.name?.slice(0, 20) || 'TBD'}</span>
                                                        <span className="team-score">
                                                            {match.participants[0]?.score ?? '-'}
                                                        </span>
                                                    </div>
                                                    <div
                                                        className={team2Classes.join(' ')}
                                                        onClick={(e) => {
                                                            // 🔧 ИСПРАВЛЕНИЕ: Проверяем заполненность матча перед открытием деталей
                                                            if (onMatchClick && match.id) {
                                                                handleMatchClick(match, e);
                                                            }
                                                            // Сохраняем поведение для выбора победителя только для незавершенных матчей
                                                            else if (canEditMatches && match.state !== 'DONE') {
                                                                setSelectedMatch(isSelected ? null : safeParseBracketId(match.id));
                                                                // Добавляем вызов handleTeamClick, передавая ID команды и ID матча
                                                                if (handleTeamClick && !isSelected && match.participants[1]?.id) {
                                                                    handleTeamClick(match.participants[1].id, match.id);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        {match.participants[1]?.avatarUrl && (
                                                            <div className="team-avatar">
                                                                <img 
                                                                    src={match.participants[1].avatarUrl} 
                                                                    alt={`${match.participants[1]?.name || 'TBD'}`}
                                                                    onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                                />
                                                            </div>
                                                        )}
                                                        <span className={`team-name${!match.participants[1]?.name ? ' placeholder' : ''}`}>{match.participants[1]?.name?.slice(0, 20) || 'TBD'}</span>
                                                        <span className="team-score">
                                                            {match.participants[1]?.score ?? '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* 🔧 ИСПРАВЛЕНИЕ: Показываем кнопку просмотра для всех матчей */}
                                                {onMatchClick && (
                                                    <div className="edit-match-btn-container">
                                                        <button 
                                                            className="edit-match-btn"
                                                            onClick={(e) => {
                                                                handleMatchClick(match, e);
                                                            }}
                                                            title="Просмотреть/редактировать результат"
                                                        >
                                                            🔍
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Разделительная граница и нижняя сетка (только для Double Elimination) */}
                {format === 'double_elimination' && loserRounds && Object.keys(loserRounds).length > 0 && (
                    <>
                        <hr className="bracket-divider" />
                        <div className="bracket losers-bracket">
                            <h2 className="bracket-title">Нижняя сетка</h2>
                            <div className="bracket-grid">
                                {Object.keys(loserRounds).sort((a, b) => Number(a) - Number(b)).map((round) => {
                                    const roundMatches = loserRounds[round];
                                    return roundMatches && roundMatches.length > 0 ? (
                                        <div key={`l-${round}`} className="round-column">
                                            <h3>Раунд {round}</h3>
                                            {roundMatches.map((match) => {
                                                const isSelected = selectedMatch === safeParseBracketId(match.id);
                                                const isCompleted = match.state === 'DONE';
                                                
                                                // 🏆 Определяем классы для команд-победителей и проигравших
                                                const team1Classes = ['custom-seed'];
                                                const team2Classes = ['custom-seed'];
                                                
                                                if (isSelected) {
                                                    team1Classes.push('selected');
                                                    team2Classes.push('selected');
                                                }
                                                
                                                if (isCompleted && match.participants) {
                                                    const participant1 = match.participants[0];
                                                    const participant2 = match.participants[1];
                                                    
                                                    if (participant1?.isWinner) {
                                                        team1Classes.push('winner');
                                                    } else if (participant1 && !participant1.isWinner) {
                                                        team1Classes.push('loser');
                                                    }
                                                    
                                                    if (participant2?.isWinner) {
                                                        team2Classes.push('winner');
                                                    } else if (participant2 && !participant2.isWinner) {
                                                        team2Classes.push('loser');
                                                    }
                                                }
                                                
                                                return (
                                                    <div key={match.id} className={`match-container ${isCompleted ? 'completed' : ''}`}>
                                                        <div className="match-content">
                                                            <div
                                                                className={team1Classes.join(' ')}
                                                                onClick={(e) => {
                                                                    // 🔧 ИСПРАВЛЕНИЕ: Проверяем заполненность матча перед открытием деталей
                                                                    if (onMatchClick && match.id) {
                                                                        handleMatchClick(match, e);
                                                                    }
                                                                    // Сохраняем поведение для выбора победителя только для незавершенных матчей
                                                                    else if (canEditMatches && match.state !== 'DONE') {
                                                                        setSelectedMatch(isSelected ? null : safeParseBracketId(match.id));
                                                                        // Добавляем вызов handleTeamClick, передавая ID команды и ID матча
                                                                        if (handleTeamClick && !isSelected && match.participants[0]?.id) {
                                                                            handleTeamClick(match.participants[0].id, match.id);
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                {match.participants[0]?.avatarUrl && (
                                                                    <div className="team-avatar">
                                                                        <img 
                                                                            src={match.participants[0].avatarUrl} 
                                                                            alt={`${match.participants[0]?.name || 'TBD'}`}
                                                                            onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                                        />
                                                                    </div>
                                                                )}
                                                                <span className={`team-name${!match.participants[0]?.name ? ' placeholder' : ''}`}>{match.participants[0]?.name?.slice(0, 20) || 'TBD'}</span>
                                                                <span className="team-score">
                                                                    {match.participants[0]?.score ?? '-'}
                                                                </span>
                                                            </div>
                                                            <div
                                                                className={team2Classes.join(' ')}
                                                                onClick={(e) => {
                                                                    // 🔧 ИСПРАВЛЕНИЕ: Проверяем заполненность матча перед открытием деталей
                                                                    if (onMatchClick && match.id) {
                                                                        handleMatchClick(match, e);
                                                                    }
                                                                    // Сохраняем поведение для выбора победителя только для незавершенных матчей
                                                                    else if (canEditMatches && match.state !== 'DONE') {
                                                                        setSelectedMatch(isSelected ? null : safeParseBracketId(match.id));
                                                                        // Добавляем вызов handleTeamClick, передавая ID команды и ID матча
                                                                        if (handleTeamClick && !isSelected && match.participants[1]?.id) {
                                                                            handleTeamClick(match.participants[1].id, match.id);
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                {match.participants[1]?.avatarUrl && (
                                                                    <div className="team-avatar">
                                                                        <img 
                                                                            src={match.participants[1].avatarUrl} 
                                                                            alt={`${match.participants[1]?.name || 'TBD'}`}
                                                                            onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                                        />
                                                                    </div>
                                                                )}
                                                                <span className={`team-name${!match.participants[1]?.name ? ' placeholder' : ''}`}>{match.participants[1]?.name?.slice(0, 20) || 'TBD'}</span>
                                                                <span className="team-score">
                                                                    {match.participants[1]?.score ?? '-'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {/* 🔧 ИСПРАВЛЕНИЕ: Показываем кнопку просмотра для всех матчей */}
                                                        {onMatchClick && (
                                                            <div className="edit-match-btn-container">
                                                                <button 
                                                                    className="edit-match-btn"
                                                                    onClick={(e) => {
                                                                        handleMatchClick(match, e);
                                                                    }}
                                                                    title="Просмотреть/редактировать результат"
                                                                >
                                                                    🔍
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* Матч за 3-е место и гранд-финал */}
                {(placementMatch || grandFinalMatch) && 
                    <>
                        <hr className="bracket-divider" />
                        <div className="final-matches-container">
                            <h2 className="bracket-title">Финальные матчи</h2>
                            <div className="final-matches-grid">
                                {grandFinalMatch && (
                                    <div className="bracket grand-final">
                                        <h3 className="match-title">Большой финал</h3>
                                        <div className={`match-container ${grandFinalMatch.state === 'DONE' ? 'completed' : ''}`}>
                                            <div className="match-content">
                                                {(() => {
                                                    // 🏆 Определяем классы для команд-победителей и проигравших в гранд-финале
                                                    const isSelected = selectedMatch === safeParseBracketId(grandFinalMatch.id);
                                                    const isCompleted = grandFinalMatch.state === 'DONE';
                                                    
                                                    const team1Classes = ['custom-seed'];
                                                    const team2Classes = ['custom-seed'];
                                                    
                                                    if (isSelected) {
                                                        team1Classes.push('selected');
                                                        team2Classes.push('selected');
                                                    }
                                                    
                                                    if (isCompleted && grandFinalMatch.participants) {
                                                        const participant1 = grandFinalMatch.participants[0];
                                                        const participant2 = grandFinalMatch.participants[1];
                                                        
                                                        if (participant1?.isWinner) {
                                                            team1Classes.push('winner');
                                                        } else if (participant1 && !participant1.isWinner) {
                                                            team1Classes.push('loser');
                                                        }
                                                        
                                                        if (participant2?.isWinner) {
                                                            team2Classes.push('winner');
                                                        } else if (participant2 && !participant2.isWinner) {
                                                            team2Classes.push('loser');
                                                        }
                                                    }
                                                    
                                                    return (
                                                        <>
                                                            <div
                                                                className={team1Classes.join(' ')}
                                                                onClick={(e) => {
                                                                    // 🔧 ИСПРАВЛЕНИЕ: Проверяем заполненность матча перед открытием деталей
                                                                    if (onMatchClick && grandFinalMatch.id) {
                                                                        handleMatchClick(grandFinalMatch, e);
                                                                    }
                                                                    // Сохраняем поведение для выбора победителя только для незавершенных матчей
                                                                    else if (canEditMatches && grandFinalMatch.state !== 'DONE') {
                                                                        setSelectedMatch(selectedMatch === safeParseBracketId(grandFinalMatch.id) ? null : safeParseBracketId(grandFinalMatch.id));
                                                                        // Добавляем вызов handleTeamClick
                                                                        if (handleTeamClick && selectedMatch !== safeParseBracketId(grandFinalMatch.id) && grandFinalMatch.participants[0]?.id) {
                                                                            handleTeamClick(grandFinalMatch.participants[0].id, grandFinalMatch.id);
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                {grandFinalMatch.participants[0]?.avatarUrl && (
                                                                    <div className="team-avatar">
                                                                        <img 
                                                                            src={grandFinalMatch.participants[0].avatarUrl} 
                                                                            alt={`${grandFinalMatch.participants[0]?.name || 'TBD'}`}
                                                                            onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                                        />
                                                                    </div>
                                                                )}
                                                                <span className={`team-name${!grandFinalMatch.participants[0]?.name ? ' placeholder' : ''}`}>{grandFinalMatch.participants[0]?.name?.slice(0, 20) || 'TBD'}</span>
                                                                <span className="team-score">
                                                                    {grandFinalMatch.participants[0]?.score ?? '-'}
                                                                </span>
                                                            </div>
                                                            <div
                                                                className={team2Classes.join(' ')}
                                                                onClick={(e) => {
                                                                    // 🔧 ИСПРАВЛЕНИЕ: Проверяем заполненность матча перед открытием деталей
                                                                    if (onMatchClick && grandFinalMatch.id) {
                                                                        handleMatchClick(grandFinalMatch, e);
                                                                    }
                                                                    // Сохраняем поведение для выбора победителя только для незавершенных матчей
                                                                    else if (canEditMatches && grandFinalMatch.state !== 'DONE') {
                                                                        setSelectedMatch(selectedMatch === safeParseBracketId(grandFinalMatch.id) ? null : safeParseBracketId(grandFinalMatch.id));
                                                                        // Добавляем вызов handleTeamClick
                                                                        if (handleTeamClick && selectedMatch !== safeParseBracketId(grandFinalMatch.id) && grandFinalMatch.participants[1]?.id) {
                                                                            handleTeamClick(grandFinalMatch.participants[1].id, grandFinalMatch.id);
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                {grandFinalMatch.participants[1]?.avatarUrl && (
                                                                    <div className="team-avatar">
                                                                        <img 
                                                                            src={grandFinalMatch.participants[1].avatarUrl} 
                                                                            alt={`${grandFinalMatch.participants[1]?.name || 'TBD'}`}
                                                                            onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                                        />
                                                                    </div>
                                                                )}
                                                                <span className={`team-name${!grandFinalMatch.participants[1]?.name ? ' placeholder' : ''}`}>{grandFinalMatch.participants[1]?.name?.slice(0, 20) || 'TBD'}</span>
                                                                <span className="team-score">
                                                                    {grandFinalMatch.participants[1]?.score ?? '-'}
                                                                </span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            {/* 🔧 ИСПРАВЛЕНИЕ: Показываем кнопку просмотра для всех матчей */}
                                            {onMatchClick && (
                                                <div className="edit-match-btn-container">
                                                    <button 
                                                        className="edit-match-btn"
                                                        onClick={(e) => {
                                                            handleMatchClick(grandFinalMatch, e);
                                                        }}
                                                        title="Просмотреть/редактировать результат"
                                                    >
                                                        🔍
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {placementMatch && (
                                    <div className="bracket placement-match">
                                        <h3 className="match-title">Матч за 3-е место</h3>
                                        <div className={`match-container ${placementMatch.state === 'DONE' ? 'completed' : ''}`}>
                                            <div className="match-content">
                                                {(() => {
                                                    // 🏆 Определяем классы для команд-победителей и проигравших в матче за 3-е место
                                                    const isSelected = selectedMatch === safeParseBracketId(placementMatch.id);
                                                    const isCompleted = placementMatch.state === 'DONE';
                                                    
                                                    const team1Classes = ['custom-seed'];
                                                    const team2Classes = ['custom-seed'];
                                                    
                                                    if (isSelected) {
                                                        team1Classes.push('selected');
                                                        team2Classes.push('selected');
                                                    }
                                                    
                                                    if (isCompleted && placementMatch.participants) {
                                                        const participant1 = placementMatch.participants[0];
                                                        const participant2 = placementMatch.participants[1];
                                                        
                                                        if (participant1?.isWinner) {
                                                            team1Classes.push('winner');
                                                        } else if (participant1 && !participant1.isWinner) {
                                                            team1Classes.push('loser');
                                                        }
                                                        
                                                        if (participant2?.isWinner) {
                                                            team2Classes.push('winner');
                                                        } else if (participant2 && !participant2.isWinner) {
                                                            team2Classes.push('loser');
                                                        }
                                                    }
                                                    
                                                    return (
                                                        <>
                                                            <div
                                                                className={team1Classes.join(' ')}
                                                                onClick={(e) => {
                                                                    // 🔧 ИСПРАВЛЕНИЕ: Проверяем заполненность матча перед открытием деталей
                                                                    if (onMatchClick && placementMatch.id) {
                                                                        handleMatchClick(placementMatch, e);
                                                                    }
                                                                    // Сохраняем поведение для выбора победителя только для незавершенных матчей
                                                                    else if (canEditMatches && placementMatch.state !== 'DONE') {
                                                                        setSelectedMatch(selectedMatch === safeParseBracketId(placementMatch.id) ? null : safeParseBracketId(placementMatch.id));
                                                                        // Добавляем вызов handleTeamClick
                                                                        if (handleTeamClick && selectedMatch !== safeParseBracketId(placementMatch.id) && placementMatch.participants[0]?.id) {
                                                                            handleTeamClick(placementMatch.participants[0].id, placementMatch.id);
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                {placementMatch.participants[0]?.avatarUrl && (
                                                                    <div className="team-avatar">
                                                                        <img 
                                                                            src={placementMatch.participants[0].avatarUrl} 
                                                                            alt={`${placementMatch.participants[0]?.name || 'TBD'}`}
                                                                            onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                                        />
                                                                    </div>
                                                                )}
                                                                <span className={`team-name${!placementMatch.participants[0]?.name ? ' placeholder' : ''}`}>{placementMatch.participants[0]?.name?.slice(0, 20) || 'TBD'}</span>
                                                                <span className="team-score">
                                                                    {placementMatch.participants[0]?.score ?? '-'}
                                                                </span>
                                                            </div>
                                                            <div
                                                                className={team2Classes.join(' ')}
                                                                onClick={(e) => {
                                                                    // 🔧 ИСПРАВЛЕНИЕ: Проверяем заполненность матча перед открытием деталей
                                                                    if (onMatchClick && placementMatch.id) {
                                                                        handleMatchClick(placementMatch, e);
                                                                    }
                                                                    // Сохраняем поведение для выбора победителя только для незавершенных матчей
                                                                    else if (canEditMatches && placementMatch.state !== 'DONE') {
                                                                        setSelectedMatch(selectedMatch === safeParseBracketId(placementMatch.id) ? null : safeParseBracketId(placementMatch.id));
                                                                        // Добавляем вызов handleTeamClick
                                                                        if (handleTeamClick && selectedMatch !== safeParseBracketId(placementMatch.id) && placementMatch.participants[1]?.id) {
                                                                            handleTeamClick(placementMatch.participants[1].id, placementMatch.id);
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                {placementMatch.participants[1]?.avatarUrl && (
                                                                    <div className="team-avatar">
                                                                        <img 
                                                                            src={placementMatch.participants[1].avatarUrl} 
                                                                            alt={`${placementMatch.participants[1]?.name || 'TBD'}`}
                                                                            onError={(e) => {e.target.src = '/default-avatar.png'}}
                                                                        />
                                                                    </div>
                                                                )}
                                                                <span className={`team-name${!placementMatch.participants[1]?.name ? ' placeholder' : ''}`}>{placementMatch.participants[1]?.name?.slice(0, 20) || 'TBD'}</span>
                                                                <span className="team-score">
                                                                    {placementMatch.participants[1]?.score ?? '-'}
                                                                </span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            {/* 🔧 ИСПРАВЛЕНИЕ: Показываем кнопку просмотра для всех матчей */}
                                            {onMatchClick && (
                                                <div className="edit-match-btn-container">
                                                    <button 
                                                        className="edit-match-btn"
                                                        onClick={(e) => {
                                                            handleMatchClick(placementMatch, e);
                                                        }}
                                                        title="Просмотреть/редактировать результат"
                                                    >
                                                        🔍
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                }
            </div>
            
            {/* 🆕 Тултип для неполных матчей */}
            {incompleteMatchTooltip.show && (
                <div 
                    className="incomplete-match-tooltip"
                    style={{
                        position: 'fixed',
                        left: incompleteMatchTooltip.x,
                        top: incompleteMatchTooltip.y,
                        transform: 'translate(-50%, -100%)',
                        zIndex: 9999,
                        backgroundColor: '#333333',
                        color: '#ffffff',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: '500',
                        border: '1px solid #ff6b6b',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        animation: 'tooltipFadeIn 0.3s ease-out'
                    }}
                >
                    {incompleteMatchTooltip.message}
                    <div 
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: '6px solid #333333'
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default BracketRenderer;