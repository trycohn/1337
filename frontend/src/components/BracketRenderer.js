// frontend/src/components/BracketRenderer.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Home.css';
import './BracketRenderer.css';

const BracketRenderer = ({
    games,
    canEditMatches,
    selectedMatch,
    setSelectedMatch,
    handleTeamClick,
    format
}) => {
    // Состояния для масштабирования и позиционирования
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startDragPos, setStartDragPos] = useState({ x: 0, y: 0 });
    const [groupedMatches, setGroupedMatches] = useState({ winnerRounds: {}, loserRounds: {}, placementMatch: null, grandFinalMatch: null });

    // Ссылки для работы с DOM
    const wrapperRef = useRef(null); // Внешний контейнер для обработчиков
    const bracketContentRef = useRef(null); // Внутренний контейнер для трансформации
    
    // --- Логика перетаскивания и масштабирования ---
    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return; // Только левая кнопка
        // Не начинаем перетаскивание, если клик был на элементе управления (например, кнопке)
        if (e.target.closest('button, .custom-seed')) {
            return;
        }
        setIsDragging(true);
        setStartDragPos({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
        if (wrapperRef.current) {
            wrapperRef.current.style.cursor = 'grabbing';
        }
        e.preventDefault();
    }, [position]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - startDragPos.x,
            y: e.clientY - startDragPos.y,
        });
        e.preventDefault(); // Предотвратить выделение текста при перетаскивании
    }, [isDragging, startDragPos]);

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            if (wrapperRef.current) {
                wrapperRef.current.style.cursor = 'grab';
            }
        }
    }, [isDragging]);

    const handleTouchStart = useCallback((e) => {
        // Не начинаем перетаскивание, если клик был на элементе управления
        if (e.target.closest('button, .custom-seed')) {
            return;
        }
        if (e.touches.length === 1) {
            setIsDragging(true);
            setStartDragPos({
                x: e.touches[0].clientX - position.x,
                y: e.touches[0].clientY - position.y,
            });
            if (wrapperRef.current) {
                wrapperRef.current.style.cursor = 'grabbing';
            }
            // e.preventDefault() вызывается в touchmove для разрешения скролла страницы
        }
    }, [position]);

    const handleTouchMove = useCallback((e) => {
        if (!isDragging || e.touches.length !== 1) return;
        // Предотвращаем скролл страницы только ВО ВРЕМЯ перетаскивания
        e.preventDefault();
        setPosition({
            x: e.touches[0].clientX - startDragPos.x,
            y: e.touches[0].clientY - startDragPos.y,
        });
    }, [isDragging, startDragPos]);

    const handleTouchEnd = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            if (wrapperRef.current) {
                wrapperRef.current.style.cursor = 'grab';
            }
        }
    }, [isDragging]);

    const handleWheel = useCallback((e) => {
        e.preventDefault(); // Предотвратить скролл страницы
        const scaleAmount = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(scale + scaleAmount, 0.5), 3); // Ограничения масштаба

        if (bracketContentRef.current) {
            const rect = bracketContentRef.current.getBoundingClientRect();
            // Координаты курсора относительно wrapperRef
            const mouseX = e.clientX - wrapperRef.current.getBoundingClientRect().left;
            const mouseY = e.clientY - wrapperRef.current.getBoundingClientRect().top;

            // Координаты курсора относительно transform-origin (0, 0) элемента bracketContentRef ДО масштабирования
            const mousePointX = (mouseX - position.x) / scale;
            const mousePointY = (mouseY - position.y) / scale;

            // Новое положение, чтобы точка под курсором осталась на месте
            const newX = mouseX - mousePointX * newScale;
            const newY = mouseY - mousePointY * newScale;

            setPosition({ x: newX, y: newY });
            setScale(newScale);
        }
    }, [scale, position]);

    // Сброс вида
    const resetView = useCallback(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, []);

    // Группировка матчей по раундам и сеткам
    const groupMatchesByRoundAndBracket = useCallback(() => {
        if (!games || !Array.isArray(games) || games.length === 0) {
            return { winnerRounds: {}, loserRounds: {}, placementMatch: null, grandFinalMatch: null };
        }
        
        console.log('Группировка матчей, проверяем bracket_type:', games.map(g => ({id: g.id, bracket_type: g.bracket_type, round: g.round, is_third_place_match: g.is_third_place_match})));
        
        // Если у матчей отсутствует bracket_type, считаем их принадлежащими к winners bracket
        const winnerMatches = games.filter(
            (m) => (m.bracket_type === 'winner' || m.bracket_type === 'prelim' || !m.bracket_type) && !m.is_third_place_match
        );
        const loserMatches = games.filter((m) => m.bracket_type === 'loser' && !m.is_third_place_match);
        // Матч за 3-е место (placement) или помеченный флагом is_third_place_match
        const placementMatch = games.find((m) => m.bracket_type === 'placement' || m.is_third_place_match);
        const grandFinalMatch = games.find((m) => m.bracket_type === 'grand_final');

        console.log('После фильтрации:');
        console.log('Winner matches:', winnerMatches.length);
        console.log('Loser matches:', loserMatches.length);
        console.log('Placement match:', placementMatch ? 'да' : 'нет');
        console.log('Grand final match:', grandFinalMatch ? 'да' : 'нет');

        // Определяем максимальный раунд для верхней и нижней сетки
        const winnerRoundValues = winnerMatches.map(m => m.round);
        console.log('Раунды в winner matches:', winnerRoundValues);
        
        // Чтобы предварительный раунд (-1) не влиял на maxWinnerRound, 
        // сначала фильтруем положительные раунды, затем находим максимум
        const positiveWinnerRounds = winnerRoundValues.filter(r => r >= 0);
        const maxWinnerRound = positiveWinnerRounds.length > 0 ? Math.max(...positiveWinnerRounds) : 0;
        
        const maxLoserRound = loserMatches.length > 0 ? Math.max(...loserMatches.map(m => m.round), 0) : 0;

        console.log('Max Winner Round:', maxWinnerRound);
        console.log('Max Loser Round:', maxLoserRound);

        // Группировка верхней сетки по раундам (начиная с round = 0)
        const winnerRounds = {};
        for (let round = 0; round <= maxWinnerRound; round++) {
            const roundMatches = winnerMatches.filter(m => m.round === round);
            // Сортируем матчи по match_number, чтобы они всегда отображались в одинаковом порядке
            roundMatches.sort((a, b) => {
                // Проверяем наличие match_number перед парсингом
                const numA = a.match_number ? parseInt(a.match_number) : 0;
                const numB = b.match_number ? parseInt(b.match_number) : 0;
                return numA - numB;
            });
            if (roundMatches.length > 0) {
                winnerRounds[round] = roundMatches;
            }
        }

        // Добавляем предварительный раунд (round = -1) если есть такие матчи
        const prelimMatches = winnerMatches.filter(m => m.round === -1);
        // Сортируем предварительные матчи по match_number
        prelimMatches.sort((a, b) => {
            // Проверяем наличие match_number перед парсингом
            const numA = a.match_number ? parseInt(a.match_number) : 0;
            const numB = b.match_number ? parseInt(b.match_number) : 0;
            return numA - numB;
        });
        if (prelimMatches.length > 0) {
            winnerRounds[-1] = prelimMatches;
        }

        console.log('Winner rounds после группировки:', Object.keys(winnerRounds));

        // Группировка нижней сетки по раундам (начиная с round = 1)
        const loserRounds = {};
        for (let round = 1; round <= maxLoserRound; round++) {
            const roundMatches = loserMatches.filter(m => m.round === round);
            // Сортируем матчи по match_number
            roundMatches.sort((a, b) => {
                // Проверяем наличие match_number перед парсингом
                const numA = a.match_number ? parseInt(a.match_number) : 0;
                const numB = b.match_number ? parseInt(b.match_number) : 0;
                return numA - numB;
            });
            if (roundMatches.length > 0) {
                loserRounds[round] = roundMatches;
            }
        }

        return { winnerRounds, loserRounds, placementMatch, grandFinalMatch };
    }, [games]);

    // Установка и удаление обработчиков
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (wrapper) {
            wrapper.addEventListener('mousedown', handleMouseDown);
            wrapper.addEventListener('wheel', handleWheel, { passive: false });
            // Добавляем touchstart к wrapper, а не к window
            wrapper.addEventListener('touchstart', handleTouchStart, { passive: false });

            // Mousemove и mouseup слушаем на window, чтобы отловить отпускание кнопки вне wrapper
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            // Touchmove и touchend также на window
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleTouchEnd);
        }

        return () => {
            if (wrapper) {
                wrapper.removeEventListener('mousedown', handleMouseDown);
                wrapper.removeEventListener('wheel', handleWheel);
                wrapper.removeEventListener('touchstart', handleTouchStart);
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]); // Добавили touch хендлеры в зависимости

    // Обновление сгруппированных матчей при изменении games
    useEffect(() => {
        setGroupedMatches(groupMatchesByRoundAndBracket());
    }, [games, groupMatchesByRoundAndBracket]);

    // --- Конец логики перетаскивания и масштабирования ---

    // Если нет данных для отображения, показываем сообщение
    if (!games || !Array.isArray(games) || games.length === 0) {
        console.log('BracketRenderer: пустой массив games или он не определен', games);
        return <div className="empty-bracket-message">Нет доступных матчей для отображения.</div>;
    }

    const { winnerRounds, loserRounds, placementMatch, grandFinalMatch } = groupedMatches;
    const winnerRoundKeys = Object.keys(winnerRounds);
    const hasWinnerMatches = winnerRoundKeys.length > 0 || Object.keys(loserRounds).length > 0 || placementMatch || grandFinalMatch;

    if (!hasWinnerMatches) {
        console.log('BracketRenderer: нет матчей для отображения после группировки');
        return <div className="empty-bracket-message">Нет доступных матчей для отображения.</div>;
    }

    return (
        // Внешний контейнер для обработчиков и overflow
        <div
            ref={wrapperRef}
            className="bracket-renderer-wrapper"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
            {/* Контролы масштабирования */}
            <div className="bracket-controls">
                <button onClick={() => setScale(s => Math.min(s + 0.1, 3))} title="Увеличить">+</button>
                <button onClick={() => setScale(s => Math.max(s - 0.1, 0.5))} title="Уменьшить">-</button>
                <button onClick={resetView} title="Сбросить вид">↺</button>
            </div>

            {/* Внутренний контейнер для трансформации */}
            <div
                ref={bracketContentRef}
                className="bracket-renderer-content"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: '0 0' // Важно для масштабирования от верхнего левого угла
                }}
            >
                {/* Верхняя сетка (Winners Bracket) */}
                <div className="bracket winners-bracket">
                   {/* Убрали лишний h2, чтобы он не масштабировался */}
                    <div className="bracket-grid">
                        {/* Заголовок теперь вне масштабируемого контента */}
                         {winnerRoundKeys.length > 0 && <h2 className="bracket-title">Winners Bracket</h2>}
                        {winnerRoundKeys.sort((a, b) => Number(a) - Number(b)).map((round) => {
                            const roundMatches = winnerRounds[round];
                            if (!roundMatches || roundMatches.length === 0) return null;

                            return (
                                <div key={`w-${round}`} className="round-column">
                                     <h3>
                                         {round === '-1'
                                             ? 'Preliminary'
                                             : `Round ${round}`}
                                     </h3>
                                    {roundMatches.map((match) => {
                                        const isSelected = selectedMatch === parseInt(match.id);
                                        return (
                                            <div
                                                key={match.id}
                                                className={`custom-seed ${isSelected ? 'selected' : ''}`}
                                                onClick={(e) => {
                                                      // Предотвращаем перетаскивание при клике на матч
                                                      // e.stopPropagation(); // Не нужно, т.к. проверка в handleMouseDown
                                                      if (canEditMatches && match.state !== 'DONE') {
                                                          setSelectedMatch(isSelected ? null : parseInt(match.id));
                                                      }
                                                  }}
                                            >
                                                <div className="match-number">{match.name}</div>
                                                <div className="match-teams">
                                                    <div
                                                        className={`team ${match.participants[0]?.isWinner ? 'winner' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Важно, чтобы клик по команде не выбирал весь матч
                                                            if (match.participants[0]?.id && canEditMatches) {
                                                              handleTeamClick(match.participants[0].id, match.id);
                                                            }
                                                        }}
                                                    >
                                                        <span className="team-name">{match.participants[0]?.name?.slice(0, 20) || 'TBD'}</span>
                                                        <span className="team-score">
                                                            {match.participants[0]?.score ?? '-'}
                                                        </span>
                                                    </div>
                                                    <div
                                                        className={`team ${match.participants[1]?.isWinner ? 'winner' : ''}`}
                                                         onClick={(e) => {
                                                             e.stopPropagation();
                                                             if (match.participants[1]?.id && canEditMatches) {
                                                               handleTeamClick(match.participants[1].id, match.id);
                                                             }
                                                         }}
                                                    >
                                                        <span className="team-name">{match.participants[1]?.name?.slice(0, 20) || 'TBD'}</span>
                                                        <span className="team-score">
                                                            {match.participants[1]?.score ?? '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Разделительная граница и нижняя сетка (только для Double Elimination) */}
                {format === 'double_elimination' && Object.keys(loserRounds).length > 0 && (
                    <>
                        <hr className="bracket-divider" />
                        <div className="bracket losers-bracket">
                             {/* Заголовок теперь вне масштабируемого контента */}
                            <h2 className="bracket-title">Losers Bracket</h2>
                            <div className="bracket-grid">
                                {Object.keys(loserRounds).sort((a, b) => Number(a) - Number(b)).map((round) => {
                                    const roundMatches = loserRounds[round];
                                    return roundMatches && roundMatches.length > 0 ? (
                                        <div key={`l-${round}`} className="round-column">
                                            <h3>Round {round}</h3>
                                            {roundMatches.map((match) => {
                                                const isSelected = selectedMatch === parseInt(match.id);
                                                return (
                                                    <div
                                                        key={match.id}
                                                        className={`custom-seed ${isSelected ? 'selected' : ''}`}
                                                         onClick={(e) => {
                                                               // e.stopPropagation();
                                                               if (canEditMatches && match.state !== 'DONE') {
                                                                   setSelectedMatch(isSelected ? null : parseInt(match.id));
                                                               }
                                                           }}
                                                    >
                                                        <div className="match-number">{match.name}</div>
                                                        <div className="match-teams">
                                                            <div
                                                                className={`team ${match.participants[0]?.isWinner ? 'winner' : ''}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (match.participants[0]?.id && canEditMatches) {
                                                                        handleTeamClick(match.participants[0].id, match.id);
                                                                    }
                                                                }}
                                                            >
                                                                <span className="team-name">{match.participants[0]?.name?.slice(0, 20) || 'TBD'}</span>
                                                                <span className="team-score">
                                                                    {match.participants[0]?.score ?? '-'}
                                                                </span>
                                                            </div>
                                                            <div
                                                                className={`team ${match.participants[1]?.isWinner ? 'winner' : ''}`}
                                                                 onClick={(e) => {
                                                                     e.stopPropagation();
                                                                     if (match.participants[1]?.id && canEditMatches) {
                                                                        handleTeamClick(match.participants[1].id, match.id);
                                                                     }
                                                                 }}
                                                            >
                                                                <span className="team-name">{match.participants[1]?.name?.slice(0, 20) || 'TBD'}</span>
                                                                <span className="team-score">
                                                                    {match.participants[1]?.score ?? '-'}
                                                                </span>
                                                            </div>
                                                        </div>
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
                 {(placementMatch || grandFinalMatch) && (
                    <div className="final-matches-container"> {/* Обертка для финальных матчей */}
                       {placementMatch && (
                           <div className="bracket placement-match">
                               <h2 className="bracket-title">Match for 3rd Place</h2>
                                <div
                                      key={placementMatch.id}
                                      className={`custom-seed ${selectedMatch === parseInt(placementMatch.id) ? 'selected' : ''}`}
                                      onClick={(e) => {
                                          // e.stopPropagation();
                                          if (canEditMatches && placementMatch.state !== 'DONE') {
                                              setSelectedMatch(selectedMatch === parseInt(placementMatch.id) ? null : parseInt(placementMatch.id));
                                          }
                                      }}
                                  >
                                   <div className="match-number">{placementMatch.name}</div>
                                   <div className="match-teams">
                                       <div
                                           className={`team ${placementMatch.participants[0]?.isWinner ? 'winner' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (placementMatch.participants[0]?.id && canEditMatches) {
                                                   handleTeamClick(placementMatch.participants[0].id, placementMatch.id);
                                                }
                                            }}
                                       >
                                           <span className="team-name">{placementMatch.participants[0]?.name?.slice(0, 20) || 'TBD'}</span>
                                           <span className="team-score">
                                               {placementMatch.participants[0]?.score ?? '-'}
                                           </span>
                                       </div>
                                       <div
                                           className={`team ${placementMatch.participants[1]?.isWinner ? 'winner' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (placementMatch.participants[1]?.id && canEditMatches) {
                                                    handleTeamClick(placementMatch.participants[1].id, placementMatch.id);
                                                }
                                            }}
                                       >
                                           <span className="team-name">{placementMatch.participants[1]?.name?.slice(0, 20) || 'TBD'}</span>
                                           <span className="team-score">
                                               {placementMatch.participants[1]?.score ?? '-'}
                                           </span>
                                       </div>
                                   </div>
                               </div>
                           </div>
                       )}
                       {grandFinalMatch && (
                           <div className="bracket grand-final">
                               <h2 className="bracket-title">Grand Final</h2>
                                <div
                                      key={grandFinalMatch.id}
                                      className={`custom-seed ${selectedMatch === parseInt(grandFinalMatch.id) ? 'selected' : ''}`}
                                      onClick={(e) => {
                                          // e.stopPropagation();
                                          if (canEditMatches && grandFinalMatch.state !== 'DONE') {
                                              setSelectedMatch(selectedMatch === parseInt(grandFinalMatch.id) ? null : parseInt(grandFinalMatch.id));
                                          }
                                      }}
                                  >
                                   <div className="match-number">{grandFinalMatch.name}</div>
                                   <div className="match-teams">
                                       <div
                                           className={`team ${grandFinalMatch.participants[0]?.isWinner ? 'winner' : ''}`}
                                           onClick={(e) => {
                                               e.stopPropagation();
                                               if (grandFinalMatch.participants[0]?.id && canEditMatches) {
                                                   handleTeamClick(grandFinalMatch.participants[0].id, grandFinalMatch.id);
                                               }
                                           }}
                                       >
                                           <span className="team-name">{grandFinalMatch.participants[0]?.name?.slice(0, 20) || 'TBD'}</span>
                                           <span className="team-score">
                                               {grandFinalMatch.participants[0]?.score ?? '-'}
                                           </span>
                                       </div>
                                       <div
                                           className={`team ${grandFinalMatch.participants[1]?.isWinner ? 'winner' : ''}`}
                                           onClick={(e) => {
                                               e.stopPropagation();
                                                if (grandFinalMatch.participants[1]?.id && canEditMatches) {
                                                   handleTeamClick(grandFinalMatch.participants[1].id, grandFinalMatch.id);
                                                }
                                           }}
                                       >
                                           <span className="team-name">{grandFinalMatch.participants[1]?.name?.slice(0, 20) || 'TBD'}</span>
                                           <span className="team-score">
                                               {grandFinalMatch.participants[1]?.score ?? '-'}
                                           </span>
                                       </div>
                                   </div>
                               </div>
                           </div>
                       )}
                    </div>
                 )}
            </div>
        </div>
    );
};

export default BracketRenderer;