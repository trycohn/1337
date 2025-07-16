/**
 * 🏗️ ПАНЕЛЬ УПРАВЛЕНИЯ ТУРНИРНОЙ СЕТКОЙ v2.0
 * 
 * Новая система управления турнирной сеткой с интеграцией
 * в модульную архитектуру BracketController
 * 
 * ✅ ПОЛНАЯ ОБРАТНАЯ СОВМЕСТИМОСТЬ с существующими турнирами
 * ✅ ПОЛНАЯ ПОДДЕРЖКА МИКС ТУРНИРОВ
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import api from '../../utils/api';

/**
 * 🎯 Основной компонент управления турнирной сеткой
 */
const BracketManagementPanel = ({ 
    tournament, 
    user, 
    matches = [], 
    isAdminOrCreator = false,
    onBracketUpdate 
}) => {
    // Состояния компонента
    const [loading, setLoading] = useState(false);
    const [showSeedingOptions, setShowSeedingOptions] = useState(false);
    const [selectedSeedingType, setSelectedSeedingType] = useState('random');
    const [seedingConfig, setSeedingConfig] = useState({});
    const [availableSeedingTypes, setAvailableSeedingTypes] = useState([]);
    const [showThirdPlaceOption, setShowThirdPlaceOption] = useState(false);
    const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false);
    
    // 🆕 Состояния для микс турниров
    const [mixTeams, setMixTeams] = useState([]);
    const [mixTeamsLoading, setMixTeamsLoading] = useState(false);
    const [showTeamFormation, setShowTeamFormation] = useState(false);

    // 🆕 Состояния для типа сетки
    const [selectedBracketType, setSelectedBracketType] = useState(tournament?.bracket_type || 'single_elimination');

    // 🆕 Обновляем selectedBracketType при изменении tournament
    useEffect(() => {
        if (tournament?.bracket_type) {
            setSelectedBracketType(tournament.bracket_type);
        }
    }, [tournament?.bracket_type]);

    // 🔧 ОБРАТНАЯ СОВМЕСТИМОСТЬ: Определяем тип распределения для существующих турниров
    const getCurrentSeedingType = useCallback(() => {
        // Если у турнира есть новое поле seeding_type, используем его
        if (tournament?.seeding_type) {
            return tournament.seeding_type;
        }
        
        // Иначе определяем по старой логике или возвращаем 'random' по умолчанию
        return 'random';
    }, [tournament]);

    // 🔧 ОБРАТНАЯ СОВМЕСТИМОСТЬ: Получаем конфигурацию распределения
    const getCurrentSeedingConfig = useCallback(() => {
        // Если у турнира есть новое поле seeding_config, используем его
        if (tournament?.seeding_config && typeof tournament.seeding_config === 'object') {
            return tournament.seeding_config;
        }
        
        // Иначе возвращаем пустой объект
        return {};
    }, [tournament]);

    // 🆕 ПРОВЕРКА МИКС ТУРНИРА
    const isMixTournament = useMemo(() => {
        return tournament?.format === 'mix';
    }, [tournament]);

    // 🆕 ПОЛУЧЕНИЕ КОМАНД ДЛЯ МИКС ТУРНИРА
    const loadMixTeams = useCallback(async () => {
        if (!isMixTournament || !tournament?.id) return;

        try {
            setMixTeamsLoading(true);
            const token = localStorage.getItem('token');
            
            const response = await api.get(`/api/tournaments/${tournament.id}/teams`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data && Array.isArray(response.data)) {
                setMixTeams(response.data);
                console.log(`🎮 Загружено ${response.data.length} команд для микс турнира`);
            } else {
                setMixTeams([]);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки команд микс турнира:', error);
            setMixTeams([]);
        } finally {
            setMixTeamsLoading(false);
        }
    }, [isMixTournament, tournament?.id]);

    // �� ПРОВЕРКА ГОТОВНОСТИ МИКС ТУРНИРА К ГЕНЕРАЦИИ СЕТКИ
    const mixTournamentStatus = useMemo(() => {
        if (!isMixTournament) {
            return { ready: true, reason: null };
        }

        const participantsCount = tournament?.participants?.length || 0;
        const teamsCount = mixTeams.length;
        const teamSize = tournament?.team_size || 5;
        const expectedTeams = Math.floor(participantsCount / teamSize);

        // 🔧 ИСПРАВЛЕНО: разрешаем создание сетки начиная с одной команды (teamSize участников)
        if (participantsCount < teamSize) {
            return { 
                ready: false, 
                reason: `Недостаточно участников для формирования команд. Нужно минимум ${teamSize} для создания 1 команды, а есть ${participantsCount}` 
            };
        }

        if (teamsCount === 0) {
            return { 
                ready: false, 
                reason: 'Команды еще не сформированы из соло участников' 
            };
        }

        if (teamsCount < 2) {
            return { 
                ready: false, 
                reason: `Недостаточно команд. Есть ${teamsCount}, а нужно минимум 2` 
            };
        }

        return { 
            ready: true, 
            reason: null,
            info: `Готово ${teamsCount} команд из ${participantsCount} участников`
        };
    }, [isMixTournament, tournament, mixTeams]);

    // 🆕 ФОРМИРОВАНИЕ КОМАНД ДЛЯ МИКС ТУРНИРА
    const handleFormMixTeams = useCallback(async () => {
        if (!tournament?.id || loading) return;

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            console.log('🎯 Формирование команд для микс турнира:', tournament.id);

            const response = await api.post(`/api/tournaments/${tournament.id}/mix-generate-teams`, {
                ratingType: tournament.mix_rating_type || 'faceit',
                shuffle: false
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                console.log('✅ Команды успешно сформированы:', response.data);
                
                // Перезагружаем команды
                await loadMixTeams();
                
                if (onBracketUpdate) {
                    onBracketUpdate({
                        type: 'teams_formed',
                        data: response.data,
                        message: response.data.message
                    });
                }
                
                setShowTeamFormation(false);
            } else {
                throw new Error(response.data.error || 'Ошибка формирования команд');
            }

        } catch (error) {
            console.error('❌ Ошибка формирования команд:', error);
            alert(`❌ Ошибка формирования команд: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    }, [tournament?.id, tournament?.mix_rating_type, onBracketUpdate, loading, loadMixTeams]);

    // Статистика турнирной сетки
    const bracketStatistics = useMemo(() => {
        if (!matches || matches.length === 0) {
            return null;
        }

        const totalMatches = matches.length;
        const completedMatches = matches.filter(m => m.winner_team_id).length;
        
        // Для микс турниров считаем команды, для обычных - участников
        const participantsCount = isMixTournament ? mixTeams.length : (tournament?.participants?.length || 0);
        const excludedCount = tournament?.excluded_participants_count || 0;
        const participantsInBracket = participantsCount - excludedCount;

        return {
            totalMatches,
            completedMatches,
            participantsCount,
            excludedCount,
            participantsInBracket,
            completionPercentage: totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
        };
    }, [matches, tournament, isMixTournament, mixTeams]);

    // Проверяем, существует ли турнирная сетка
    const hasBracket = matches && matches.length > 0;

    // Загрузка доступных типов распределения
    useEffect(() => {
        const loadSeedingTypes = async () => {
            try {
                const response = await api.get('/api/tournaments/seeding-types');
                if (response.data.success) {
                    setAvailableSeedingTypes(response.data.data.seedingTypes || []);
                }
            } catch (error) {
                console.error('❌ Ошибка загрузки типов распределения:', error);
                // Fallback для обратной совместимости
                setAvailableSeedingTypes([
                    { value: 'random', displayName: 'Случайное распределение', description: 'Участники распределяются случайно' },
                    { value: 'ranking', displayName: 'По рейтингу', description: 'Распределение по рейтингу участников' },
                    { value: 'balanced', displayName: 'Сбалансированное', description: 'Максимально сбалансированные матчи' },
                    { value: 'manual', displayName: 'Ручное', description: 'Настройка администратором' }
                ]);
            }
        };

        loadSeedingTypes();
    }, []);

    // Инициализация текущих настроек при загрузке турнира
    useEffect(() => {
        if (tournament) {
            const currentType = getCurrentSeedingType();
            const currentConfig = getCurrentSeedingConfig();
            
            setSelectedSeedingType(currentType);
            setSeedingConfig(currentConfig);
            
            console.log('🔧 Инициализация настроек для турнира:', {
                tournamentId: tournament.id,
                seedingType: currentType,
                seedingConfig: currentConfig,
                hasNewFields: !!tournament.seeding_type,
                isMixTournament
            });
        }
    }, [tournament, getCurrentSeedingType, getCurrentSeedingConfig, isMixTournament]);

    // 🆕 Загрузка команд для микс турниров
    useEffect(() => {
        if (isMixTournament) {
            loadMixTeams();
        }
    }, [isMixTournament, loadMixTeams]);

    // Генерация турнирной сетки
    const handleGenerateBracket = useCallback(async () => {
        if (!tournament?.id || loading) return;

        // 🆕 ПРОВЕРКА ДЛЯ МИКС ТУРНИРОВ
        if (isMixTournament && !mixTournamentStatus.ready) {
            alert(`❌ Нельзя создать сетку: ${mixTournamentStatus.reason}`);
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            console.log('🚀 Генерация сетки через новую систему:', {
                tournamentId: tournament.id,
                seedingType: selectedSeedingType,
                thirdPlaceMatch,
                seedingConfig,
                isMixTournament,
                teamsCount: mixTeams.length,
                bracketType: selectedBracketType
            });

            const response = await api.post(`/api/tournaments/${tournament.id}/generate-bracket`, {
                seedingType: selectedSeedingType,
                thirdPlaceMatch,
                seedingOptions: seedingConfig,
                bracketType: selectedBracketType
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                console.log('✅ Сетка успешно сгенерирована:', response.data);
                
                if (onBracketUpdate) {
                    onBracketUpdate({
                        type: 'generated',
                        data: response.data.data,
                        message: response.data.message
                    });
                }
                
                setShowSeedingOptions(false);
            } else {
                throw new Error(response.data.error || 'Ошибка генерации сетки');
            }

        } catch (error) {
            console.error('❌ Ошибка генерации сетки:', error);
            alert(`❌ Ошибка генерации сетки: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    }, [tournament?.id, selectedSeedingType, thirdPlaceMatch, seedingConfig, onBracketUpdate, loading, isMixTournament, mixTournamentStatus, mixTeams, selectedBracketType]);

    // Регенерация турнирной сетки
    const handleRegenerateBracket = useCallback(async () => {
        if (!tournament?.id || loading) return;

        // 🆕 ПРОВЕРКА ДЛЯ МИКС ТУРНИРОВ
        if (isMixTournament && !mixTournamentStatus.ready) {
            alert(`❌ Нельзя регенерировать сетку: ${mixTournamentStatus.reason}`);
            return;
        }

        const confirmMessage = `🔄 Вы собираетесь регенерировать турнирную сетку.\n\n` +
            `ВНИМАНИЕ:\n` +
            `• Все результаты матчей будут удалены\n` +
            `• Сетка будет создана заново\n` +
            `• Участники будут перераспределены\n` +
            (isMixTournament ? `• Команды останутся теми же (${mixTeams.length} команд)\n` : '') +
            `• Действие необратимо\n\n` +
            `Продолжить?`;

        if (!window.confirm(confirmMessage)) return;

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            console.log('🔄 Регенерация сетки через новую систему:', {
                tournamentId: tournament.id,
                seedingType: selectedSeedingType,
                thirdPlaceMatch,
                seedingConfig,
                isMixTournament,
                teamsCount: mixTeams.length,
                bracketType: selectedBracketType
            });

            const response = await api.post(`/api/tournaments/${tournament.id}/regenerate-bracket`, {
                seedingType: selectedSeedingType,
                thirdPlaceMatch,
                seedingOptions: seedingConfig,
                bracketType: selectedBracketType
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                console.log('✅ Сетка успешно регенерирована:', response.data);
                
                if (onBracketUpdate) {
                    onBracketUpdate({
                        type: 'regenerated',
                        data: response.data.data,
                        message: response.data.message
                    });
                }
                
                setShowSeedingOptions(false);
            } else {
                throw new Error(response.data.error || 'Ошибка регенерации сетки');
            }

        } catch (error) {
            console.error('❌ Ошибка регенерации сетки:', error);
            alert(`❌ Ошибка регенерации сетки: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    }, [tournament?.id, selectedSeedingType, thirdPlaceMatch, seedingConfig, onBracketUpdate, loading, isMixTournament, mixTournamentStatus, mixTeams, selectedBracketType]);

    // Предварительный просмотр распределения
    const handlePreviewSeeding = useCallback(async () => {
        if (!tournament?.id || loading) return;

        // 🆕 ПРОВЕРКА ДЛЯ МИКС ТУРНИРОВ
        if (isMixTournament && !mixTournamentStatus.ready) {
            alert(`❌ Нельзя показать предварительный просмотр: ${mixTournamentStatus.reason}`);
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            const response = await api.get(`/api/tournaments/${tournament.id}/seeding-preview`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    seedingType: selectedSeedingType,
                    thirdPlaceMatch,
                    seedingOptions: JSON.stringify(seedingConfig)
                }
            });

            if (response.data.success) {
                const preview = response.data.data;
                
                let message = `🎲 Предварительный просмотр распределения:\n\n`;
                
                if (isMixTournament) {
                    message += `Команд в сетке: ${preview.participants.length}\n`;
                    message += `Команд всего: ${mixTeams.length}\n`;
                } else {
                    message += `Участников в сетке: ${preview.participants.length}\n`;
                }
                
                if (preview.excludedParticipants.length > 0) {
                    message += `Исключено: ${preview.excludedParticipants.length}\n`;
                }
                
                message += `Матчей: ${preview.bracketMath.totalMatches}\n`;
                message += `Раундов: ${preview.bracketMath.totalRounds}`;
                
                alert(message);
            } else {
                throw new Error(response.data.error || 'Ошибка получения предварительного просмотра');
            }

        } catch (error) {
            console.error('❌ Ошибка предварительного просмотра:', error);
            alert(`❌ Ошибка: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    }, [tournament?.id, selectedSeedingType, thirdPlaceMatch, seedingConfig, loading, isMixTournament, mixTournamentStatus, mixTeams]);

    // Получение статистики турнирной сетки
    const handleGetStatistics = useCallback(async () => {
        if (!tournament?.id || loading) return;

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            const response = await api.get(`/api/tournaments/${tournament.id}/bracket-statistics`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                const stats = response.data.data;
                
                let message = `📊 Статистика турнирной сетки:\n\n`;
                message += `Всего матчей: ${stats.totalMatches}\n`;
                message += `Завершено: ${stats.completedMatches}\n`;
                message += `Прогресс: ${stats.completionPercentage}%\n`;
                
                if (isMixTournament) {
                    message += `Команд: ${mixTeams.length}\n`;
                } else {
                    message += `Участников: ${stats.participantsCount}\n`;
                }
                
                if (stats.excludedCount > 0) {
                    message += `Исключено: ${stats.excludedCount}\n`;
                }
                
                alert(message);
            } else {
                throw new Error(response.data.error || 'Ошибка получения статистики');
            }

        } catch (error) {
            console.error('❌ Ошибка получения статистики:', error);
            alert(`❌ Ошибка: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    }, [tournament?.id, loading, isMixTournament, mixTeams]);

    // Проверка прав доступа
    if (!isAdminOrCreator) {
        return (
            <div className="bracket-management-panel">
                <div className="access-denied">
                    <p>🔒 У вас нет прав для управления турнирной сеткой</p>
                    <small>Только создатель турнира и администраторы могут управлять сеткой</small>
                </div>
            </div>
        );
    }

    // 🆕 СПЕЦИАЛЬНАЯ ПРОВЕРКА ДЛЯ МИКС ТУРНИРОВ
    if (isMixTournament) {
        const participantsCount = tournament?.participants?.length || 0;
        const teamSize = tournament?.team_size || 5;
        // 🔧 ИСПРАВЛЕНО: требуем минимум teamSize участников для создания 1 команды
        const minParticipants = teamSize;

        if (participantsCount < minParticipants) {
            return (
                <div className="bracket-management-panel">
                    <div className="panel-header">
                        <h3>⚙️ Управление турнирной сеткой (Микс турнир)</h3>
                        <div className="bracket-status">
                            <span className="status-none">Недостаточно участников</span>
                        </div>
                    </div>
                    <div className="panel-content">
                        <div className="warning">
                            ⚠️ Для микс турнира с командами по {teamSize} игроков необходимо минимум {minParticipants} участников для создания хотя бы одной команды. 
                            Сейчас зарегистрировано: {participantsCount}
                            {participantsCount >= teamSize && participantsCount < teamSize * 2 && (
                                <div style={{ marginTop: '10px', color: '#ffa500' }}>
                                    💡 При {participantsCount} участниках будет создана 1 команда из {teamSize} игроков. 
                                    {participantsCount % teamSize > 0 && ` ${participantsCount % teamSize} участников останется вне команды.`}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
    } else {
        // Проверка наличия участников для обычных турниров
        const participantsCount = tournament?.participants?.length || 0;
        if (participantsCount < 2) {
            return (
                <div className="bracket-management-panel">
                    <div className="panel-header">
                        <h3>⚙️ Управление турнирной сеткой</h3>
                        <div className="bracket-status">
                            <span className="status-none">Недостаточно участников</span>
                        </div>
                    </div>
                    <div className="panel-content">
                        <div className="warning">
                            ⚠️ Для создания турнирной сетки необходимо минимум 2 участника. 
                            Сейчас зарегистрировано: {participantsCount}
                        </div>
                    </div>
                </div>
            );
        }
    }

    return (
        <div className="bracket-management-panel">
            <div className="panel-header">
                <h3>⚙️ Управление турнирной сеткой {isMixTournament && '(Микс турнир)'}</h3>
                <div className="bracket-status">
                    {hasBracket ? (
                        <span className="status-exists">
                            ✅ Сетка создана ({bracketStatistics?.totalMatches} матчей)
                        </span>
                    ) : (
                        <span className="status-none">
                            📋 Сетка не создана
                        </span>
                    )}
                </div>
            </div>

            <div className="panel-content">
                {/* 🆕 СПЕЦИАЛЬНАЯ СЕКЦИЯ ДЛЯ МИКС ТУРНИРОВ */}
                {isMixTournament && (
                    <div className="mix-tournament-section">
                        <div className="bracket-info">
                            <p>🎮 Микс турнир: команды формируются из соло участников</p>
                            <ul>
                                <li>Соло участников: {tournament?.participants?.length || 0}</li>
                                <li>Размер команды: {tournament?.team_size || 5}</li>
                                <li>Команд сформировано: {mixTeamsLoading ? 'Загрузка...' : mixTeams.length}</li>
                                <li>Статус: {mixTournamentStatus.ready ? '✅ Готов к созданию сетки' : `❌ ${mixTournamentStatus.reason}`}</li>
                                {mixTournamentStatus.info && <li>Инфо: {mixTournamentStatus.info}</li>}
                            </ul>
                        </div>

                        {/* Кнопки управления командами */}
                        {!mixTournamentStatus.ready && (
                            <div className="action-buttons">
                                <button 
                                    className="btn-primary"
                                    onClick={handleFormMixTeams}
                                    disabled={loading || mixTeamsLoading}
                                >
                                    {loading ? '⏳ Формирование...' : '🎯 Сформировать команды'}
                                </button>
                                
                                <button 
                                    className="btn-secondary"
                                    onClick={() => setShowTeamFormation(!showTeamFormation)}
                                    disabled={loading}
                                >
                                    {showTeamFormation ? '🔽 Скрыть настройки' : '⚙️ Настройки формирования'}
                                </button>
                            </div>
                        )}

                        {showTeamFormation && (
                            <div className="seeding-options">
                                <h4>🔧 Настройки формирования команд</h4>
                                <div className="option-group">
                                    <label>Тип рейтинга:</label>
                                    <select 
                                        value={tournament?.mix_rating_type || 'faceit'}
                                        disabled={true}
                                    >
                                        <option value="faceit">FACEIT ELO</option>
                                        <option value="premier">CS2 Premier Rank</option>
                                        <option value="mixed">Полный микс (без рейтинга)</option>
                                    </select>
                                    <small>Настройка доступна при создании турнира</small>
                                </div>
                            </div>
                        )}

                        {/* Отображение команд */}
                        {mixTeams.length > 0 && (
                            <div className="teams-preview">
                                <h4>👥 Сформированные команды ({mixTeams.length})</h4>
                                <div className="teams-list">
                                    {mixTeams.slice(0, 3).map((team, index) => (
                                        <div key={team.id} className="team-item">
                                            <strong>{team.name}</strong>
                                            {team.members && (
                                                <span> ({team.members.length} игроков)</span>
                                            )}
                                        </div>
                                    ))}
                                    {mixTeams.length > 3 && (
                                        <div className="team-item">
                                            <span>... и еще {mixTeams.length - 3} команд</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Основная логика генерации сетки */}
                {(!isMixTournament || mixTournamentStatus.ready) && (
                    <>
                        {!hasBracket ? (
                            // Раздел генерации новой сетки
                            <div className="generation-section">
                                <div className="bracket-info">
                                    <p>🎯 Создание турнирной сетки</p>
                                    <ul>
                                        {isMixTournament ? (
                                            <>
                                                <li>Команд готово: {mixTeams.length}</li>
                                                <li>Тип турнира: {tournament?.format || 'mix'}</li>
                                            </>
                                        ) : (
                                            <>
                                                <li>Участников готово: {tournament?.participants?.length || 0}</li>
                                                <li>Тип турнира: {tournament?.format || 'single_elimination'}</li>
                                            </>
                                        )}
                                        <li>Текущий тип распределения: {getCurrentSeedingType()}</li>
                                    </ul>
                                </div>

                                <div className="action-buttons">
                                    <button 
                                        className="btn-generate"
                                        onClick={() => setShowSeedingOptions(!showSeedingOptions)}
                                        disabled={loading}
                                    >
                                        {showSeedingOptions ? '🔽 Скрыть настройки' : '🎯 Настроить и создать сетку'}
                                    </button>
                                    
                                    <button 
                                        className="btn-secondary"
                                        onClick={handlePreviewSeeding}
                                        disabled={loading}
                                    >
                                        🎲 Предварительный просмотр
                                    </button>
                                </div>

                                {showSeedingOptions && (
                                    <div className="seeding-options">
                                        <h4>🔧 Настройки распределения {isMixTournament ? 'команд' : 'участников'}</h4>
                                        
                                        <div className="option-group">
                                            <label>Тип распределения:</label>
                                            <select 
                                                value={selectedSeedingType}
                                                onChange={(e) => setSelectedSeedingType(e.target.value)}
                                                disabled={loading}
                                            >
                                                {availableSeedingTypes.map(type => (
                                                    <option key={type.value} value={type.value}>
                                                        {type.displayName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {selectedSeedingType === 'ranking' && !isMixTournament && (
                                            <>
                                                <div className="option-group">
                                                    <label>Тип рейтинга:</label>
                                                    <select 
                                                        value={seedingConfig.ratingType || 'faceit_elo'}
                                                        onChange={(e) => setSeedingConfig(prev => ({
                                                            ...prev,
                                                            ratingType: e.target.value
                                                        }))}
                                                        disabled={loading}
                                                    >
                                                        <option value="faceit_elo">FACEIT ELO</option>
                                                        <option value="cs2_premier_rank">CS2 Premier Rank</option>
                                                    </select>
                                                </div>
                                                
                                                <div className="option-group">
                                                    <label>Направление сортировки:</label>
                                                    <select 
                                                        value={seedingConfig.direction || 'desc'}
                                                        onChange={(e) => setSeedingConfig(prev => ({
                                                            ...prev,
                                                            direction: e.target.value
                                                        }))}
                                                        disabled={loading}
                                                    >
                                                        <option value="desc">От сильных к слабым</option>
                                                        <option value="asc">От слабых к сильным</option>
                                                    </select>
                                                </div>
                                            </>
                                        )}

                                        {isMixTournament && selectedSeedingType === 'ranking' && (
                                            <div className="option-group">
                                                <small>ℹ️ Для микс турниров рейтинг команд рассчитывается автоматически на основе участников команды</small>
                                            </div>
                                        )}

                                        <div className="option-group">
                                            <label>
                                                <input 
                                                    type="checkbox"
                                                    checked={thirdPlaceMatch}
                                                    onChange={(e) => setThirdPlaceMatch(e.target.checked)}
                                                    disabled={loading}
                                                />
                                                Добавить матч за 3-е место
                                            </label>
                                        </div>

                                        <div className="action-buttons">
                                            <button 
                                                className="btn-primary"
                                                onClick={handleGenerateBracket}
                                                disabled={loading}
                                            >
                                                {loading ? '⏳ Создание...' : '🚀 Создать турнирную сетку'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Раздел управления существующей сеткой
                            <div className="management-section">
                                <div className="bracket-info">
                                    <p>📊 Статистика турнирной сетки</p>
                                    <ul>
                                        <li>Всего матчей: {bracketStatistics?.totalMatches}</li>
                                        <li>Завершено: {bracketStatistics?.completedMatches}</li>
                                        <li>Прогресс: {bracketStatistics?.completionPercentage}%</li>
                                        {isMixTournament ? (
                                            <li>Команд в сетке: {bracketStatistics?.participantsInBracket}</li>
                                        ) : (
                                            <li>Участников в сетке: {bracketStatistics?.participantsInBracket}</li>
                                        )}
                                        {bracketStatistics?.excludedCount > 0 && (
                                            <li>Исключено для выравнивания: {bracketStatistics.excludedCount}</li>
                                        )}
                                    </ul>
                                </div>

                                <div className="action-buttons">
                                    <button 
                                        className="btn-preview"
                                        onClick={handleGetStatistics}
                                        disabled={loading}
                                    >
                                        📊 Подробная статистика
                                    </button>
                                    
                                    <button 
                                        className="btn-secondary"
                                        onClick={() => setShowSeedingOptions(!showSeedingOptions)}
                                        disabled={loading}
                                    >
                                        {showSeedingOptions ? '🔽 Скрыть настройки' : '🔄 Настроить регенерацию'}
                                    </button>
                                </div>

                                {showSeedingOptions && (
                                    <div className="seeding-options">
                                        <h4>🔄 Регенерация турнирной сетки</h4>
                                        
                                        <div className="warning">
                                            ⚠️ Регенерация удалит все результаты матчей и создаст сетку заново с новым распределением {isMixTournament ? 'команд' : 'участников'}.
                                            {isMixTournament && ' Команды останутся прежними.'}
                                        </div>
                                        
                                        <div className="option-group">
                                            <label>Новый тип распределения:</label>
                                            <select 
                                                value={selectedSeedingType}
                                                onChange={(e) => setSelectedSeedingType(e.target.value)}
                                                disabled={loading}
                                            >
                                                {availableSeedingTypes.map(type => (
                                                    <option key={type.value} value={type.value}>
                                                        {type.displayName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* 🆕 Выбор типа турнирной сетки */}
                                        <div className="option-group">
                                            <label>Тип турнирной сетки:</label>
                                            <select 
                                                value={selectedBracketType}
                                                onChange={(e) => setSelectedBracketType(e.target.value)}
                                                disabled={loading}
                                            >
                                                <option value="single_elimination">
                                                    Single Elimination
                                                </option>
                                                <option value="double_elimination">
                                                    Double Elimination
                                                </option>
                                            </select>
                                            <small className="option-description">
                                                {selectedBracketType === 'single_elimination' 
                                                    ? 'Participants are eliminated after their first loss' 
                                                    : 'Participants are eliminated after two losses (Winners + Losers Bracket)'}
                                            </small>
                                        </div>

                                        {selectedSeedingType === 'ranking' && !isMixTournament && (
                                            <>
                                                <div className="option-group">
                                                    <label>Тип рейтинга:</label>
                                                    <select 
                                                        value={seedingConfig.ratingType || 'faceit_elo'}
                                                        onChange={(e) => setSeedingConfig(prev => ({
                                                            ...prev,
                                                            ratingType: e.target.value
                                                        }))}
                                                        disabled={loading}
                                                    >
                                                        <option value="faceit_elo">FACEIT ELO</option>
                                                        <option value="cs2_premier_rank">CS2 Premier Rank</option>
                                                    </select>
                                                </div>
                                                
                                                <div className="option-group">
                                                    <label>Направление сортировки:</label>
                                                    <select 
                                                        value={seedingConfig.direction || 'desc'}
                                                        onChange={(e) => setSeedingConfig(prev => ({
                                                            ...prev,
                                                            direction: e.target.value
                                                        }))}
                                                        disabled={loading}
                                                    >
                                                        <option value="desc">От сильных к слабым</option>
                                                        <option value="asc">От слабых к сильным</option>
                                                    </select>
                                                </div>
                                            </>
                                        )}

                                        <div className="option-group">
                                            <label>
                                                <input 
                                                    type="checkbox"
                                                    checked={thirdPlaceMatch}
                                                    onChange={(e) => setThirdPlaceMatch(e.target.checked)}
                                                    disabled={loading}
                                                />
                                                Добавить матч за 3-е место
                                            </label>
                                        </div>

                                        <div className="action-buttons-extended">
                                            <button 
                                                className="btn-danger"
                                                onClick={handleRegenerateBracket}
                                                disabled={loading}
                                            >
                                                {loading ? '⏳ Регенерация...' : '🔄 Регенерировать сетку'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default BracketManagementPanel; 