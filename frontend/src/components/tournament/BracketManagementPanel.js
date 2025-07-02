/**
 * 🏗️ ПАНЕЛЬ УПРАВЛЕНИЯ ТУРНИРНОЙ СЕТКОЙ v2.0
 * 
 * Новая система управления турнирной сеткой с интеграцией
 * в модульную архитектуру BracketController
 * 
 * ✅ ПОЛНАЯ ОБРАТНАЯ СОВМЕСТИМОСТЬ с существующими турнирами
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

    // Статистика турнирной сетки
    const bracketStatistics = useMemo(() => {
        if (!matches || matches.length === 0) {
            return null;
        }

        const totalMatches = matches.length;
        const completedMatches = matches.filter(m => m.winner_team_id).length;
        const participantsCount = tournament?.participants?.length || 0;
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
    }, [matches, tournament]);

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
                hasNewFields: !!tournament.seeding_type
            });
        }
    }, [tournament, getCurrentSeedingType, getCurrentSeedingConfig]);

    // Генерация турнирной сетки
    const handleGenerateBracket = useCallback(async () => {
        if (!tournament?.id || loading) return;

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            console.log('🚀 Генерация сетки через новую систему:', {
                tournamentId: tournament.id,
                seedingType: selectedSeedingType,
                thirdPlaceMatch,
                seedingConfig
            });

            const response = await api.post(`/api/tournaments/${tournament.id}/generate-bracket`, {
                seedingType: selectedSeedingType,
                thirdPlaceMatch,
                seedingOptions: seedingConfig
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
    }, [tournament?.id, selectedSeedingType, thirdPlaceMatch, seedingConfig, onBracketUpdate, loading]);

    // Регенерация турнирной сетки
    const handleRegenerateBracket = useCallback(async () => {
        if (!tournament?.id || loading) return;

        const confirmMessage = `🔄 Вы собираетесь регенерировать турнирную сетку.\n\n` +
            `ВНИМАНИЕ:\n` +
            `• Все результаты матчей будут удалены\n` +
            `• Сетка будет создана заново\n` +
            `• Участники будут перераспределены\n` +
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
                seedingConfig
            });

            const response = await api.post(`/api/tournaments/${tournament.id}/regenerate-bracket`, {
                seedingType: selectedSeedingType,
                thirdPlaceMatch,
                seedingOptions: seedingConfig
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
    }, [tournament?.id, selectedSeedingType, thirdPlaceMatch, seedingConfig, onBracketUpdate, loading]);

    // Предварительный просмотр распределения
    const handlePreviewSeeding = useCallback(async () => {
        if (!tournament?.id || loading) return;

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
                message += `Участников в сетке: ${preview.participants.length}\n`;
                
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
    }, [tournament?.id, selectedSeedingType, thirdPlaceMatch, seedingConfig, loading]);

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
                message += `Участников: ${stats.participantsCount}\n`;
                
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
    }, [tournament?.id, loading]);

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

    // Проверка наличия участников
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

    return (
        <div className="bracket-management-panel">
            <div className="panel-header">
                <h3>⚙️ Управление турнирной сеткой</h3>
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
                {!hasBracket ? (
                    // Раздел генерации новой сетки
                    <div className="generation-section">
                        <div className="bracket-info">
                            <p>🎯 Создание турнирной сетки</p>
                            <ul>
                                <li>Участников готово: {participantsCount}</li>
                                <li>Тип турнира: {tournament?.format || 'single_elimination'}</li>
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
                                <h4>🔧 Настройки распределения участников</h4>
                                
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

                                {selectedSeedingType === 'ranking' && (
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
                                <li>Участников в сетке: {bracketStatistics?.participantsInBracket}</li>
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
                                    ⚠️ Регенерация удалит все результаты матчей и создаст сетку заново с новым распределением участников.
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

                                {selectedSeedingType === 'ranking' && (
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
            </div>
        </div>
    );
};

export default BracketManagementPanel; 