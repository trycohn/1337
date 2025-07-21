/**
 * TournamentProgressBar - Простой прогресс-бар турнира
 * @version 2.0.0
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
            statusText: 'Регистрация участников'
        };
    }

    // Если турнир завершен
    if (tournamentStatus === 'completed') {
        return {
            percentage: 100,
            completedMatches: matches.length,
            totalMatches: matches.length,
            statusText: 'Турнир завершен'
        };
    }

    // Фильтруем только реальные матчи (исключаем технические)
    const realMatches = matches.filter(match => 
        match.team1_id && match.team2_id
    );

    // 🔧 ИСПРАВЛЕНО: правильная проверка завершенных матчей
    const completedMatches = realMatches.filter(match => {
        // Проверяем по state (DONE или SCORE_DONE) или по наличию счета
        const hasValidState = match.state === 'DONE' || match.state === 'SCORE_DONE';
        const hasScore = (match.score1 !== null && match.score1 !== undefined) || 
                        (match.score2 !== null && match.score2 !== undefined);
        
        return hasValidState || hasScore;
    });

    const totalMatches = realMatches.length;
    const completed = completedMatches.length;
    
    // 🔧 ОТЛАДКА: логируем данные для проверки
    console.log('🏆 TournamentProgressBar Debug:', {
        tournamentStatus,
        totalMatches: matches.length,
        realMatches: realMatches.length,
        completedMatches: completed,
        percentage: totalMatches > 0 ? Math.round((completed / totalMatches) * 100) : 0,
        sampleMatch: realMatches[0] ? {
            id: realMatches[0].id,
            state: realMatches[0].state,
            score1: realMatches[0].score1,
            score2: realMatches[0].score2,
            team1_id: realMatches[0].team1_id,
            team2_id: realMatches[0].team2_id
        } : null
    });

    // Избегаем деления на ноль
    const percentage = totalMatches > 0 ? Math.round((completed / totalMatches) * 100) : 0;

    let statusText = `${completed} из ${totalMatches} матчей`;
    if (totalMatches === 0) {
        statusText = 'Матчи не созданы';
    }

    return {
        percentage,
        completedMatches: completed,
        totalMatches,
        statusText
    };
};

/**
 * Компонент TournamentProgressBar
 * @param {Object} props
 * @param {Array} props.matches - Массив матчей турнира
 * @param {String} props.tournamentStatus - Статус турнира
 * @param {Boolean} props.compact - Компактная версия
 * @returns {JSX.Element}
 */
const TournamentProgressBar = ({ 
    matches = [], 
    tournamentStatus = 'registration',
    compact = false 
}) => {
    const progressData = useMemo(() => 
        calculateTournamentProgress(matches, tournamentStatus),
        [matches, tournamentStatus]
    );

    const { percentage, statusText } = progressData;

    return (
        <div className={`tournament-progress-bar ${compact ? 'compact' : ''}`}>
            <div className="progress-header">
                <span className="progress-title">🏆 Прогресс турнира</span>
                <span className="progress-percentage">{percentage}%</span>
            </div>

            <div className="progress-bar-container">
                <div className="progress-bar-background">
                    <div 
                        className="progress-bar-fill"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>

            <div className="progress-status">{statusText}</div>
        </div>
    );
};

export default TournamentProgressBar; 