// frontend/src/components/BracketRenderer.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './BracketRenderer.css';

const BracketRenderer = ({
    games,
    canEditMatches,
    selectedMatch,
    setSelectedMatch,
    handleTeamClick,
    format
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
    // Добавляем состояние, которое гарантирует инициализацию обработчиков
    const [isInitialized, setIsInitialized] = useState(false);

    // Ссылки для работы с DOM
    const wrapperRef = useRef(null); // Внешний контейнер для обработчиков
    const bracketContentRef = useRef(null); // Внутренний контейнер для трансформации
    
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
    
    // ВАЖНО: Определяем все useCallback хуки в начале компонента, чтобы соблюдать правила хуков
    // Функция для открытия сетки в отдельной вкладке
    const handleOpenInNewTab = useCallback(() => {
        // Получаем данные из группировки
        const currentGroupedMatches = groupedMatches || { winnerRounds: {}, loserRounds: {}, placementMatch: null, grandFinalMatch: null };
        
        // Создаем копию текущего состояния сетки для передачи в новое окно
        const bracketData = {
            games: games || [],
            format: format || 'single_elimination',
            groupedMatches: currentGroupedMatches
        };
        
        // Создаем HTML-документ, который будет отображаться в новой вкладке
        const html = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Турнирная сетка</title>
            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    font-family: Arial, sans-serif;
                }
                .fullscreen-bracket {
                    width: 100%;
                    height: 100vh;
                    background-color: #f5f5f5;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    overflow: auto;
                }
                .bracket-header {
                    width: 100%;
                    padding: 10px;
                    background-color: #333;
                    color: white;
                    text-align: center;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }
                .bracket-container {
                    padding: 20px;
                    min-width: fit-content;
                    overflow: auto;
                }
                .bracket-grid {
                    display: flex;
                    gap: 50px;
                    margin-bottom: 30px;
                    align-items: center;
                    margin: 10px;
                    width: 100%;
                    height: 100%;
                    position: relative;
                }
                .round-column {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .match-card {
                    width: 200px;
                    background-color: white;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 10px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .match-title {
                    font-size: 0.8em;
                    color: #777;
                    margin-bottom: 5px;
                }
                .team {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 0;
                    border-bottom: 1px solid #eee;
                }
                .team:last-child {
                    border-bottom: none;
                }
                .winner {
                    font-weight: bold;
                    color: #333333;
                }
                .bracket-title {
                    font-size: 1.2em;
                    margin: 20px 0 10px 0;
                    color: #333;
                    font-weight: bold;
                }
                .bracket-divider {
                    width: 100%;
                    border: none;
                    border-top: 1px solid #ccc;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <div class="fullscreen-bracket">
                <div class="bracket-header">
                    <h1>Турнирная сетка</h1>
                </div>
                <div class="bracket-container" id="bracket-container"></div>
            </div>
            <script>
                // Вставляем данные сетки напрямую в скрипт
                const bracketData = ${JSON.stringify(bracketData)};
                
                // Функция для рендеринга сетки из данных
                function renderBracket() {
                    try {
                        const container = document.getElementById('bracket-container');
                        
                        // Создаем HTML для отображения сетки
                        let html = '';
                        
                        // Отображаем Winners Bracket
                        if (bracketData.groupedMatches.winnerRounds && Object.keys(bracketData.groupedMatches.winnerRounds).length > 0) {
                            html += '<h2 class="bracket-title">Основная сетка</h2>';
                            html += '<div class="bracket-grid">';
                            
                            // Отображаем раунды в порядке возрастания
                            const rounds = Object.keys(bracketData.groupedMatches.winnerRounds).sort((a, b) => Number(a) - Number(b));
                            
                            for (const round of rounds) {
                                const roundMatches = bracketData.groupedMatches.winnerRounds[round];
                                html += '<div class="round-column">';
                                html += '<h3>' + (round === '-1' ? 'Предварительный' : 'Раунд ' + round) + '</h3>';
                                
                                for (const match of roundMatches) {
                                    html += renderMatch(match);
                                }
                                
                                html += '</div>';
                            }
                            
                            html += '</div>';
                        }
                        
                        // Отображаем Losers Bracket
                        if (bracketData.format === 'double_elimination' && 
                            bracketData.groupedMatches.loserRounds && 
                            Object.keys(bracketData.groupedMatches.loserRounds).length > 0) {
                            html += '<hr class="bracket-divider">';
                            html += '<h2 class="bracket-title">Нижняя сетка</h2>';
                            html += '<div class="bracket-grid">';
                            
                            const rounds = Object.keys(bracketData.groupedMatches.loserRounds).sort((a, b) => Number(a) - Number(b));
                            
                            for (const round of rounds) {
                                const roundMatches = bracketData.groupedMatches.loserRounds[round];
                                html += '<div class="round-column">';
                                html += '<h3>Раунд ' + round + '</h3>';
                                
                                for (const match of roundMatches) {
                                    html += renderMatch(match);
                                }
                                
                                html += '</div>';
                            }
                            
                            html += '</div>';
                        }
                        
                        // Отображаем финальные матчи
                        if (bracketData.groupedMatches.grandFinalMatch || bracketData.groupedMatches.placementMatch) {
                            html += '<hr class="bracket-divider">';
                            html += '<h2 class="bracket-title">Финальные матчи</h2>';
                            html += '<div class="bracket-grid">';
                            
                            if (bracketData.groupedMatches.grandFinalMatch) {
                                html += '<div class="round-column">';
                                html += '<h3>Большой финал</h3>';
                                html += renderMatch(bracketData.groupedMatches.grandFinalMatch);
                                html += '</div>';
                            }
                            
                            if (bracketData.groupedMatches.placementMatch) {
                                html += '<div class="round-column">';
                                html += '<h3>Матч за 3-е место</h3>';
                                html += renderMatch(bracketData.groupedMatches.placementMatch);
                                html += '</div>';
                            }
                            
                            html += '</div>';
                        }
                            
                            container.innerHTML = html;
                        } catch (error) {
                            console.error('Ошибка при рендеринге сетки:', error);
                            document.getElementById('bracket-container').innerHTML = '<p>Ошибка при рендеринге сетки: ' + error.message + '</p>';
                        }
                    }
                    
                    // Функция для рендеринга матча
                    function renderMatch(match) {
                        let html = '<div class="match-card">';
                        html += '<div class="match-title">' + (match.name || 'Матч') + '</div>';
                        
                        if (match.participants && match.participants.length >= 2) {
                            for (const participant of match.participants) {
                                const isWinner = participant.isWinner;
                                html += '<div class="team ' + (isWinner ? 'winner' : '') + '">';
                                html += '<span>' + (participant.name || 'TBD') + '</span>';
                                html += '<span>' + (participant.score !== undefined ? participant.score : '-') + '</span>';
                                html += '</div>';
                            }
                        } else {
                            html += '<div class="team">TBD</div>';
                            html += '<div class="team">TBD</div>';
                        }
                        
                        html += '</div>';
                        return html;
                    }
                    
                    // Запускаем рендеринг после загрузки страницы
                    window.onload = renderBracket;
                </script>
            </body>
            </html>
        `;
        
        // Создаем Blob с HTML-содержимым
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        // Открываем новую вкладку с созданным URL
        window.open(url, '_blank');
    }, [games, format, groupedMatches]);
    
    // Функция для притягивания сетки к краю - полностью упрощена
    const snapToBoundary = useCallback(() => {
        // Отключаем тряску - просто разрешаем свободное перемещение сетки
        // Эта функция вызывается только при отпускании мыши, а не каждый кадр
    }, []);
    
    // Обработчик изменения масштаба с проверкой границ - убираем вызов snapToBoundary
    const handleScaleChange = useCallback((newScale) => {
        console.log(`handleScaleChange: масштаб изменен на ${newScale}`);
        setScale(newScale);
        // Не вызываем snapToBoundary - это вызывает проблемы с производительностью
    }, []);
    
    // Сброс вида - определяем ДО использования!
    const resetView = useCallback(() => {
        console.log('Запуск resetView');
        if (!wrapperRef.current || !bracketContentRef.current) {
            console.warn('resetView: DOM элементы не найдены');
            return;
        }

        const wrapperWidth = wrapperRef.current.clientWidth;
        const wrapperHeight = wrapperRef.current.clientHeight;
        const contentWidth = bracketContentRef.current.clientWidth;
        const contentHeight = bracketContentRef.current.clientHeight;

        console.log(`resetView: wrapper (${wrapperWidth}x${wrapperHeight}), content (${contentWidth}x${contentHeight})`);

        // Отображаем левый верхний угол сетки вместо центрирования
        // Небольшое смещение от самого края для лучшей видимости
        const newX = 20; // Небольшой отступ от левого края
        const newY = 20; // Небольшой отступ сверху
        
        // Устанавливаем новые значения позиции и масштаба
        console.log(`resetView: установка новой позиции (${newX}, ${newY}), масштаб 1`);
        setPosition({ x: newX, y: newY });
        setScale(1);
    }, []);
    
    // Обработчики для кнопок масштабирования
    const handleZoomIn = useCallback(() => {
        console.log('handleZoomIn: увеличиваем масштаб');
        const newScale = Math.min(scale + 0.1, 3);
        handleScaleChange(newScale);
    }, [scale, handleScaleChange]);
    
    const handleZoomOut = useCallback(() => {
        console.log('handleZoomOut: уменьшаем масштаб');
        const newScale = Math.max(scale - 0.1, 0.5);
        handleScaleChange(newScale);
    }, [scale, handleScaleChange]);
    
    const handleResetView = useCallback(() => {
        console.log('handleResetView: сбрасываем вид');
        resetView();
    }, [resetView]);
    
    // --- Логика перетаскивания и масштабирования ---
    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return; // Только левая кнопка
        // Не начинаем перетаскивание, если клик был на элементе управления (например, кнопке)
        if (e.target.closest('button, .custom-seed')) {
            return;
        }
        
        console.log('handleMouseDown - начинаем перетаскивание');
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

    // Отключаем вызов snapToBoundary при окончании перетаскивания
    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            if (wrapperRef.current) {
                wrapperRef.current.style.cursor = 'grab';
            }
            // Не вызываем snapToBoundary - это вызывает проблемы с производительностью
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
            // Не вызываем snapToBoundary - это вызывает проблемы с производительностью
        }
    }, [isDragging]);

    const handleWheel = useCallback((e) => {
        e.preventDefault(); // Предотвратить скролл страницы
        const scaleAmount = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(scale + scaleAmount, 0.5), 3); // Ограничения масштаба

        if (bracketContentRef.current) {
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
            // Используем handleScaleChange вместо прямой установки масштаба
            handleScaleChange(newScale);
        }
    }, [scale, position, handleScaleChange]);

    // Установка и удаление обработчиков
    useEffect(() => {
        console.log('BracketRenderer: установка обработчиков событий');
        const wrapper = wrapperRef.current;
        if (wrapper) {
            // Очистим существующие обработчики, если они есть
            wrapper.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            wrapper.removeEventListener('wheel', handleWheel);
            wrapper.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            
            // Установим новые обработчики
            wrapper.addEventListener('mousedown', handleMouseDown);
            wrapper.addEventListener('wheel', handleWheel, { passive: false });
            wrapper.addEventListener('touchstart', handleTouchStart, { passive: false });

            // Mousemove и mouseup слушаем на window, чтобы отловить отпускание кнопки вне wrapper
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleTouchEnd);
            
            // Устанавливаем курсор grab по умолчанию
            wrapper.style.cursor = 'grab';
            
            console.log('BracketRenderer: обработчики событий установлены');
        } else {
            console.warn('BracketRenderer: wrapperRef не инициализирован');
        }

        return () => {
            console.log('BracketRenderer: очистка обработчиков событий');
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
    }, [handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

    // Удаляем текущий useEffect для инициализации
    // и заменяем на более надежную версию
    useEffect(() => {
        console.log('BracketRenderer: первоначальная проверка DOM-элементов');
        
        // Создаем функцию для инициализации, которая будет вызываться несколько раз
        const initializeDragDrop = () => {
            if (wrapperRef.current && bracketContentRef.current) {
                console.log('BracketRenderer: DOM-элементы найдены, инициализация');
                
                // Устанавливаем курсор
                wrapperRef.current.style.cursor = 'grab';
                
                // Устанавливаем исходную позицию на левый верхний угол с отступами
                setPosition({ x: 20, y: 20 });
                
                // Устанавливаем состояние инициализации
                setIsInitialized(true);
                
                console.log('BracketRenderer: инициализация завершена');
                return true;
            }
            console.log('BracketRenderer: DOM-элементы не найдены, откладываем инициализацию');
            return false;
        };
        
        // Пытаемся инициализировать сразу
        if (!initializeDragDrop()) {
            // Если не получилось, пробуем через 100мс
            const timer1 = setTimeout(() => {
                if (!initializeDragDrop()) {
                    // Если все еще не получилось, пробуем через 500мс
                    const timer2 = setTimeout(() => {
                        if (!initializeDragDrop()) {
                            // Последняя попытка через 1с
                            const timer3 = setTimeout(() => {
                                initializeDragDrop();
                                console.log('BracketRenderer: последняя попытка инициализации');
                            }, 1000);
                            return () => clearTimeout(timer3);
                        }
                    }, 500);
                    return () => clearTimeout(timer2);
                }
            }, 100);
            return () => clearTimeout(timer1);
        }
    }, []);
    
    // Отдельный эффект для принудительного центрирования и масштабирования
    useEffect(() => {
        if (isInitialized && wrapperRef.current && bracketContentRef.current) {
            console.log('BracketRenderer: применение начального вида');
            
            // Применяем начальный вид с задержкой
            const resetTimer = setTimeout(() => {
                resetView();
                console.log('BracketRenderer: начальный вид применен');
            }, 300);
            
            return () => clearTimeout(resetTimer);
        }
    }, [isInitialized, resetView]);
    
    // Добавляем обработчик для MutationObserver, чтобы отслеживать изменения в DOM
    useEffect(() => {
        if (!isInitialized && wrapperRef.current) {
            console.log('BracketRenderer: установка MutationObserver');
            
            // Проверяем, что MutationObserver доступен в браузере
            if (typeof MutationObserver === 'undefined') {
                console.warn('BracketRenderer: MutationObserver не поддерживается');
                // Если MutationObserver не поддерживается, делаем более простую инициализацию
                if (wrapperRef.current && bracketContentRef.current) {
                    setIsInitialized(true);
                    setTimeout(resetView, 300);
                }
                return;
            }
            
            // Создаем наблюдатель за изменениями DOM
            const observer = new MutationObserver((mutations) => {
                console.log('BracketRenderer: обнаружены изменения в DOM');
                if (!isInitialized && wrapperRef.current && bracketContentRef.current) {
                    // Если компонент еще не инициализирован, но DOM-элементы готовы
                    setIsInitialized(true);
                    
                    // Применяем начальный вид с задержкой
                    setTimeout(() => {
                        // Используем resetView, который теперь показывает левый верхний угол
                        resetView();
                        console.log('BracketRenderer: начальный вид применен после изменений DOM');
                    }, 300);
                }
            });
            
            // Запускаем наблюдение
            observer.observe(wrapperRef.current, {
                childList: true,
                subtree: true,
                attributes: true
            });
            
            return () => {
                observer.disconnect();
                console.log('BracketRenderer: MutationObserver отключен');
            };
        }
    }, [isInitialized, resetView]);
    
    // Добавляем обработчик для document.DOMContentLoaded и window.load
    useEffect(() => {
        // Функция, которая будет вызываться при полной загрузке страницы
        const handleFullLoad = () => {
            console.log('BracketRenderer: window.onload или DOMContentLoaded');
            if (!isInitialized && wrapperRef.current && bracketContentRef.current) {
                console.log('BracketRenderer: инициализация после полной загрузки страницы');
                setIsInitialized(true);
                
                // Небольшая задержка для гарантии
                setTimeout(() => {
                    // Вызываем resetView для установки начальной позиции
                    resetView();
                    console.log('BracketRenderer: вид сброшен после полной загрузки');
                }, 300);
            }
        };
        
        // Проверяем, загружен ли уже документ
        if (document.readyState === 'complete') {
            handleFullLoad();
        } else {
            // Если нет, добавляем слушатели событий
            window.addEventListener('load', handleFullLoad);
            document.addEventListener('DOMContentLoaded', handleFullLoad);
            
            return () => {
                window.removeEventListener('load', handleFullLoad);
                document.removeEventListener('DOMContentLoaded', handleFullLoad);
            };
        }
    }, [isInitialized, resetView]);

    // Обработчик изменения размера окна для адаптивности
    useEffect(() => {
        const handleResize = () => {
            // Устанавливаем адаптивную высоту для турнирной сетки
            if (wrapperRef.current) {
                const windowHeight = window.innerHeight;
                // Для мобильных устройств
                if (window.innerWidth < 768) {
                    // Используем почти всю высоту экрана для мобильных
                    wrapperRef.current.style.height = `${windowHeight - 100}px`;
                } else if (window.innerWidth >= 1028) {
                    // Для десктопа используем фиксированную высоту
                    wrapperRef.current.style.height = '800px';
                } else {
                    // Для промежуточных размеров
                    wrapperRef.current.style.height = '600px';
                }
            }
            
            // НЕ вызываем snapToBoundary при каждом изменении размера
            // это может вызывать проблемы с производительностью
        };
        
        // Вызываем обработчик при монтировании компонента
        handleResize();
        
        // Используем throttle для обработчика resize
        let resizeTimeout;
        const throttledResize = () => {
            if (!resizeTimeout) {
                resizeTimeout = setTimeout(() => {
                    resizeTimeout = null;
                    handleResize();
                }, 200); // Задержка в 200мс
            }
        };
        
        window.addEventListener('resize', throttledResize);
        return () => {
            window.removeEventListener('resize', throttledResize);
            if (resizeTimeout) {
                clearTimeout(resizeTimeout);
            }
        };
    }, []);

    // Обновление сгруппированных матчей при изменении games
    useEffect(() => {
        setGroupedMatches(groupMatchesByRoundAndBracket());
    }, [games, groupMatchesByRoundAndBracket]);

    // Проверка границ после каждого изменения масштаба - отключаем чтобы избежать тряски
    useEffect(() => {
        // Отключаем автоматическую проверку границ, она вызывает тряску
        // const timer = setTimeout(snapToBoundary, 50);
        // return () => clearTimeout(timer);
    }, [scale]);

    // --- Конец логики перетаскивания и масштабирования ---

    // Если нет данных для отображения, показываем сообщение
    if (!games || !Array.isArray(games) || games.length === 0) {
        console.log('BracketRenderer: пустой массив games или он не определен', games);
        return <div className="empty-bracket-message">Нет доступных матчей для отображения.</div>;
    }

    const { winnerRounds, loserRounds, placementMatch, grandFinalMatch } = groupedMatches;
    console.log('BracketRenderer: группировка матчей завершена', { 
        winnerRoundsKeys: Object.keys(winnerRounds), 
        loserRoundsKeys: Object.keys(loserRounds),  
        hasPlacementMatch: !!placementMatch, 
        hasGrandFinalMatch: !!grandFinalMatch 
    });
    
    const winnerRoundKeys = Object.keys(winnerRounds);
    const hasWinnerMatches = winnerRoundKeys.length > 0 || Object.keys(loserRounds).length > 0 || placementMatch || grandFinalMatch;

    if (!hasWinnerMatches) {
        console.log('BracketRenderer: нет матчей для отображения после группировки');
        return <div className="empty-bracket-message">Нет доступных матчей для отображения.</div>;
    }

    // Функция для безопасного преобразования ID в число
    const safeParseInt = (id) => {
        if (id === undefined || id === null) return null;
        return typeof id === 'string' ? parseInt(id) : id;
    };

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
                        {winnerRoundKeys.sort((a, b) => Number(a) - Number(b)).map((round) => {
                            const roundMatches = winnerRounds[round];
                            if (!roundMatches || roundMatches.length === 0) return null;

                            return (
                                <div key={`w-${round}`} className="round-column">
                                    <h3>
                                        {round === '-1'
                                            ? 'Предварительный'
                                            : `Раунд ${round}`}
                                    </h3>
                                    {roundMatches.map((match) => {
                                        const isSelected = selectedMatch === safeParseInt(match.id);
                                        return (
                                            <div
                                                key={match.id}
                                                className={`custom-seed ${isSelected ? 'selected' : ''}`}
                                                onClick={(e) => {
                                                      if (canEditMatches && match.state !== 'DONE') {
                                                          setSelectedMatch(isSelected ? null : safeParseInt(match.id));
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
                                                        <span className={`team-name${!match.participants[0]?.name ? ' placeholder' : ''}`}>{match.participants[0]?.name?.slice(0, 20) || 'TBD'}</span>
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
                                                        <span className={`team-name${!match.participants[1]?.name ? ' placeholder' : ''}`}>{match.participants[1]?.name?.slice(0, 20) || 'TBD'}</span>
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
                            <h2 className="bracket-title">Нижняя сетка</h2>
                            <div className="bracket-grid">
                                {Object.keys(loserRounds).sort((a, b) => Number(a) - Number(b)).map((round) => {
                                    const roundMatches = loserRounds[round];
                                    return roundMatches && roundMatches.length > 0 ? (
                                        <div key={`l-${round}`} className="round-column">
                                            <h3>Раунд {round}</h3>
                                            {roundMatches.map((match) => {
                                                const isSelected = selectedMatch === safeParseInt(match.id);
                                                return (
                                                    <div
                                                        key={match.id}
                                                        className={`custom-seed ${isSelected ? 'selected' : ''}`}
                                                         onClick={(e) => {
                                                               if (canEditMatches && match.state !== 'DONE') {
                                                                   setSelectedMatch(isSelected ? null : safeParseInt(match.id));
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
                                                                <span className={`team-name${!match.participants[0]?.name ? ' placeholder' : ''}`}>{match.participants[0]?.name?.slice(0, 20) || 'TBD'}</span>
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
                                                                <span className={`team-name${!match.participants[1]?.name ? ' placeholder' : ''}`}>{match.participants[1]?.name?.slice(0, 20) || 'TBD'}</span>
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
                {(placementMatch || grandFinalMatch) && 
                    <>
                        <hr className="bracket-divider" />
                        <div className="final-matches-container">
                            <h2 className="bracket-title">Финальные матчи</h2>
                            <div className="final-matches-grid">
                                {grandFinalMatch && (
                                    <div className="bracket grand-final">
                                        <h3 className="match-title">Большой финал</h3>
                                        <div
                                            key={grandFinalMatch.id}
                                            className={`custom-seed ${selectedMatch === safeParseInt(grandFinalMatch.id) ? 'selected' : ''}`}
                                            onClick={(e) => {
                                                if (canEditMatches && grandFinalMatch.state !== 'DONE') {
                                                    setSelectedMatch(selectedMatch === safeParseInt(grandFinalMatch.id) ? null : safeParseInt(grandFinalMatch.id));
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
                                                    <span className={`team-name${!grandFinalMatch.participants[0]?.name ? ' placeholder' : ''}`}>{grandFinalMatch.participants[0]?.name?.slice(0, 20) || 'TBD'}</span>
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
                                                    <span className={`team-name${!grandFinalMatch.participants[1]?.name ? ' placeholder' : ''}`}>{grandFinalMatch.participants[1]?.name?.slice(0, 20) || 'TBD'}</span>
                                                    <span className="team-score">
                                                        {grandFinalMatch.participants[1]?.score ?? '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {placementMatch && (
                                    <div className="bracket placement-match">
                                        <h3 className="match-title">Матч за 3-е место</h3>
                                        <div
                                            key={placementMatch.id}
                                            className={`custom-seed ${selectedMatch === safeParseInt(placementMatch.id) ? 'selected' : ''}`}
                                            onClick={(e) => {
                                                if (canEditMatches && placementMatch.state !== 'DONE') {
                                                    setSelectedMatch(selectedMatch === safeParseInt(placementMatch.id) ? null : safeParseInt(placementMatch.id));
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
                                                    <span className={`team-name${!placementMatch.participants[0]?.name ? ' placeholder' : ''}`}>{placementMatch.participants[0]?.name?.slice(0, 20) || 'TBD'}</span>
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
                                                    <span className={`team-name${!placementMatch.participants[1]?.name ? ' placeholder' : ''}`}>{placementMatch.participants[1]?.name?.slice(0, 20) || 'TBD'}</span>
                                                    <span className="team-score">
                                                        {placementMatch.participants[1]?.score ?? '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                }
            </div>
        </div>
    );
};

export default BracketRenderer;