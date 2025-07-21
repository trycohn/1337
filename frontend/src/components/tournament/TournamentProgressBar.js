/**
 * TournamentProgressBar - Монохромный прогресс-бар турнира
 * @version 1.0.0
 * @created 2025-01-21
 * @author 1337 Community Development Team
 */

import React, { useMemo } from 'react';
import './TournamentProgressBar.css';

/**
 * Рассчитывает прогресс турнира на основе завершенных матчей
 * @param {Array} matches - Массив матчей турнира
 * @param {String} tournamentStatus - Статус турнира
 * @returns {Object} Объект с данными прогресса
 */
const calculateTournamentProgress = (matches = [], tournamentStatus) => {
    // Если турнир не начался
    if (tournamentStatus === 'registration') {
        return {
            percentage: 0,
            completedMatches: 0,
            totalMatches: matches.length,
            statusText: 'Регистрация участников',
            phase: 'registration'
        };
    }

    // Если турнир завершен
    if (tournamentStatus === 'completed') {
        return {
            percentage: 100,
            completedMatches: matches.length,
            totalMatches: matches.length,
            statusText: 'Турнир завершен',
            phase: 'completed'
        };
    }

    // Фильтруем только реальные матчи (исключаем технические)
    const realMatches = matches.filter(match => 
        match.team1_id && match.team2_id
    );

    const completedMatches = realMatches.filter(match => 
        match.status === 'completed' && match.winner_team_id
    );

    const totalMatches = realMatches.length;
    const completed = completedMatches.length;
    
    // Избегаем деления на ноль
    const percentage = totalMatches > 0 ? Math.round((completed / totalMatches) * 100) : 0;

    // Определяем фазу турнира
    let phase = 'active';
    let statusText = `${completed} из ${totalMatches} матчей завершено`;

    if (percentage === 0) {
        phase = 'starting';
        statusText = 'Турнир начинается';
    } else if (percentage >= 90) {
        phase = 'final';
        statusText = 'Финальная стадия';
    } else if (percentage >= 60) {
        phase = 'semifinals';
        statusText = 'Полуфинальная стадия';
    }

    return {
        percentage,
        completedMatches: completed,
        totalMatches,
        statusText,
        phase
    };
};

/**
 * Компонент TournamentProgressBar
 * @param {Object} props
 * @param {Array} props.matches - Массив матчей турнира
 * @param {String} props.tournamentStatus - Статус турнира
 * @param {String} props.tournamentName - Название турнира
 * @param {Boolean} props.showDetails - Показывать подробности
 * @param {Boolean} props.compact - Компактная версия
 * @returns {JSX.Element}
 */
const TournamentProgressBar = ({ 
    matches = [], 
    tournamentStatus = 'registration',
    tournamentName = '',
    showDetails = true,
    compact = false 
}) => {
    const progressData = useMemo(() => 
        calculateTournamentProgress(matches, tournamentStatus),
        [matches, tournamentStatus]
    );

    const { percentage, completedMatches, totalMatches, statusText, phase } = progressData;

    if (compact) {
        return (
            <div className={`tournament-progress-bar compact ${phase}`}>
                <div className="progress-header">
                    <div className="progress-title">
                        <h4>🏆 Прогресс турнира</h4>
                        <span className="progress-percentage">{percentage}%</span>
                    </div>
                </div>

                <div className="progress-bar-container">
                    <div className="progress-bar-background">
                        <div 
                            className="progress-bar-fill"
                            style={{ width: `${percentage}%` }}
                        >
                            <div className="progress-bar-glow"></div>
                        </div>
                    </div>
                </div>

                <div className="progress-stats compact">
                    <span className="stat-text">{statusText}</span>
                    <span className="stat-numbers">
                        {completedMatches} / {totalMatches} матчей
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={`tournament-progress-bar ${phase}`}>
            <div className="progress-header">
                <div className="progress-title">
                    <h3>🏆 Прогресс турнира</h3>
                    <span className="progress-percentage">{percentage}%</span>
                </div>
                <div className="progress-status">{statusText}</div>
            </div>

            <div className="progress-bar-container">
                <div className="progress-bar-background">
                    <div 
                        className="progress-bar-fill"
                        style={{ width: `${percentage}%` }}
                    >
                        <div className="progress-bar-glow"></div>
                    </div>
                </div>
                
                {/* Индикаторы этапов турнира */}
                <div className="progress-milestones">
                    <div className={`milestone ${percentage >= 25 ? 'completed' : ''}`} style={{ left: '25%' }}>
                        <div className="milestone-dot"></div>
                        <div className="milestone-label">1/4</div>
                    </div>
                    <div className={`milestone ${percentage >= 50 ? 'completed' : ''}`} style={{ left: '50%' }}>
                        <div className="milestone-dot"></div>
                        <div className="milestone-label">1/2</div>
                    </div>
                    <div className={`milestone ${percentage >= 75 ? 'completed' : ''}`} style={{ left: '75%' }}>
                        <div className="milestone-dot"></div>
                        <div className="milestone-label">3/4</div>
                    </div>
                    <div className={`milestone ${percentage >= 100 ? 'completed' : ''}`} style={{ left: '100%' }}>
                        <div className="milestone-dot"></div>
                        <div className="milestone-label">🏆</div>
                    </div>
                </div>
            </div>

            {showDetails && (
                <div className="progress-details">
                    <div className="progress-stats">
                        <div className="stat-item">
                            <span className="stat-value">{completedMatches}</span>
                            <span className="stat-label">Завершено</span>
                        </div>
                        <div className="stat-divider">•</div>
                        <div className="stat-item">
                            <span className="stat-value">{totalMatches - completedMatches}</span>
                            <span className="stat-label">Осталось</span>
                        </div>
                        <div className="stat-divider">•</div>
                        <div className="stat-item">
                            <span className="stat-value">{totalMatches}</span>
                            <span className="stat-label">Всего матчей</span>
                        </div>
                    </div>

                    {/* Фазовые индикаторы */}
                    <div className="phase-indicators">
                        <div className={`phase-indicator ${phase === 'registration' ? 'active' : phase === 'starting' || phase === 'active' || phase === 'semifinals' || phase === 'final' || phase === 'completed' ? 'completed' : ''}`}>
                            📝 Регистрация
                        </div>
                        <div className={`phase-indicator ${phase === 'starting' ? 'active' : phase === 'active' || phase === 'semifinals' || phase === 'final' || phase === 'completed' ? 'completed' : ''}`}>
                            ⚡ Старт
                        </div>
                        <div className={`phase-indicator ${phase === 'active' ? 'active' : phase === 'semifinals' || phase === 'final' || phase === 'completed' ? 'completed' : ''}`}>
                            🎯 Активная фаза
                        </div>
                        <div className={`phase-indicator ${phase === 'semifinals' ? 'active' : phase === 'final' || phase === 'completed' ? 'completed' : ''}`}>
                            🥇 Полуфинал
                        </div>
                        <div className={`phase-indicator ${phase === 'final' ? 'active' : phase === 'completed' ? 'completed' : ''}`}>
                            🏆 Финал
                        </div>
                        <div className={`phase-indicator ${phase === 'completed' ? 'active completed' : ''}`}>
                            ✅ Завершен
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentProgressBar; 