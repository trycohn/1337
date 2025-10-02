/**
 * 📊 PROFILE REPUTATION
 * Отображение репутации игрока в профиле
 * 
 * @version 1.0.0
 * @date 2025-10-02
 */

import React, { useState, useEffect } from 'react';
import api from '../axios';
import './ProfileReputation.css';

function ProfileReputation({ userId }) {
    const [reputation, setReputation] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        loadReputation();
    }, [userId]);
    
    const loadReputation = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/api/matches/users/${userId}/reputation`);
            
            if (response.data.success) {
                setReputation(response.data.reputation);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки репутации:', error);
        } finally {
            setLoading(false);
        }
    };
    
    if (loading) {
        return <div className="reputation-loading">Загрузка репутации...</div>;
    }
    
    if (!reputation || reputation.total_feedbacks === 0) {
        return (
            <div className="reputation-empty">
                <div className="empty-icon">📊</div>
                <h3>Пока нет оценок</h3>
                <p>Участвуйте в турнирах чтобы получить репутацию от других игроков!</p>
            </div>
        );
    }
    
    const getReputationColor = (score) => {
        if (score >= 80) return '#00aa00';
        if (score >= 60) return '#88cc00';
        if (score >= 40) return '#ffaa00';
        return '#ff0000';
    };
    
    const getReputationLabel = (score) => {
        if (score >= 80) return '✅ Отличная репутация';
        if (score >= 60) return '🟢 Хорошая репутация';
        if (score >= 40) return '🟡 Средняя репутация';
        return '🔴 Низкая репутация';
    };
    
    return (
        <div className="profile-reputation-container">
            {/* Главный показатель */}
            <div className="reputation-main">
                <div className="reputation-circle-container">
                    <svg className="reputation-circle" viewBox="0 0 120 120">
                        {/* Background circle */}
                        <circle 
                            cx="60" cy="60" r="52" 
                            fill="none" 
                            stroke="#333" 
                            strokeWidth="10" 
                        />
                        {/* Progress circle */}
                        <circle 
                            cx="60" cy="60" r="52" 
                            fill="none" 
                            stroke={getReputationColor(reputation.reputation_index)}
                            strokeWidth="10"
                            strokeDasharray={`${reputation.reputation_index * 3.27} 327`}
                            strokeLinecap="round"
                            transform="rotate(-90 60 60)"
                            className="reputation-progress"
                        />
                    </svg>
                    <div className="reputation-value">
                        {reputation.reputation_index}
                    </div>
                </div>
                <div className="reputation-label">
                    {getReputationLabel(reputation.reputation_index)}
                </div>
                <div className="reputation-count">
                    На основе {reputation.total_feedbacks} оценок
                </div>
            </div>
            
            {/* Детальная разбивка */}
            <div className="reputation-breakdown">
                <h3>Детальная статистика</h3>
                
                {/* Честность */}
                <div className="reputation-metric">
                    <div className="metric-header">
                        <span className="metric-name">Честность игры</span>
                        <strong className="metric-value">{reputation.fairness_score?.toFixed(0) || 50}/100</strong>
                    </div>
                    <div className="metric-bar">
                        <div 
                            className="metric-fill fairness"
                            style={{width: `${reputation.fairness_score || 50}%`}}
                        />
                    </div>
                    <div className="metric-details">
                        <span className="detail-item clean">😊 Чисто: {reputation.clean_reports || 0}</span>
                        <span className="detail-item normal">😐 Норм: {reputation.normal_reports || 0}</span>
                        <span className="detail-item suspicious">⚠️ Подозр.: {reputation.suspicious_reports || 0}</span>
                        <span className="detail-item cheating">☠️ Чит: {reputation.cheating_reports || 0}</span>
                    </div>
                </div>
                
                {/* Поведение */}
                <div className="reputation-metric">
                    <div className="metric-header">
                        <span className="metric-name">Поведение</span>
                        <strong className="metric-value">{reputation.behavior_score?.toFixed(0) || 50}/100</strong>
                    </div>
                    <div className="metric-bar">
                        <div 
                            className="metric-fill behavior"
                            style={{width: `${reputation.behavior_score || 50}%`}}
                        />
                    </div>
                    <div className="metric-details">
                        <span className="detail-item good">👍 Хорошо: {(reputation.excellent_behavior || 0) + (reputation.good_behavior || 0)}</span>
                        <span className="detail-item normal">😐 Норм: {reputation.normal_behavior || 0}</span>
                        <span className="detail-item toxic">👎 Токсично: {reputation.toxic_behavior || 0}</span>
                    </div>
                </div>
                
                {/* Командная игра */}
                <div className="reputation-metric">
                    <div className="metric-header">
                        <span className="metric-name">Командная игра</span>
                        <strong className="metric-value">{reputation.teamplay_score?.toFixed(0) || 50}/100</strong>
                    </div>
                    <div className="metric-bar">
                        <div 
                            className="metric-fill teamplay"
                            style={{width: `${reputation.teamplay_score || 50}%`}}
                        />
                    </div>
                    <div className="metric-details">
                        <span className="detail-item excellent">👍 Отлично: {reputation.excellent_teamplay || 0}</span>
                        <span className="detail-item normal">😐 Норм: {reputation.normal_teamplay || 0}</span>
                        <span className="detail-item poor">👎 Плохо: {reputation.poor_teamplay || 0}</span>
                    </div>
                </div>
            </div>
            
            {/* Предупреждения */}
            {reputation.cheating_reports > 0 && (
                <div className="reputation-warning">
                    <div className="warning-icon">⚠️</div>
                    <div className="warning-content">
                        <strong>Внимание!</strong>
                        <p>
                            У вас есть {reputation.cheating_reports} {
                                reputation.cheating_reports === 1 ? 'жалоба' :
                                reputation.cheating_reports < 5 ? 'жалобы' : 'жалоб'
                            } на читинг.
                            {reputation.cheating_reports >= 3 && (
                                <span> Ваш аккаунт может быть проверен модераторами.</span>
                            )}
                        </p>
                    </div>
                </div>
            )}
            
            {reputation.toxic_behavior >= 5 && (
                <div className="reputation-warning warning-toxic">
                    <div className="warning-icon">😠</div>
                    <div className="warning-content">
                        <strong>Предупреждение</strong>
                        <p>
                            У вас {reputation.toxic_behavior} жалоб на токсичное поведение.
                            Пожалуйста, будьте вежливы с другими игроками.
                        </p>
                    </div>
                </div>
            )}
            
            {/* Информация */}
            <div className="reputation-info">
                <h4>Как улучшить репутацию?</h4>
                <ul>
                    <li>🎮 Играйте честно — не используйте читы</li>
                    <li>🤝 Будьте вежливы с тиммейтами и соперниками</li>
                    <li>💬 Коммуницируйте с командой</li>
                    <li>🏆 Участвуйте в турнирах регулярно</li>
                </ul>
                <p className="info-note">
                    Репутация обновляется автоматически после каждого турнира на основе оценок других игроков.
                </p>
            </div>
        </div>
    );
}

export default ProfileReputation;

