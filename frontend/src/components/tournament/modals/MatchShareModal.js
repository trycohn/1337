import React, { useState, useEffect } from 'react';
import { useMatchDetailsModal } from '../../../hooks/useModalSystem';
import { ensureHttps } from '../../../utils/userHelpers';
import '../../../styles/modal-system.css';
import './MatchShareModal.css';

/**
 * 🔗 MatchShareModal - Модальное окно для шейринга результатов матча
 * Создано для интеграции с социальными сетями (VK, Telegram, Discord)
 * 
 * @version 1.0
 * @features Генерация ссылок, превью для соцсетей, копирование в буфер
 */
const MatchShareModal = ({
    isOpen,
    onClose,
    selectedMatch,
    tournament = null
}) => {
    const [copiedUrl, setCopiedUrl] = useState('');
    const [shareStats, setShareStats] = useState({
        copies: 0,
        shares: 0
    });

    // Используем унифицированный хук модальной системы
    const modalSystem = useMatchDetailsModal({
        onClose: () => {
            setCopiedUrl('');
            onClose();
        }
    });

    // Генерируем данные для шейринга
    const shareData = React.useMemo(() => {
        if (!selectedMatch || !tournament) return null;

        const baseUrl = window.location.origin;
        const shareUrl = `${baseUrl}/tournaments/${tournament.id}/match/${selectedMatch.id}`;
        
        // Определяем команды
        const team1 = selectedMatch.team1_name || 'Команда 1';
        const team2 = selectedMatch.team2_name || 'Команда 2';
        const winner = selectedMatch.winner_team_id === selectedMatch.team1_id ? team1 : team2;
        
        // Формируем счет
        let score = `${selectedMatch.score1 || 0}:${selectedMatch.score2 || 0}`;
        if (selectedMatch.maps_data && Array.isArray(selectedMatch.maps_data) && selectedMatch.maps_data.length === 1) {
            const mapData = selectedMatch.maps_data[0];
            if (mapData.team1_score !== undefined && mapData.team2_score !== undefined) {
                score = selectedMatch.winner_team_id === selectedMatch.team1_id 
                    ? `${mapData.team1_score}:${mapData.team2_score}`
                    : `${mapData.team2_score}:${mapData.team1_score}`;
            }
        }

        const title = `🏆 ${winner} победила ${score}`;
        const description = `Результат матча в турнире "${tournament.name}" на 1337 Community`;
        const hashtags = ['1337Community', 'Esports', 'Tournament'];

        return {
            url: shareUrl,
            title,
            description,
            team1,
            team2,
            winner,
            score,
            hashtags,
            tournamentName: tournament.name,
            matchNumber: selectedMatch.match_number || selectedMatch.id
        };
    }, [selectedMatch, tournament]);

    // Функции для шейринга в разные соцсети
    const shareToTelegram = () => {
        if (!shareData) return;
        
        const text = `🎮 ${shareData.title}\n\n🏆 Турнир: ${shareData.tournamentName}\n📊 Матч #${shareData.matchNumber}\n\n${shareData.description}`;
        const url = `https://t.me/share/url?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        
        setShareStats(prev => ({ ...prev, shares: prev.shares + 1 }));
    };

    const shareToVK = () => {
        if (!shareData) return;
        
        const url = `https://vk.com/share.php?url=${encodeURIComponent(shareData.url)}&title=${encodeURIComponent(shareData.title)}&description=${encodeURIComponent(shareData.description)}`;
        window.open(url, '_blank');
        
        setShareStats(prev => ({ ...prev, shares: prev.shares + 1 }));
    };

    const shareToDiscord = () => {
        if (!shareData) return;
        
        // Для Discord копируем текст в буфер с инструкцией
        const discordText = `🎮 ${shareData.title}\n\n🏆 **${shareData.tournamentName}**\n📊 Матч #${shareData.matchNumber}\n\n${shareData.url}`;
        
        navigator.clipboard.writeText(discordText).then(() => {
            setCopiedUrl('discord');
            setTimeout(() => setCopiedUrl(''), 2000);
        });
        
        setShareStats(prev => ({ ...prev, copies: prev.copies + 1 }));
    };

    const copyToClipboard = () => {
        if (!shareData) return;
        
        navigator.clipboard.writeText(shareData.url).then(() => {
            setCopiedUrl('direct');
            setTimeout(() => setCopiedUrl(''), 2000);
        });
        
        setShareStats(prev => ({ ...prev, copies: prev.copies + 1 }));
    };

    if (!isOpen || !selectedMatch || !shareData) return null;

    return (
        <div className="modal-system-overlay" onClick={modalSystem.handleOverlayClick}>
            <div className={modalSystem.getModalClasses('medium')} onClick={(e) => e.stopPropagation()}>
                
                {/* Заголовок */}
                <div className="modal-system-header">
                    <div>
                        <h2 className="modal-system-title">
                            🔗 Поделиться результатом матча
                        </h2>
                        <p className="modal-system-subtitle">
                            Поделитесь результатом с друзьями в социальных сетях
                        </p>
                    </div>
                    <button 
                        className="modal-system-close" 
                        onClick={onClose}
                        aria-label="Закрыть модальное окно"
                    >
                        ✕
                    </button>
                </div>

                {/* Тело модального окна */}
                <div className="modal-system-body">
                    
                    {/* Превью результата */}
                    <div className="match-share-preview">
                        <div className="match-share-result">
                            <div className="match-share-teams">
                                <div className="match-share-team">
                                    <span className="team-name">{shareData.team1}</span>
                                </div>
                                <div className="match-share-score">
                                    <span className="score">{shareData.score}</span>
                                    {shareData.winner && (
                                        <span className="winner-indicator">
                                            👑 {shareData.winner}
                                        </span>
                                    )}
                                </div>
                                <div className="match-share-team">
                                    <span className="team-name">{shareData.team2}</span>
                                </div>
                            </div>
                            <div className="match-share-meta">
                                <span className="tournament-name">{shareData.tournamentName}</span>
                                <span className="match-number">Матч #{shareData.matchNumber}</span>
                            </div>
                        </div>
                    </div>

                    {/* Кнопки шейринга */}
                    <div className="match-share-buttons">
                        <h3 className="share-section-title">📤 Поделиться в социальных сетях</h3>
                        
                        <div className="social-share-grid">
                            <button 
                                className="social-share-btn telegram"
                                onClick={shareToTelegram}
                                title="Поделиться в Telegram"
                            >
                                <div className="social-icon">📱</div>
                                <span>Telegram</span>
                            </button>
                            
                            <button 
                                className="social-share-btn vk"
                                onClick={shareToVK}
                                title="Поделиться ВКонтакте"
                            >
                                <div className="social-icon">🌐</div>
                                <span>ВКонтакте</span>
                            </button>
                            
                            <button 
                                className="social-share-btn discord"
                                onClick={shareToDiscord}
                                title="Скопировать для Discord"
                            >
                                <div className="social-icon">💬</div>
                                <span>Discord</span>
                                {copiedUrl === 'discord' && <span className="copied-indicator">Скопировано!</span>}
                            </button>
                        </div>
                    </div>

                    {/* Прямая ссылка */}
                    <div className="direct-link-section">
                        <h3 className="share-section-title">🔗 Прямая ссылка</h3>
                        
                        <div className="direct-link-container">
                            <input 
                                type="text" 
                                value={shareData.url} 
                                readOnly 
                                className="direct-link-input"
                                onClick={(e) => e.target.select()}
                            />
                            <button 
                                className="copy-link-btn"
                                onClick={copyToClipboard}
                                title="Скопировать ссылку"
                            >
                                {copiedUrl === 'direct' ? '✓' : '📋'}
                            </button>
                        </div>
                        
                        {copiedUrl === 'direct' && (
                            <p className="copy-success">✅ Ссылка скопирована в буфер обмена!</p>
                        )}
                    </div>

                    {/* Статистика (опционально) */}
                    {(shareStats.copies > 0 || shareStats.shares > 0) && (
                        <div className="share-stats">
                            <small className="stats-text">
                                📊 Копирований: {shareStats.copies} | Репостов: {shareStats.shares}
                            </small>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MatchShareModal;