/**
 * TournamentFloatingActionPanel.integration.js
 * Пример интеграции плавающей панели в TournamentDetails.js
 * 
 * @purpose Демонстрация использования TournamentFloatingActionPanel
 * @author 1337 Community Development Team
 * @created 2025-01-22
 */

// ===== ИМПОРТ В НАЧАЛЕ ФАЙЛА TOURNAMENTDETAILS.JS =====
import TournamentFloatingActionPanel from './tournament/TournamentFloatingActionPanel';

// ===== ДОБАВИТЬ В КОМПОНЕНТ TOURNAMENTDETAILS =====

function TournamentDetails() {
    // ... существующий код ...

    // 🎯 ПРОВЕРКА НАЛИЧИЯ СЕТКИ И МАТЧЕЙ
    const hasBracket = useMemo(() => {
        // Проверяем наличие матчей или команд с турнирной сеткой
        return matches && matches.length > 0;
    }, [matches]);

    const hasMatches = useMemo(() => {
        // Проверяем наличие матчей с результатами
        return matches && matches.some(match => 
            match.winner_id || match.winner_team_id || 
            match.status === 'completed' || match.status === 'DONE'
        );
    }, [matches]);

    // 🎯 ОБРАБОТЧИКИ ДЕЙСТВИЙ ПЛАВАЮЩЕЙ ПАНЕЛИ
    
    // Начать турнир
    const handleStartTournament = useCallback(async () => {
        if (!tournament || tournament.status !== 'active') {
            setMessage('❌ Турнир должен быть в статусе "Активный"');
            return;
        }

        if (!hasBracket) {
            setMessage('❌ Необходимо сначала сгенерировать турнирную сетку');
            return;
        }

        // Показываем подтверждение
        setConfirmAction({
            type: 'start-tournament',
            title: 'Начать турнир',
            message: `Вы уверены, что хотите начать турнир "${tournament.name}"? После начала турнира сетка станет неизменяемой.`,
            onConfirm: async () => {
                try {
                    const response = await api.post(`/api/tournaments/${id}/start`);
                    if (response.data.success) {
                        setMessage('✅ Турнир успешно начат!');
                        reloadTournamentData();
                    }
                } catch (error) {
                    console.error('Ошибка запуска турнира:', error);
                    setMessage(`❌ Ошибка запуска турнира: ${error.response?.data?.message || error.message}`);
                }
                setShowConfirmModal(false);
            },
            onCancel: () => setShowConfirmModal(false)
        });
        setShowConfirmModal(true);
    }, [tournament, hasBracket, id, reloadTournamentData]);

    // Завершить турнир
    const handleEndTournament = useCallback(async () => {
        if (!tournament || tournament.status !== 'ongoing') {
            setMessage('❌ Турнир должен быть в статусе "Идет"');
            return;
        }

        setConfirmAction({
            type: 'end-tournament',
            title: 'Завершить турнир',
            message: `Вы уверены, что хотите завершить турнир "${tournament.name}"? Это действие нельзя будет отменить.`,
            onConfirm: async () => {
                try {
                    const response = await api.post(`/api/tournaments/${id}/end`);
                    if (response.data.success) {
                        setMessage('✅ Турнир успешно завершен!');
                        reloadTournamentData();
                    }
                } catch (error) {
                    console.error('Ошибка завершения турнира:', error);
                    setMessage(`❌ Ошибка завершения турнира: ${error.response?.data?.message || error.message}`);
                }
                setShowConfirmModal(false);
            },
            onCancel: () => setShowConfirmModal(false)
        });
        setShowConfirmModal(true);
    }, [tournament, id, reloadTournamentData]);

    // Сгенерировать турнирную сетку
    const handleGenerateBracket = useCallback(async () => {
        if (!tournament || tournament.status !== 'active') {
            setMessage('❌ Сетку можно генерировать только для активных турниров');
            return;
        }

        if (hasBracket) {
            setMessage('❌ Турнирная сетка уже существует. Используйте перегенерацию.');
            return;
        }

        setConfirmAction({
            type: 'generate-bracket',
            title: 'Сгенерировать турнирную сетку',
            message: `Создать турнирную сетку для турнира "${tournament.name}"? Участники будут автоматически распределены по сетке.`,
            onConfirm: async () => {
                try {
                    const response = await api.post(`/api/tournaments/${id}/generate-bracket`);
                    if (response.data.success) {
                        setMessage('✅ Турнирная сетка успешно сгенерирована!');
                        reloadTournamentData();
                    }
                } catch (error) {
                    console.error('Ошибка генерации сетки:', error);
                    setMessage(`❌ Ошибка генерации сетки: ${error.response?.data?.message || error.message}`);
                }
                setShowConfirmModal(false);
            },
            onCancel: () => setShowConfirmModal(false)
        });
        setShowConfirmModal(true);
    }, [tournament, hasBracket, id, reloadTournamentData]);

    // Перегенерировать турнирную сетку
    const handleRegenerateBracket = useCallback(async () => {
        if (!tournament || tournament.status !== 'active') {
            setMessage('❌ Сетку можно перегенерировать только для активных турниров');
            return;
        }

        if (!hasBracket) {
            setMessage('❌ Турнирная сетка еще не создана. Используйте генерацию.');
            return;
        }

        setConfirmAction({
            type: 'regenerate-bracket',
            title: 'Перегенерировать турнирную сетку',
            message: `Заново создать турнирную сетку для турнира "${tournament.name}"? Текущая сетка будет удалена и создана заново.`,
            onConfirm: async () => {
                try {
                    const response = await api.post(`/api/tournaments/${id}/regenerate-bracket`);
                    if (response.data.success) {
                        setMessage('✅ Турнирная сетка успешно перегенерирована!');
                        reloadTournamentData();
                    }
                } catch (error) {
                    console.error('Ошибка перегенерации сетки:', error);
                    setMessage(`❌ Ошибка перегенерации сетки: ${error.response?.data?.message || error.message}`);
                }
                setShowConfirmModal(false);
            },
            onCancel: () => setShowConfirmModal(false)
        });
        setShowConfirmModal(true);
    }, [tournament, hasBracket, id, reloadTournamentData]);

    // Очистить результаты матчей
    const handleClearResults = useCallback(async () => {
        if (!tournament || tournament.status !== 'ongoing') {
            setMessage('❌ Результаты можно очищать только для идущих турниров');
            return;
        }

        if (!hasMatches) {
            setMessage('❌ Нет результатов матчей для очистки');
            return;
        }

        setConfirmAction({
            type: 'clear-results',
            title: 'Очистить результаты матчей',
            message: `Удалить все результаты матчей турнира "${tournament.name}"? Все введенные результаты будут потеряны.`,
            onConfirm: async () => {
                try {
                    const response = await api.post(`/api/tournaments/${id}/clear-results`);
                    if (response.data.success) {
                        setMessage('✅ Результаты матчей успешно очищены!');
                        reloadTournamentData();
                    }
                } catch (error) {
                    console.error('Ошибка очистки результатов:', error);
                    setMessage(`❌ Ошибка очистки результатов: ${error.response?.data?.message || error.message}`);
                }
                setShowConfirmModal(false);
            },
            onCancel: () => setShowConfirmModal(false)
        });
        setShowConfirmModal(true);
    }, [tournament, hasMatches, id, reloadTournamentData]);

    // ... остальной код компонента ...

    return (
        <TournamentErrorBoundary>
            <div className="tournament-details">
                {/* ... существующий контент ... */}
                
                {/* ===== ПЛАВАЮЩАЯ ПАНЕЛЬ ДЕЙСТВИЙ (ВАРИАНТ 3) ===== */}
                <TournamentFloatingActionPanel
                    tournament={tournament}
                    user={user}
                    hasAccess={userPermissions.isAdminOrCreator}
                    onStartTournament={handleStartTournament}
                    onEndTournament={handleEndTournament}
                    onGenerateBracket={handleGenerateBracket}
                    onRegenerateBracket={handleRegenerateBracket}
                    onClearResults={handleClearResults}
                    hasMatches={hasMatches}
                    hasBracket={hasBracket}
                />

                {/* ... остальной контент ... */}
            </div>
        </TournamentErrorBoundary>
    );
}

// ===== АЛЬТЕРНАТИВНАЯ ИНТЕГРАЦИЯ С УСЛОВНЫМ РЕНДЕРИНГОМ =====

// Если нужно показывать панель только на определенных вкладках:
const shouldShowFloatingPanel = useMemo(() => {
    // Показываем только на вкладках, где управление имеет смысл
    const allowedTabs = ['info', 'bracket', 'participants', 'results'];
    return allowedTabs.includes(activeTab) && userPermissions.isAdminOrCreator;
}, [activeTab, userPermissions.isAdminOrCreator]);

// В JSX:
{shouldShowFloatingPanel && (
    <TournamentFloatingActionPanel
        tournament={tournament}
        user={user}
        hasAccess={userPermissions.isAdminOrCreator}
        onStartTournament={handleStartTournament}
        onEndTournament={handleEndTournament}
        onGenerateBracket={handleGenerateBracket}
        onRegenerateBracket={handleRegenerateBracket}
        onClearResults={handleClearResults}
        hasMatches={hasMatches}
        hasBracket={hasBracket}
    />
)}

// ===== ПРИМЕР КАСТОМИЗАЦИИ ПОЗИЦИОНИРОВАНИЯ =====

// Если нужно изменить позицию панели в зависимости от контекста:
const panelPosition = useMemo(() => {
    switch (activeTab) {
        case 'bracket':
            return { right: '20px', bottom: '80px' }; // Выше от сетки
        case 'results':
            return { right: '20px', bottom: '20px' }; // Стандартная позиция
        default:
            return { right: '20px', bottom: '20px' };
    }
}, [activeTab]);

// В CSS можно добавить:
// .tournament-floating-panel.custom-position {
//     right: var(--panel-right, 20px);
//     bottom: var(--panel-bottom, 20px);
// }

export default TournamentDetails; 