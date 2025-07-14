/**
 * ReferralInviteModal v1.0.0 - Модальное окно для приглашения друзей по реферальной ссылке
 * 
 * @version 1.0.0
 * @updated 2025-01-25
 * @author 1337 Community Development Team
 * @purpose Генерация и отображение реферальных ссылок для приглашения друзей в турниры
 * @features Копирование ссылки, QR код, статистика приглашений
 */

import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import './ReferralInviteModal.css';

const ReferralInviteModal = ({ 
    isOpen, 
    onClose, 
    tournament,
    user 
}) => {
    const [referralData, setReferralData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [stats, setStats] = useState(null);
    const [error, setError] = useState('');

    // Генерация реферальной ссылки при открытии модального окна
    useEffect(() => {
        if (isOpen && tournament?.id && user?.id) {
            generateReferralLink();
            loadUserStats();
        }
    }, [isOpen, tournament?.id, user?.id]);

    // Генерация реферальной ссылки
    const generateReferralLink = async () => {
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/api/referrals/generate-link', {
                tournament_id: tournament.id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setReferralData(response.data.data);
                console.log('✅ Реферальная ссылка сгенерирована:', response.data.data);
            } else {
                setError(response.data.message || 'Ошибка генерации ссылки');
            }
        } catch (error) {
            console.error('❌ Ошибка генерации реферальной ссылки:', error);
            setError(error.response?.data?.message || 'Ошибка генерации ссылки');
        } finally {
            setLoading(false);
        }
    };

    // Загрузка статистики пользователя
    const loadUserStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/api/referrals/stats', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
        }
    };

    // Копирование ссылки в буфер обмена
    const copyToClipboard = async () => {
        if (!referralData?.full_url) return;

        try {
            await navigator.clipboard.writeText(referralData.full_url);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (error) {
            console.error('❌ Ошибка копирования:', error);
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = referralData.full_url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }
    };

    // Отправка ссылки через различные способы
    const shareViaMethod = (method) => {
        if (!referralData?.full_url) return;

        const shareText = `🎮 Присоединяйся к турниру "${tournament.name}" на 1337 Community!\n\n${referralData.full_url}`;
        
        switch (method) {
            case 'telegram':
                window.open(`https://t.me/share/url?url=${encodeURIComponent(referralData.full_url)}&text=${encodeURIComponent(`🎮 Присоединяйся к турниру "${tournament.name}" на 1337 Community!`)}`);
                break;
            case 'discord':
                copyToClipboard();
                alert('🎯 Ссылка скопирована! Отправьте её в Discord');
                break;
            case 'vk':
                window.open(`https://vk.com/share.php?url=${encodeURIComponent(referralData.full_url)}&title=${encodeURIComponent(`Турнир "${tournament.name}"`)}&description=${encodeURIComponent('Присоединяйся к турниру на 1337 Community!')}`);
                break;
            case 'steam':
                copyToClipboard();
                alert('🎯 Ссылка скопирована! Отправьте её в Steam');
                break;
            default:
                copyToClipboard();
        }
    };

    // Форматирование даты истечения
    const formatExpirationDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffHours = Math.ceil((date - now) / (1000 * 60 * 60));
        
        if (diffHours <= 0) return 'Истекла';
        if (diffHours < 24) return `Истекает через ${diffHours} ч.`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `Истекает через ${diffDays} дн.`;
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay referral-modal-overlay" onClick={onClose}>
            <div className="modal-content referral-modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>🔗 Пригласить друга в турнир</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {loading && (
                        <div className="referral-loading">
                            <div className="loading-spinner"></div>
                            <p>Генерируем реферальную ссылку...</p>
                        </div>
                    )}

                    {error && (
                        <div className="referral-error">
                            <p>❌ {error}</p>
                            <button onClick={generateReferralLink} className="retry-btn">
                                🔄 Попробовать снова
                            </button>
                        </div>
                    )}

                    {referralData && !loading && (
                        <>
                            {/* Информация о турнире */}
                            <div className="tournament-info">
                                <h4>📋 Турнир: {tournament.name}</h4>
                                <p>🎮 Игра: {tournament.game}</p>
                                <p>🏆 Формат: {tournament.format}</p>
                            </div>

                            {/* Реферальная ссылка */}
                            <div className="referral-link-section">
                                <label>🔗 Ваша реферальная ссылка:</label>
                                <div className="link-input-group">
                                    <input 
                                        type="text" 
                                        value={referralData.full_url} 
                                        readOnly 
                                        className="referral-link-input"
                                    />
                                    <button 
                                        onClick={copyToClipboard}
                                        className={`copy-btn ${copySuccess ? 'success' : ''}`}
                                        title="Копировать ссылку"
                                    >
                                        {copySuccess ? '✅' : '📋'}
                                    </button>
                                </div>
                                {copySuccess && (
                                    <p className="copy-success">✅ Ссылка скопирована в буфер обмена!</p>
                                )}
                            </div>

                            {/* Информация о ссылке */}
                            <div className="link-info">
                                <div className="info-grid">
                                    <div className="info-item">
                                        <span className="info-label">📅 Истекает:</span>
                                        <span className="info-value">{formatExpirationDate(referralData.expires_at)}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">🔢 Использований:</span>
                                        <span className="info-value">{referralData.uses_count} / {referralData.max_uses}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Способы отправки */}
                            <div className="share-methods">
                                <h4>📤 Поделиться ссылкой:</h4>
                                <div className="share-buttons">
                                    <button 
                                        onClick={() => shareViaMethod('telegram')}
                                        className="share-btn telegram"
                                        title="Отправить в Telegram"
                                    >
                                        📱 Telegram
                                    </button>
                                    <button 
                                        onClick={() => shareViaMethod('discord')}
                                        className="share-btn discord"
                                        title="Отправить в Discord"
                                    >
                                        🎮 Discord
                                    </button>
                                    <button 
                                        onClick={() => shareViaMethod('vk')}
                                        className="share-btn vk"
                                        title="Отправить в VK"
                                    >
                                        🔵 VK
                                    </button>
                                    <button 
                                        onClick={() => shareViaMethod('steam')}
                                        className="share-btn steam"
                                        title="Отправить в Steam"
                                    >
                                        🚂 Steam
                                    </button>
                                </div>
                            </div>

                            {/* Статистика приглашений */}
                            {stats && (
                                <div className="referral-stats">
                                    <h4>📊 Ваша статистика приглашений:</h4>
                                    <div className="stats-grid">
                                        <div className="stat-item">
                                            <span className="stat-value">{stats.summary.total_invitations}</span>
                                            <span className="stat-label">Создано ссылок</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-value">{stats.summary.successful_registrations}</span>
                                            <span className="stat-label">Новых игроков</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-value">{stats.summary.tournament_participants}</span>
                                            <span className="stat-label">Участвовали в турнирах</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-value">{stats.summary.active_links}</span>
                                            <span className="stat-label">Активных ссылок</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Инструкция */}
                            <div className="referral-instructions">
                                <h4>💡 Как это работает:</h4>
                                <ol>
                                    <li>📤 Отправьте ссылку друзьям любым удобным способом</li>
                                    <li>👤 Друг переходит по ссылке и регистрируется на сайте</li>
                                    <li>🎮 Друг автоматически получает приглашение в турнир</li>
                                    <li>🏆 Вы получаете бонусы за каждого приглашенного игрока!</li>
                                </ol>
                                <p className="note">
                                    ⏰ Ссылка действует 7 дней и может быть использована максимум 10 раз
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>
                        Закрыть
                    </button>
                    {referralData && (
                        <button 
                            className="btn-primary" 
                            onClick={copyToClipboard}
                            disabled={copySuccess}
                        >
                            {copySuccess ? '✅ Скопировано' : '📋 Копировать ссылку'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReferralInviteModal; 