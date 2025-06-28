import React, { useState, useCallback, useEffect } from 'react';
import TeamCard from '../TeamCard';
import './MixTeamManager.css';

/**
 * MixTeamManager v1.0.0 - Управление микс командами турнира
 * 
 * Интегрирован с новыми API эндпоинтами:
 * - POST /api/tournaments/:id/mix-generate-teams
 * - POST /api/tournaments/:id/mix-regenerate-teams
 * - GET /api/tournaments/:id/mix-original-participants
 * - PATCH /api/tournaments/:id/mix-team-size
 */
const MixTeamManager = ({
    tournament,
    isCreatorOrAdmin = false,
    ratingType = 'faceit',
    user,
    setMessage,
    onTeamsUpdated,
    onTournamentUpdated
}) => {
    const [teams, setTeams] = useState([]);
    const [originalParticipants, setOriginalParticipants] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [generationSummary, setGenerationSummary] = useState(null);
    const [teamSize, setTeamSize] = useState(tournament?.team_size || 5);

    /**
     * Загружает команды турнира
     */
    const loadTeams = useCallback(async () => {
        if (!tournament?.id) return;

        try {
            setIsLoading(true);
            const response = await fetch(`/api/tournaments/${tournament.id}/teams`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const teamsData = await response.json();
                setTeams(teamsData);
                if (onTeamsUpdated) {
                    onTeamsUpdated(teamsData);
                }
            } else {
                console.error('Ошибка загрузки команд:', response.status);
            }
        } catch (error) {
            console.error('Ошибка загрузки команд:', error);
        } finally {
            setIsLoading(false);
        }
    }, [tournament?.id, onTeamsUpdated]);

    /**
     * Загружает оригинальных участников (группированных по статусу в командах)
     */
    const loadOriginalParticipants = useCallback(async () => {
        if (!tournament?.id) return;

        try {
            const response = await fetch(`/api/tournaments/${tournament.id}/mix-original-participants`);

            if (response.ok) {
                const participantsData = await response.json();
                setOriginalParticipants(participantsData);
            } else {
                console.error('Ошибка загрузки участников:', response.status);
            }
        } catch (error) {
            console.error('Ошибка загрузки участников:', error);
        }
    }, [tournament?.id]);

    /**
     * Генерация микс команд
     */
    const generateMixTeams = useCallback(async (shuffle = false) => {
        if (!tournament?.id || !isCreatorOrAdmin) return;

        try {
            setIsGenerating(true);
            const response = await fetch(`/api/tournaments/${tournament.id}/mix-generate-teams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    ratingType,
                    shuffle
                })
            });

            const result = await response.json();

            if (response.ok) {
                setTeams(result.teams);
                setGenerationSummary(result.summary);
                setMessage({
                    type: 'success',
                    text: `✅ ${result.message}`
                });

                if (onTeamsUpdated) {
                    onTeamsUpdated(result.teams);
                }
                if (onTournamentUpdated && result.tournament) {
                    onTournamentUpdated(result.tournament);
                }
            } else {
                setMessage({
                    type: 'error',
                    text: `❌ ${result.error || 'Ошибка при формировании команд'}`
                });
            }
        } catch (error) {
            console.error('Ошибка генерации команд:', error);
            setMessage({
                type: 'error',
                text: '❌ Ошибка при формировании команд'
            });
        } finally {
            setIsGenerating(false);
        }
    }, [tournament?.id, isCreatorOrAdmin, ratingType, setMessage, onTeamsUpdated, onTournamentUpdated]);

    /**
     * Переформирование микс команд
     */
    const regenerateMixTeams = useCallback(async () => {
        if (!tournament?.id || !isCreatorOrAdmin) return;

        try {
            setIsRegenerating(true);
            const response = await fetch(`/api/tournaments/${tournament.id}/mix-regenerate-teams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    ratingType,
                    shuffle: true
                })
            });

            const result = await response.json();

            if (response.ok) {
                setTeams(result.teams);
                setGenerationSummary(result.summary);
                setMessage({
                    type: 'success',
                    text: `🔄 ${result.message}`
                });

                if (onTeamsUpdated) {
                    onTeamsUpdated(result.teams);
                }
                if (onTournamentUpdated && result.tournament) {
                    onTournamentUpdated(result.tournament);
                }
            } else {
                setMessage({
                    type: 'error',
                    text: `❌ ${result.error || 'Ошибка при переформировании команд'}`
                });
            }
        } catch (error) {
            console.error('Ошибка переформирования команд:', error);
            setMessage({
                type: 'error',
                text: '❌ Ошибка при переформировании команд'
            });
        } finally {
            setIsRegenerating(false);
        }
    }, [tournament?.id, isCreatorOrAdmin, ratingType, setMessage, onTeamsUpdated, onTournamentUpdated]);

    /**
     * Обновление размера команды
     */
    const updateTeamSize = useCallback(async (newSize) => {
        if (!tournament?.id || !isCreatorOrAdmin) return;

        try {
            const response = await fetch(`/api/tournaments/${tournament.id}/mix-team-size`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    teamSize: newSize
                })
            });

            const result = await response.json();

            if (response.ok) {
                setTeamSize(newSize);
                setMessage({
                    type: 'success',
                    text: `⚙️ ${result.message}`
                });

                if (onTournamentUpdated && result.tournament) {
                    onTournamentUpdated(result.tournament);
                }

                // Очищаем команды, так как размер изменился
                setTeams([]);
                setGenerationSummary(null);
            } else {
                setMessage({
                    type: 'error',
                    text: `❌ ${result.error || 'Ошибка при изменении размера команды'}`
                });
            }
        } catch (error) {
            console.error('Ошибка обновления размера команды:', error);
            setMessage({
                type: 'error',
                text: '❌ Ошибка при изменении размера команды'
            });
        }
    }, [tournament?.id, isCreatorOrAdmin, setMessage, onTournamentUpdated]);

    // Загружаем данные при монтировании компонента
    useEffect(() => {
        loadTeams();
        loadOriginalParticipants();
    }, [loadTeams, loadOriginalParticipants]);

    // Проверяем, является ли турнир микс турниром
    if (tournament?.format !== 'mix') {
        return null;
    }

    return (
        <div className="mix-team-manager">
            <div className="mix-team-manager-header">
                <h3>🔄 Управление микс командами</h3>
                
                {isCreatorOrAdmin && (
                    <div className="mix-team-controls">
                        {/* Настройка размера команды */}
                        <div className="team-size-control">
                            <label>Размер команды:</label>
                            <select 
                                value={teamSize} 
                                onChange={(e) => updateTeamSize(parseInt(e.target.value))}
                                disabled={teams.length > 0}
                            >
                                <option value={2}>2 игрока</option>
                                <option value={3}>3 игрока</option>
                                <option value={4}>4 игрока</option>
                                <option value={5}>5 игроков</option>
                            </select>
                        </div>

                        {/* Кнопки управления */}
                        <div className="team-action-buttons">
                            <button 
                                className="generate-teams-btn"
                                onClick={() => generateMixTeams(false)}
                                disabled={isGenerating || isRegenerating || originalParticipants.notInTeam?.length < teamSize * 2}
                            >
                                {isGenerating ? '⏳ Генерация...' : '🎯 Сформировать команды'}
                            </button>

                            {teams.length > 0 && (
                                <button 
                                    className="regenerate-teams-btn"
                                    onClick={regenerateMixTeams}
                                    disabled={isGenerating || isRegenerating}
                                >
                                    {isRegenerating ? '⏳ Переформирование...' : '🔄 Переформировать'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Статистика участников */}
            {originalParticipants.total > 0 && (
                <div className="participants-stats">
                    <div className="stat-item">
                        <span className="stat-label">Всего участников:</span>
                        <span className="stat-value">{originalParticipants.total}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">В командах:</span>
                        <span className="stat-value">{originalParticipants.inTeamCount}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Без команды:</span>
                        <span className="stat-value">{originalParticipants.notInTeamCount}</span>
                    </div>
                </div>
            )}

            {/* Сводка последней генерации */}
            {generationSummary && (
                <div className="generation-summary">
                    <h4>📊 Результат генерации</h4>
                    <div className="summary-stats">
                        <div className="summary-item">
                            <span>Создано команд:</span>
                            <strong>{generationSummary.teamsCount}</strong>
                        </div>
                        <div className="summary-item">
                            <span>Размещено игроков:</span>
                            <strong>{generationSummary.playersPlaced}</strong>
                        </div>
                        <div className="summary-item">
                            <span>Тип рейтинга:</span>
                            <strong>{generationSummary.ratingType === 'faceit' ? 'FACEIT ELO' : 'CS2 Premier'}</strong>
                        </div>
                        {generationSummary.balanceAchieved && (
                            <div className="summary-item success">
                                <span>✅ Баланс команд достигнут</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Отображение команд */}
            {isLoading ? (
                <div className="loading-teams">
                    <div className="loading-spinner"></div>
                    <p>Загрузка команд...</p>
                </div>
            ) : teams.length > 0 ? (
                <div className="teams-display">
                    <h4>🏆 Сформированные команды ({teams.length})</h4>
                    <div className="teams-grid">
                        {teams.map((team, index) => (
                            <TeamCard 
                                key={team.id} 
                                team={team} 
                                index={index}
                                ratingType={ratingType}
                            />
                        ))}
                    </div>
                </div>
            ) : originalParticipants.total > 0 ? (
                <div className="no-teams-message">
                    <div className="no-teams-icon">⚡</div>
                    <h4>Команды не сформированы</h4>
                    <p>
                        {isCreatorOrAdmin 
                            ? 'Нажмите "Сформировать команды" для автоматического создания сбалансированных команд'
                            : 'Ожидание формирования команд администратором турнира'
                        }
                    </p>
                    {originalParticipants.notInTeamCount < teamSize * 2 && (
                        <div className="insufficient-players-warning">
                            ⚠️ Недостаточно участников для формирования команд (требуется минимум {teamSize * 2})
                        </div>
                    )}
                </div>
            ) : (
                <div className="no-participants-message">
                    <div className="no-participants-icon">👥</div>
                    <h4>Нет участников</h4>
                    <p>Добавьте участников в турнир для формирования команд</p>
                </div>
            )}
        </div>
    );
};

export default MixTeamManager; 