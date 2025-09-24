// frontend/src/components/BracketRenderer.js
import React, { useRef, useMemo, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import './BracketRenderer.css';
import { getSocketInstance, authenticateSocket } from '../services/socketClient_v5_simplified';
import { formatManager } from '../utils/tournament/bracketFormats';
import { SingleEliminationFormat } from '../utils/tournament/formats/SingleEliminationFormat';
import { DoubleEliminationFormat } from '../utils/tournament/formats/DoubleEliminationFormat';
import useDragAndZoom from '../hooks/useDragAndZoom';
import { useAuth } from '../context/AuthContext';

// Регистрируем форматы
formatManager.register(new SingleEliminationFormat());
formatManager.register(new DoubleEliminationFormat());

const BracketRenderer = ({ 
    games, 
    tournament, 
    onEditMatch, 
    canEditMatches, 
    selectedMatch, 
    setSelectedMatch, 
    format, 
    onMatchClick,
    readOnly = false,
    focusMatchId = null,
    isAdminOrCreator = false
}) => {
    // 🔧 ИСПРАВЛЕНО: Используем games вместо matches
    const matches = useMemo(() => games || [], [games]);
    const rendererRef = useRef(null);
    const containerRef = useRef(null);
    const winnersSectionRef = useRef(null);
    const losersSectionRef = useRef(null);
    const grandFinalSectionRef = useRef(null);
    const touchStartXRef = useRef(null);
    const SWIPE_THRESHOLD = 50;

    // Авто‑подгон высоты контейнера под фактический размер (с учётом zoom/transform)
    const [containerHeight, setContainerHeight] = useState(null);
    const recomputeContainerSize = useCallback(() => {
        try {
            if (!rendererRef.current) return;
            // Меряем сам .bracket-renderer (по факту — максимальный вложенный элемент)
            const target = rendererRef.current;
            const rect = target.getBoundingClientRect();
            const h = Math.max(rect.height || 0, target.scrollHeight || 0, target.offsetHeight || 0);
            const paddingReserve = 40; // небольшой запас под внутренние отступы
            const newHeight = Math.max(0, Math.ceil(h + paddingReserve));
            setContainerHeight((prev) => (prev == null ? newHeight : Math.max(prev, newHeight)));
        } catch (_) {}
    }, []);

    // Несколько отложенных замеров на старте, чтобы поймать финальную высоту после рендеринга
    const scheduleInitialMeasurements = useCallback(() => {
        const run = () => requestAnimationFrame(recomputeContainerSize);
        run();
        setTimeout(run, 50);
        setTimeout(run, 120);
    }, [recomputeContainerSize]);

    // Мобильный режим
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    
    // 🆕 СОВРЕМЕННАЯ СИСТЕМА ПЕРЕТАСКИВАНИЯ И МАСШТАБИРОВАНИЯ
    const {
        isDragging,
        zoomIn,
        zoomOut,
        resetAll,
        centerView,
        canZoomIn,
        canZoomOut,
        handlers
    } = useDragAndZoom({
        initialPosition: { x: 0, y: 0 },
        initialZoom: 1,
        minZoom: 0.3,
        maxZoom: 3,
        zoomStep: 0.05,
        // Вариант B: колесо мыши скроллит, зум только с Ctrl
        requireCtrl: true,
        excludeSelectors: [
            '.bracket-navigation-panel',
            '.bracket-nav-icon-button',
            '.bracket-match-card',
            '.bracket-edit-match-btn'
        ],
        onDragStart: (data) => {
            // eslint-disable-next-line no-console
            console.log('🎯 Начало перетаскивания:', data.position);
        },
        onDragMove: (data) => {
            if (data.event.timeStamp % 10 < 1) {
                // eslint-disable-next-line no-console
                console.log('📍 Перетаскивание:', data.position);
            }
        },
        onDragEnd: (data) => {
            // eslint-disable-next-line no-console
            console.log('🎯 Конец перетаскивания:', data.position);
        },
        onZoomChange: (data) => {
            // eslint-disable-next-line no-console
            console.log('🔍 Изменение масштаба:', data.zoom);
            // Упростили: без авто‑растягивания при зуме
        }
    });

    // Пересчёт только на монтировании и при первом приходе матчей
    useLayoutEffect(() => {
        scheduleInitialMeasurements();
    }, [scheduleInitialMeasurements]);

    useEffect(() => {
        scheduleInitialMeasurements();
    }, [matches, scheduleInitialMeasurements]);

    

    const effectiveHandlers = (readOnly || isMobile) ? {} : handlers;
    
    // Получаем формат турнира
    const tournamentFormat = useMemo(() => {
        const formatType = tournament?.bracket_type || 'single_elimination';
        return formatManager.getFormat(formatType);
    }, [tournament?.bracket_type]);
    const isSwiss = useMemo(() => (tournament?.bracket_type || '').toString().toLowerCase() === 'swiss', [tournament?.bracket_type]);
    
    // Группируем матчи используя систему плагинов
    const groupedMatches = useMemo(() => {
        if (!matches || matches.length === 0) return {};
        return tournamentFormat.groupMatches(matches);
    }, [matches, tournamentFormat]);

    // Убрали автоматическое выравнивание ширин секций
    
    // Предрасчет матчей за 3-е место на верхнем уровне (хуки должны вызываться до ранних return)
    const thirdPlaceMatches = useMemo(
        () => (matches || []).filter(m => m.bracket_type === 'placement' || m.is_third_place_match),
        [matches]
    );

    // Определяем формат DE раньше, т.к. далее он используется в orderedRounds
    const isDoubleElimination = useMemo(() => (
        tournament?.bracket_type === 'double_elimination' ||
        tournament?.bracket_type === 'doubleElimination' ||
        tournament?.bracket_type === 'DOUBLE_ELIMINATION' ||
        ((groupedMatches?.losers && Object.keys(groupedMatches.losers).length > 0) ||
         (groupedMatches?.grandFinal && groupedMatches.grandFinal.length > 0))
    ), [tournament?.bracket_type, groupedMatches?.losers, groupedMatches?.grandFinal]);

    // Раунды и индексы для свайпа
    const winnerRounds = useMemo(() => Object.keys(groupedMatches.winners || {}).map(Number).sort((a,b)=>a-b), [groupedMatches.winners]);
    const loserRounds = useMemo(() => Object.keys(groupedMatches.losers || {}).map(Number).sort((a,b)=>a-b), [groupedMatches.losers]);
    const seRounds    = useMemo(() => {
        const arr = Object.keys(groupedMatches || {}).map(Number).sort((a,b)=>a-b);
        return isSwiss ? arr.reverse() : arr;
    }, [groupedMatches, isSwiss]);

    // Единые слайды для мобильного режима
    // DE: пара (W_i над L_i). SE: один раунд на слайд
    const orderedRounds = useMemo(() => {
        const list = [];
        if (!matches || matches.length === 0) return list;
        if (isDoubleElimination) {
            const maxLen = Math.max(winnerRounds.length, loserRounds.length);
            for (let i = 0; i < maxLen; i++) {
                const wRoundNum = winnerRounds[i];
                const lRoundNum = loserRounds[i];
                const wData = wRoundNum != null ? ((groupedMatches.winners || {})[wRoundNum] || []) : null;
                const lData = lRoundNum != null ? ((groupedMatches.losers || {})[lRoundNum] || []) : null;
                list.push({
                    key: `pair-${i}`,
                    type: 'pair',
                    winner: wRoundNum != null ? { round: wRoundNum, data: wData } : null,
                    loser: lRoundNum != null ? { round: lRoundNum, data: lData } : null
                });
            }
            // Grand final(s)
            const grandFinalMatches = Array.isArray(groupedMatches.grandFinal) ? groupedMatches.grandFinal : [];
            grandFinalMatches.forEach((m, idx) => {
                list.push({ key: `grand_final-${idx}`, type: 'grand_final', round: 1, data: [m] });
            });
            // Third place (если есть)
            if (thirdPlaceMatches && thirdPlaceMatches.length > 0) {
                list.push({ key: 'third_place', type: 'third_place', round: 1, data: thirdPlaceMatches });
            }
        } else {
            seRounds.forEach((round) => {
                const rd = (groupedMatches || {})[round];
                list.push({ key: `se-${round}`, type: 'se', round, data: rd });
            });
        }
        return list;
    }, [matches, isDoubleElimination, groupedMatches, thirdPlaceMatches, winnerRounds, loserRounds, seRounds]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [animationDir, setAnimationDir] = useState('left'); // 'left' | 'right'
    useEffect(() => { setCurrentIndex(0); }, [isMobile, orderedRounds.length]);

    const handleTouchStart = useCallback((e) => {
        if (!isMobile) return;
        touchStartXRef.current = e.touches[0].clientX;
    }, [isMobile]);

    const handleTouchEnd = useCallback((e) => {
        if (!isMobile) return;
        const startX = touchStartXRef.current;
        if (startX == null) return;
        const endX = e.changedTouches[0].clientX;
        const deltaX = endX - startX;
        if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
        const dir = deltaX < 0 ? 1 : -1; // влево → следующий, вправо → предыдущий
        setAnimationDir(dir === 1 ? 'left' : 'right');
        setCurrentIndex(idx => Math.min(Math.max(0, idx + dir), Math.max(0, orderedRounds.length - 1)));
    }, [isMobile, orderedRounds.length]);

    // Блокировка горизонтального скролла страницы на мобилках при отображении сетки
    useEffect(() => {
        if (!isMobile) return;
        const prevOverflowX = document.body.style.overflowX;
        const prevTouchAction = document.body.style.touchAction;
        document.body.style.overflowX = 'hidden';
        document.body.style.touchAction = 'pan-y';
        return () => {
            document.body.style.overflowX = prevOverflowX;
            document.body.style.touchAction = prevTouchAction;
        };
    }, [isMobile]);

    // 🆕 Батч-загрузка active-lobby для матчей на экране
    let api;
    try { api = require('../axios').default; } catch (_) {}
    const [activeLobbyByMatchId, setActiveLobbyByMatchId] = useState({});
    const idsKey = useMemo(() => {
        const ids = (matches || []).map(m => m && m.id).filter(Boolean).map(Number).sort((a, b) => a - b);
        return ids.join(',');
    }, [matches]);

    useEffect(() => {
        if (!api || !tournament?.id) return;
        if (!idsKey) return;
        if (typeof document !== 'undefined' && document.hidden) return;
        let cancelled = false;
        const ids = (matches || []).map(m => m && m.id).filter(Boolean).map(Number);

        async function loadActiveLobbiesBatch() {
            try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const chunkSize = 200;
                const newMap = {};
                for (let i = 0; i < ids.length; i += chunkSize) {
                    const chunk = ids.slice(i, i + chunkSize);
                    const res = await api.post(`/api/tournaments/${tournament.id}/matches/active-lobbies`, { ids: chunk }, { headers });
                    const byMatchId = res?.data?.byMatchId || {};
                    for (const key in byMatchId) {
                        if (!Object.prototype.hasOwnProperty.call(byMatchId, key)) continue;
                        const mid = Number(key);
                        newMap[mid] = byMatchId[key];
                    }
                }
                if (!cancelled) setActiveLobbyByMatchId(prev => ({ ...prev, ...newMap }));
            } catch (_) {
                // молча игнорируем
            }
        }
        loadActiveLobbiesBatch();
        return () => { cancelled = true; };
        // намеренно не включаем api в зависимости, чтобы не триггерить лишние перезапуски
    }, [tournament?.id, idsKey]);

    // 🆕 Реалтайм обновления activeLobby (инвайт/закрытие)
    useEffect(() => {
        if (!tournament?.id) return;
        let socket;
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token) authenticateSocket(token);
            socket = getSocketInstance();
        } catch (_) { return; }

        const handleInvite = (data) => {
            // data: { lobbyId, matchId, tournamentId }
            if (!data || Number(data.tournamentId) !== Number(tournament?.id)) return;
            setActiveLobbyByMatchId(prev => ({ ...prev, [Number(data.matchId)]: Number(data.lobbyId) }));
        };
        const handleLobbyCompleted = (payload) => {
            if (!payload) return;
            const tid = Number(payload.tournamentId || tournament?.id);
            if (tid !== Number(tournament?.id)) return;
            const mid = Number(payload.matchId);
            if (mid) setActiveLobbyByMatchId(prev => ({ ...prev, [mid]: null }));
        };

        socket.on('match_lobby_invite', handleInvite);
        socket.on('lobby_completed', handleLobbyCompleted);
        socket.on('lobby_update', (lobby) => {
            // Если статус стал completed — зачистим
            try {
                if (lobby && lobby.status === 'completed' && lobby.match_id) {
                    setActiveLobbyByMatchId(prev => ({ ...prev, [Number(lobby.match_id)]: null }));
                }
            } catch (_) {}
        });

        return () => {
            try {
                socket.off('match_lobby_invite', handleInvite);
                socket.off('lobby_completed', handleLobbyCompleted);
                socket.off('lobby_update');
            } catch (_) {}
        };
    }, [tournament?.id]);

    // 🔧 ИСПРАВЛЕНО: Добавляем проверку на пустые матчи
    if (!matches || matches.length === 0) {
        return (
            <div className="bracket-renderer-container">
                <div className="bracket-empty-message">
                    🎯 Турнирная сетка пока не создана
                </div>
            </div>
        );
    }
    
    // Получение контекста раунда с расширенной информацией
    const getRoundContext = (round, roundData, bracketType) => {
        const groupedRounds = Object.keys(groupedMatches[bracketType] || {}).map(Number);
        const totalRounds = Math.max(...groupedRounds);
        const matchesInRound = Array.isArray(roundData) ? roundData.length : Object.keys(roundData).length;
        const isLastRound = round === totalRounds;
        
        return {
            bracketType,
            totalRounds,
            matchesInRound,
            isLastRound,
            currentRound: round,
            allRounds: groupedRounds
        };
    };

    // Рендер раунда для Single Elimination
    const renderSingleEliminationRound = (round, roundData, roundName) => {
        const matchesArray = Array.isArray(roundData) ? roundData : Object.values(roundData).flat();
        const matchesCount = matchesArray.length;
        
        // Определяем класс для количества матчей и вертикального выравнивания
        let matchesClass = 'few-matches';
        let columnClass = 'has-few-matches';
        
        if (matchesCount === 1) {
            matchesClass = 'single-match';
            columnClass = 'has-single-match';
        } else if (matchesCount >= 4) {
            matchesClass = 'many-matches';
            columnClass = 'has-many-matches';
        }
        
        return (
            <div key={round} className={`bracket-round-column ${columnClass}`} style={isMobile ? { width: '90vw', margin: '0 auto' } : undefined}>
                <div className="bracket-round-header">
                    {roundName}
                </div>
                <div className={`bracket-matches-list ${matchesClass}`}>
                    {matchesArray.map(match => (
                        <div
                            key={match.id}
                            className="bracket-match-container"
                            data-match-id={match.id}
                            data-focused={focusMatchId && String(focusMatchId) === String(match.id) ? 'true' : 'false'}
                        >
                            <MatchCard
                                match={match}
                                tournament={tournament}
                                onEditMatch={onEditMatch}
                                canEditMatches={canEditMatches}
                                onMatchClick={onMatchClick}
                                isAdminOrCreator={isAdminOrCreator}
                                customLabel={match.bracket_type === 'placement' ? '3rd Place' : null}
                                matchType={match.bracket_type}
                                activeLobbyId={activeLobbyByMatchId[Number(match.id)] || null}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Рендер раунда для Double Elimination с улучшенной поддержкой стилей
    const renderDoubleEliminationRound = (round, matches, bracketType, roundName, context) => {
        const matchesCount = matches.length;
        
        // Определяем класс для количества матчей и вертикального выравнивания
        let matchesClass = 'few-matches';
        let columnClass = 'has-few-matches';
        
        if (matchesCount === 1) {
            matchesClass = 'single-match';
            columnClass = 'has-single-match';
        } else if (matchesCount >= 4) {
            matchesClass = 'many-matches';
            columnClass = 'has-many-matches';
        }
        
        // Определяем тип раунда для специальной стилизации
        let roundType = 'regular';
        if (bracketType === 'loser' && context?.isLastRound) {
            roundType = 'losers-small-final';
        } else if (bracketType === 'grand_final') {
            roundType = 'grand-final';
        }
        
        // Определяем правильный CSS класс для заголовка раунда
        let headerClass = 'bracket-round-header';
        switch (bracketType) {
            case 'winner':
                headerClass += ' bracket-winners-bracket-header';
                break;
            case 'loser':
                headerClass += ' bracket-losers-bracket-header';
                break;
            case 'grand_final':
                headerClass += ' bracket-grand-final-bracket-header';
                break;
            default:
                headerClass += ' bracket-default-bracket-header';
        }
        const shouldRenderHeader = bracketType !== 'grand_final';
        
        return (
            <div key={`${bracketType}-${round}`} className={`bracket-round-column ${columnClass}`} style={isMobile ? { width: '90vw', margin: '0 auto' } : undefined}>
                {shouldRenderHeader && (
                    <div 
                        className={headerClass}
                        data-round-type={roundType}
                    >
                        {roundName}
                    </div>
                )}
                <div className={`bracket-matches-list ${matchesClass}`}>
                    {matches.map(match => (
                        <div
                            key={match.id}
                            className="bracket-match-container"
                            data-match-type={match.bracket_type}
                            data-match-id={match.id}
                            data-focused={focusMatchId && String(focusMatchId) === String(match.id) ? 'true' : 'false'}
                        >
                            <MatchCard
                                match={match}
                                tournament={tournament}
                                onEditMatch={onEditMatch}
                                canEditMatches={canEditMatches}
                                onMatchClick={onMatchClick}
                                isAdminOrCreator={isAdminOrCreator}
                                matchType={match.bracket_type}
                                customLabel={roundType === 'losers-small-final' ? 'Small Final' : null}
                                activeLobbyId={activeLobbyByMatchId[Number(match.id)] || null}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Рендер панели навигации
    const renderNavigationPanel = () => (
        readOnly ? null : (
            <div className="bracket-navigation-panel">
                <button 
                    className="bracket-nav-icon-button"
                    onClick={zoomOut}
                    disabled={!canZoomOut}
                    title="Уменьшить масштаб"
                >
                    <span className="bracket-nav-icon">−</span>
                </button>

                <button 
                    className="bracket-nav-icon-button"
                    onClick={zoomIn}
                    disabled={!canZoomIn}
                    title="Увеличить масштаб"
                >
                    <span className="bracket-nav-icon">+</span>
                </button>

                <button 
                    className="bracket-nav-icon-button"
                    onClick={resetAll}
                    title="Восстановить"
                >
                    <span className="bracket-nav-icon">⌂</span>
                </button>

                <button 
                    className="bracket-nav-icon-button"
                    onClick={centerView}
                    title="Центрировать"
                >
                    <span className="bracket-nav-icon">⊙</span>
                </button>

                <button 
                    className="bracket-nav-icon-button"
                    onClick={() => {
                        const matchParam = focusMatchId ? String(focusMatchId) : (selectedMatch ? (typeof selectedMatch === 'object' ? selectedMatch.id : selectedMatch) : null);
                        const url = `/tournaments/${tournament?.id}/bracket${matchParam ? `?match=${matchParam}` : ''}`;
                        window.open(url, '_blank', 'noopener');
                    }}
                    title="Открыть в новой вкладке"
                >
                    <span className="bracket-nav-icon">↗</span>
                </button>
            </div>
        )
    );

    // Основной рендер с поддержкой разных форматов
    
    if (isDoubleElimination) {
        // Подготовка данных для боковой колонки (Grand Final/Reset и 3-е место)
        const grandFinalMatches = Array.isArray(groupedMatches.grandFinal) ? groupedMatches.grandFinal : [];

        // Рендер Double Elimination с Winners + боковая колонка справа
        return (
            <div 
                className={`bracket-renderer-container bracket-double-elimination ${readOnly ? 'bracket-readonly' : ''} ${isDragging ? 'dragging' : ''}`}
                ref={containerRef}
                style={containerHeight != null ? { height: `${containerHeight}px` } : undefined}
            >
                {renderNavigationPanel()}
                {isMobile && orderedRounds.length > 0 && (
                    <div className="bracket-swipe-arrows">
                        <button 
                            className="bracket-swipe-arrow-btn"
                            onClick={() => { setAnimationDir('right'); setCurrentIndex(i => Math.max(0, i - 1)); }}
                            disabled={currentIndex === 0}
                        >
                            <span className="triangle triangle-left" aria-hidden="true"></span>
                        </button>
                        <div className="bracket-round-indicator">
                            Раунд {Math.min(currentIndex + 1, orderedRounds.length)} / {orderedRounds.length}
                        </div>
                        <button 
                            className="bracket-swipe-arrow-btn"
                            onClick={() => { setAnimationDir('left'); setCurrentIndex(i => Math.min(orderedRounds.length - 1, i + 1)); }}
                            disabled={currentIndex >= orderedRounds.length - 1}
                        >
                            <span className="triangle triangle-right" aria-hidden="true"></span>
                        </button>
                    </div>
                )}
                
                <div 
                    className={`bracket-renderer ${readOnly ? 'bracket-renderer-static' : ''}`}
                    ref={rendererRef}
                    {...effectiveHandlers}
                >
                    <div className="bracket-upper-and-finals-row bracket-full-bleed">
                        {/* ===== UPPER BRACKET (WINNERS) ===== */}
                        {groupedMatches.winners && Object.keys(groupedMatches.winners).length > 0 && (
                            <div 
                                className="bracket-render-upper-section"
                                ref={winnersSectionRef}
                                onTouchStart={handleTouchStart}
                                onTouchEnd={handleTouchEnd}
                            >
                                {!isMobile && (
                                    <div className="bracket-render-section-header">
                                        <div className="bracket-render-section-subtitle bracket-render-winners-subtitle">Верхняя сетка</div>
                                    </div>
                                )}
                                <div className="bracket-rounds-container bracket-render-winners-container">
                                    {isMobile ? (
                                        (() => {
                                            const item = orderedRounds[currentIndex];
                                            if (!item) return null;
                                            if (item.type === 'pair') {
                                                if (!item.winner) return null;
                                                const { round, data } = item.winner;
                                                const context = getRoundContext(parseInt(round), data, 'winner');
                                                const roundName = tournamentFormat.getRoundName(parseInt(round), context);
                                                return (
                                                    <div key={`${item.key}-w`} className={`bracket-mobile-round-slide slide-${animationDir}`}>
                                                        {renderDoubleEliminationRound(round, data, 'winner', roundName, context)}
                                                    </div>
                                                );
                                            }
                                            if (item.type === 'grand_final') {
                                                const data = Array.isArray(item.data) ? item.data : [];
                                                const context = getRoundContext(1, data, 'grand_final');
                                                const hasReset = data.some(m => m.bracket_type === 'grand_final_reset');
                                                const roundName = hasReset ? 'Grand Final Triumph' : 'Grand Final';
                                                return (
                                                    <div key={`${item.key}-gf`} className={`bracket-mobile-round-slide slide-${animationDir}`}>
                                                        {renderDoubleEliminationRound(1, data, 'grand_final', roundName, context)}
                                                    </div>
                                                );
                                            }
                                            // third_place рендерится в нижней секции
                                            return null;
                                        })()
                                    ) : (
                                        Object.entries(groupedMatches.winners)
                                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                            .map(([round, matches]) => {
                                                const context = getRoundContext(parseInt(round), matches, 'winner');
                                                const roundName = tournamentFormat.getRoundName(parseInt(round), context);
                                                return renderDoubleEliminationRound(round, matches, 'winner', roundName, context);
                                            })
                                    )}
                                </div>
                            </div>
                        )}

                        {!isMobile && (grandFinalMatches.length > 0 || (thirdPlaceMatches && thirdPlaceMatches.length > 0)) && (
                            <div className="bracket-side-finals-column">
                                {/* Заголовок боковой колонки */}
                                {!isMobile && (
                                    <div className="bracket-render-section-header">
                                        <div className="bracket-render-section-title bracket-render-grand-final-title">Grand Final</div>
                                    </div>
                                )}
                                <div className="bracket-side-finals-content">
                                    {/* GRAND FINAL(S) */}
                                    {grandFinalMatches.length > 0 && (
                                        <div className="bracket-grand-final-section" ref={grandFinalSectionRef}>
                                <div className="bracket-rounds-container bracket-render-grand-final-container center-rows">
                                                {grandFinalMatches.map((match) => {
                                                    const context = getRoundContext(1, [match], 'grand_final');
                                                    const roundName = match.bracket_type === 'grand_final_reset' ? 'Grand Final Triumph' : 'Grand Final';
                                                    return renderDoubleEliminationRound(1, [match], 'grand_final', roundName, context);
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* THIRD PLACE (if exists) */}
                                    {thirdPlaceMatches && thirdPlaceMatches.length > 0 && (
                                        <div className="bracket-third-place-section">
                                            <div className="bracket-rounds-container center-rows">
                                                {renderDoubleEliminationRound(1, thirdPlaceMatches, 'winner', 'Матч за 3-е место', { isLastRound: true })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* ===== LOWER BRACKET (LOSERS) ===== */}
                    {groupedMatches.losers && Object.keys(groupedMatches.losers).length > 0 && (
                        <div 
                            className="bracket-render-lower-section"
                            ref={losersSectionRef}
                            onTouchStart={handleTouchStart}
                            onTouchEnd={handleTouchEnd}
                        >
                            {!isMobile && (
                                <div className="bracket-render-section-header">
                                    <div className="bracket-render-section-subtitle bracket-render-losers-subtitle">Нижняя сетка на выбывание</div>
                                </div>
                            )}
                            <div className="bracket-rounds-container bracket-render-losers-container">
                                {isMobile ? (
                                    (() => {
                                        const item = orderedRounds[currentIndex];
                                        if (!item) return null;
                                        if (item.type === 'pair') {
                                            const { round, data } = item.loser || {};
                                            if (round == null) return null;
                                            const context = getRoundContext(parseInt(round), data, 'loser');
                                            const roundName = tournamentFormat.getRoundName(parseInt(round), context);
                                            return (
                                                <div key={`${item.key}-l`} className={`bracket-mobile-round-slide slide-${animationDir}`}>
                                                    {renderDoubleEliminationRound(round, data, 'loser', roundName, context)}
                                                </div>
                                            );
                                        }
                                        if (item.type === 'third_place') {
                                            const data = Array.isArray(item.data) ? item.data : [];
                                            const context = getRoundContext(1, data, 'winner');
                                            const roundName = 'Матч за 3-е место';
                                            return (
                                                <div key={`${item.key}-tp`} className={`bracket-mobile-round-slide slide-${animationDir}`}>
                                                    {renderDoubleEliminationRound(1, data, 'winner', roundName, context)}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()
                                ) : (
                                    Object.entries(groupedMatches.losers)
                                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                        .map(([round, matches]) => {
                                            const context = getRoundContext(parseInt(round), matches, 'loser');
                                            const roundName = tournamentFormat.getRoundName(parseInt(round), context);
                                            return renderDoubleEliminationRound(round, matches, 'loser', roundName, context);
                                        })
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Grand Final и 3-е место перенесены в боковую колонку справа от Winners */}
                </div>
            </div>
        );
    }
    
    // Рендер Single Elimination
    return (
        <div 
            className={`bracket-renderer-container bracket-single-elimination ${readOnly ? 'bracket-readonly' : ''} ${isDragging ? 'dragging' : ''}`}
            ref={containerRef}
            style={containerHeight != null ? { height: `${containerHeight}px` } : undefined}
        >
            {renderNavigationPanel()}
            
            <div 
                className={`bracket-renderer ${readOnly ? 'bracket-renderer-static' : ''}`}
                ref={rendererRef}
                {...effectiveHandlers}
            >
                <div 
                    className={`bracket-rounds-container bracket-full-bleed${isSwiss ? ' is-swiss' : ''}`}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {isMobile ? (
                        (() => {
                            const item = orderedRounds[currentIndex];
                            if (!item || item.type !== 'se') return null;
                            const context = getRoundContext(parseInt(item.round), item.data, 'regular');
                            let roundName = tournamentFormat.getRoundName(parseInt(item.round), context);
                            if (isSwiss) {
                                try {
                                    const maxRound = Math.max(...Object.keys(groupedMatches || {}).map(Number));
                                    if (parseInt(item.round) === maxRound) roundName = 'Финал';
                                } catch (_) {}
                            }
                            return (
                                <div key={item.key} className={`bracket-mobile-round-slide slide-${animationDir}`}>
                                    {renderSingleEliminationRound(item.round, item.data, roundName)}
                                </div>
                            );
                        })()
                    ) : (
                        Object.entries(groupedMatches)
                            .sort(([a], [b]) => (isSwiss ? (parseInt(b) - parseInt(a)) : (parseInt(a) - parseInt(b))))
                            .map(([round, roundData]) => {
                                const context = getRoundContext(parseInt(round), roundData, 'regular');
                                let roundName = tournamentFormat.getRoundName(parseInt(round), context);
                                if (isSwiss) {
                                    try {
                                        const maxRound = Math.max(...Object.keys(groupedMatches || {}).map(Number));
                                        if (parseInt(round) === maxRound) roundName = 'Финал';
                                    } catch (_) {}
                                }
                                return renderSingleEliminationRound(round, roundData, roundName);
                            })
                    )}
                </div>
            </div>
        </div>
    );
};

// MatchCard компонент с поддержкой bracket_type и кастомных меток
const MatchCard = ({ match, tournament, onEditMatch, canEditMatches, onMatchClick, customLabel, matchType = 'regular', isAdminOrCreator = false, activeLobbyId: activeLobbyIdFromParent = null }) => {
    const { user } = useAuth();
    const [isHovered, setIsHovered] = useState(false);
    const [isCreatingLobby, setIsCreatingLobby] = useState(false);
    const canShowActions = isAdminOrCreator && tournament?.status === 'in_progress';

    function isUserCaptainOfMatch() {
        if (!user || !tournament || tournament.participant_type !== 'team') return false;
        const teamIds = [match?.team1_id, match?.team2_id].filter(Boolean);
        if (!Array.isArray(tournament.teams) || teamIds.length === 0) return false;
        const userIsCaptainInTeam = (team) => {
            if (!team) return false;
            if (team.captain_id && Number(team.captain_id) === Number(user.id)) return true;
            if (Array.isArray(team.members)) {
                return team.members.some(m => (m.is_captain === true) && (Number(m.user_id || m.id) === Number(user.id)));
            }
            return false;
        };
        const team1 = tournament.teams.find(t => Number(t.id) === Number(match?.team1_id));
        const team2 = tournament.teams.find(t => Number(t.id) === Number(match?.team2_id));
        return userIsCaptainInTeam(team1) || userIsCaptainInTeam(team2);
    }
    const isCaptainForThisMatch = isUserCaptainOfMatch();
    let api;
    try { api = require('../axios').default; } catch (_) {}
    const [activeLobbyId, setActiveLobbyId] = useState(activeLobbyIdFromParent || null);
    const getBracketTypeStyle = () => {
        // 🔧 ИСПРАВЛЕНО: Проверяем матч за 3-е место
        if (match.bracket_type === 'placement' || match.is_third_place_match || matchType === 'third-place') {
            return 'bracket-match-card-third-place';
        }
        
        // 🆕 ФИНАЛЬНЫЙ МАТЧ (матч за 1-е место)
        if (match.bracket_type === 'final' || matchType === 'final') {
            return 'bracket-match-card-final';
        }
        
        switch (match.bracket_type) {
            case 'winner':
                return 'bracket-match-card-winner';
            case 'loser':
                return 'bracket-match-card-loser';
            case 'grand_final':
            case 'grand_final_reset':
                return 'bracket-match-card-grand-final';
            default:
                return 'bracket-match-card-single';
        }
    };

    const getMatchTitle = () => {
        // Используем кастомную метку если есть
        if (customLabel) {
            return customLabel;
        }
        
        // 🆕 ФИНАЛЬНЫЙ МАТЧ (матч за 1-е место)
        if (match.bracket_type === 'final' || matchType === 'final') {
            return 'Матч за 1-е место';
        }
        
        // 🔧 ИСПРАВЛЕНО: Проверяем матч за 3-е место
        if (match.bracket_type === 'placement' || match.is_third_place_match) {
            return 'Матч за 3-е место';
        }
        
        // Для grand final матчей (Double Elimination)
        if (match.bracket_type === 'grand_final') {
            return 'Матч за 1-е место'; // 🆕 Изменено с "Grand Final"
        }
        
        if (match.bracket_type === 'grand_final_reset') {
            return 'Grand Final Triumph'; // Переименовано: более торжественное название для reset матча
        }
        
        // Стандартные матчи - используем локальный номер
        const displayNumber = match.tournament_match_number || match.match_number || match.id;
        return `Матч ${displayNumber}`;
    };

    // Вспомогательный расчет итогового счета по картам/матчу
    const getComputedScores = (m) => {
        const maps = m?.maps_data;
        if (Array.isArray(maps) && maps.length > 0) {
            if (maps.length === 1) {
                const only = maps[0];
                const s1 = (only.score1 ?? only.team1_score);
                const s2 = (only.score2 ?? only.team2_score);
                if (typeof s1 === 'number' && typeof s2 === 'number') return [s1, s2];
            } else {
                let wins1 = 0, wins2 = 0;
                for (const mm of maps) {
                    const s1 = (mm.score1 ?? mm.team1_score);
                    const s2 = (mm.score2 ?? mm.team2_score);
                    if (typeof s1 === 'number' && typeof s2 === 'number') {
                        if (s1 > s2) wins1++; else if (s2 > s1) wins2++;
                    }
                }
                if (wins1 + wins2 > 0) return [wins1, wins2];
            }
        }
        const s1 = (typeof m?.score1 === 'number') ? m.score1 : 0;
        const s2 = (typeof m?.score2 === 'number') ? m.score2 : 0;
        return [s1, s2];
    };

    // 🔧 ИСПРАВЛЕНО: Определяем данные участников
    const getParticipantData = (participantIndex) => {
        const participants = match.participants || [];
        const participant = participants[participantIndex];
        
        if (!participant) {
            return {
                name: 'TBD',
                score: null,
                isWinner: false,
                status: 'NO_SHOW'
            };
        }
        
        // 🔧 УЛУЧШЕНО: Проверяем, является ли участник TBD
        const isTBD = !participant.id || participant.id === 'tbd' || participant.name === 'TBD';
        
        // 🆕 Логика отображения счёта: одна карта -> реальный счёт; несколько -> кол-во выигранных карт; иначе -> score1/score2
        const [c1, c2] = getComputedScores(match);
        let displayScore = participantIndex === 0 ? c1 : c2;
        if (displayScore === null || displayScore === undefined) {
            displayScore = participant.score !== null && participant.score !== undefined ? participant.score : participant.resultText;
        }
        
        return {
            name: participant.name || 'TBD',
            score: displayScore,
            // 🔧 ИСПРАВЛЕНО: TBD не может быть победителем
            isWinner: !isTBD && participant.isWinner,
            status: participant.status || 'PLAYED'
        };
    };

    const participant1 = getParticipantData(0);
    const participant2 = getParticipantData(1);

    // 🔧 ИСПРАВЛЕНО: Функция определения статуса матча
    const getMatchStatus = () => {
        // 🆕 Приоритетная проверка статуса из БД для всех завершенных матчей
        if (match.status === 'completed' || match.state === 'DONE' || match.state === 'SCORE_DONE') {
            return 'completed';
        }
        
        // Проверяем готовность матча (оба участника есть и это не BYE vs BYE)
        if (participant1.name !== 'TBD' && participant2.name !== 'TBD' && 
            !(participant1.name === 'BYE' && participant2.name === 'BYE')) {
            return 'ready';
        }
        
        return 'pending';
    };

    const matchStatus = getMatchStatus();
    
    // Синхронизируем проп из родителя
    useEffect(() => {
        setActiveLobbyId(activeLobbyIdFromParent || null);
    }, [activeLobbyIdFromParent]);

    // Клик по карточке всегда ведёт на страницу матча (без модалок)
    const handleMatchClick = (e) => {
        e.stopPropagation();
        const url = tournament?.id && match?.id ? `/tournaments/${tournament.id}/match/${match.id}` : null;
        if (url) window.location.href = url;
    };

    const [isFormatMenuOpen, setIsFormatMenuOpen] = useState(false);

    const createLobbyWithFormat = async (format) => {
        if (!api || !tournament?.id || !match?.id) return;
        try {
            setIsCreatingLobby(true);
            const token = localStorage.getItem('token');
            const res = await api.post(
                `/api/tournaments/${tournament.id}/matches/${match.id}/create-lobby`,
                { matchFormat: format },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res?.data?.alreadyExists && isAdminOrCreator) {
                const confirmRecreate = window.confirm('Лобби этого матча ранее уже было создано, хотите пересоздать?');
                if (confirmRecreate) {
                    await api.post(
                        `/api/tournaments/${tournament.id}/matches/${match.id}/recreate-lobby`,
                        { matchFormat: format },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                }
            }
        } catch (err) {
            console.error('❌ Создание лобби не удалось:', err);
        } finally {
            setIsCreatingLobby(false);
            setIsFormatMenuOpen(false);
        }
    };

    const handleCreateLobby = (e) => {
        e.stopPropagation();
        setIsFormatMenuOpen(v => !v);
    };

    return (
        <div 
            className={`bracket-match-card ${getBracketTypeStyle()}${onMatchClick ? '' : ' not-clickable'}`}
            onClick={handleMatchClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ position: 'relative' }}
        >
            <div className="bracket-match-info">
                <span className="bracket-match-title">{getMatchTitle()}</span>
                <div className="bracket-match-indicators">
                    {(match.bracket_type === 'placement' || match.is_third_place_match) && (
                        <span className="bracket-type-indicator">🥉</span>
                    )}
                    {(match.bracket_type === 'final' || matchType === 'final') && (
                        <span className="bracket-type-indicator">🏆</span>
                    )}
                    {(match.bracket_type === 'grand_final' || match.bracket_type === 'grand_final_reset') && (
                        <span className="bracket-type-indicator">🏆</span>
                    )}
                    <span className="bracket-match-number">#{match.display_sequence || match.tournament_match_number || match.match_number || match.id}</span>
                </div>
            </div>
            
                <div className="bracket-match-participants">
                <div className={`bracket-participant ${participant1.name === 'TBD' ? 'tbd' : ''} ${participant1.isWinner ? 'winner' : ''} ${participant1.name && participant1.name.length > 18 ? 'score-tight' : ''}`}>
                    <span className="bracket-participant-name">{participant1.name}</span>
                    <span className="bracket-participant-score">{participant1.score || '-'}</span>
                </div>
                
                <div className={`bracket-participant ${participant2.name === 'TBD' ? 'tbd' : ''} ${participant2.isWinner ? 'winner' : ''} ${participant2.name && participant2.name.length > 18 ? 'score-tight' : ''}`}>
                    <span className="bracket-participant-name">{participant2.name}</span>
                    <span className="bracket-participant-score">{participant2.score || '-'}</span>
                </div>
            </div>
            
            <div className="bracket-match-status">
                <span className={`bracket-status-badge bracket-status-${matchStatus}`}>
                    {matchStatus === 'completed' ? 'Завершен' : 
                     matchStatus === 'ready' ? 'Готов' : 'Ожидание'}
                </span>
            </div>
            
            {canEditMatches && matchStatus === 'ready' && (
                <div className="bracket-edit-match-indicator">
                    <button 
                        className="bracket-edit-match-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEditMatch && onEditMatch(match);
                        }}
                    >
                        ✏️
                    </button>
                </div>
            )}

            {canShowActions && isHovered && (
                <div
                    className="bracket-match-actions"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        className="bracket-action-btn bracket-action-btn--neutral"
                        onClick={(e) => { e.stopPropagation(); const url = `/tournaments/${tournament.id}/match/${match.id}`; window.location.href = url; }}
                    >
                        Открыть матч
                    </button>
                    {activeLobbyId && (
                        <button
                            type="button"
                            className="bracket-action-btn bracket-action-btn--accent"
                            onClick={(e) => { e.stopPropagation(); window.location.href = `/lobby/${activeLobbyId}`; }}
                            title="Перейти в лобби"
                        >
                            Перейти в лобби
                        </button>
                    )}
                    <div className="bracket-format-menu-wrapper">
                        <button
                            type="button"
                            disabled={isCreatingLobby}
                            className={`bracket-action-btn bracket-action-btn--primary${isCreatingLobby ? ' is-disabled' : ''}`}
                            onClick={handleCreateLobby}
                            title="Создать лобби"
                        >
                            {isCreatingLobby ? 'Создание…' : 'Создать лобби'}
                        </button>
                        {isFormatMenuOpen && (
                            <div className="bracket-format-menu" onClick={(e) => e.stopPropagation()}>
                                {['bo1','bo3','bo5'].map(fmt => (
                                    <button
                                        key={fmt}
                                        type="button"
                                        className="bracket-format-menu-btn"
                                        onClick={() => createLobbyWithFormat(fmt)}
                                        title={`Создать лобби (${fmt.toUpperCase()})`}
                                    >
                                        {fmt.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {!canShowActions && isHovered && isCaptainForThisMatch && activeLobbyId && (
                <div
                    className="bracket-match-actions"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        className="bracket-action-btn bracket-action-btn--accent"
                        onClick={(e) => { e.stopPropagation(); window.location.href = `/lobby/${activeLobbyId}`; }}
                        title="Перейти в лобби"
                    >
                        Перейти в лобби
                    </button>
                </div>
            )}
        </div>
    );
};

export default BracketRenderer;