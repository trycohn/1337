import React from 'react';
import './ProfileShowcase.css';

/**
 * ProfileShowcase - Витрина достижений профиля
 * Отображает ключевые достижения и статистику пользователя
 */
function ProfileShowcase({ stats, achievements }) {
    // Вычисляем основные достижения
    const showcaseItems = [];

    if (stats) {
        // Победы в турнирах
        const tournamentsWon = stats.tournaments?.filter(t => t.result === 'Победитель').length || 0;
        if (tournamentsWon > 0) {
            showcaseItems.push({
                icon: '🏆',
                label: 'Победитель',
                value: `${tournamentsWon}x`,
                tier: 'gold'
            });
        }

        // Топ-3 в турнирах
        const topThreeFinishes = stats.tournaments?.filter(t => 
            t.placement && t.placement <= 3
        ).length || 0;
        if (topThreeFinishes > 0 && tournamentsWon < topThreeFinishes) {
            showcaseItems.push({
                icon: '🥈',
                label: 'Топ-3',
                value: `${topThreeFinishes}x`,
                tier: 'silver'
            });
        }

        // Всего турниров
        const totalTournaments = stats.tournaments?.length || 0;
        if (totalTournaments >= 10) {
            showcaseItems.push({
                icon: '🎮',
                label: 'Турниров',
                value: `${totalTournaments}+`,
                tier: 'bronze'
            });
        }

        // Винрейт (если > 60%)
        const totalWins = (stats.solo?.wins || 0) + (stats.team?.wins || 0);
        const totalMatches = totalWins + (stats.solo?.losses || 0) + (stats.team?.losses || 0);
        const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
        
        if (winRate >= 60 && totalMatches >= 20) {
            showcaseItems.push({
                icon: '💯',
                label: 'Винрейт',
                value: `${winRate}%`,
                tier: 'gold'
            });
        }
    }

    // Добавляем достижения из системы ачивок (если есть)
    if (achievements && achievements.length > 0) {
        const recentAchievements = achievements
            .filter(a => a.unlocked)
            .slice(0, 2);
        
        recentAchievements.forEach(ach => {
            showcaseItems.push({
                icon: ach.icon || '⭐',
                label: ach.name,
                value: '',
                tier: ach.rarity || 'bronze'
            });
        });
    }

    // Ограничиваем до 4 элементов
    const displayItems = showcaseItems.slice(0, 4);

    if (displayItems.length === 0) {
        return null;
    }

    return (
        <div className="profile-showcase">
            <div className="showcase-title">Витрина достижений</div>
            <div className="showcase-items">
                {displayItems.map((item, index) => (
                    <div 
                        key={index} 
                        className={`showcase-item ${item.tier}`}
                    >
                        <div className="showcase-icon">{item.icon}</div>
                        <div className="showcase-content">
                            {item.value && (
                                <div className="showcase-value">{item.value}</div>
                            )}
                            <div className="showcase-label">{item.label}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ProfileShowcase;

