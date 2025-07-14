/**
 * ReferralInviteModal v2.0.0 - Минималистичный дизайн с иконками соцсетей
 * 
 * @version 2.0.0
 * @updated 2025-01-25
 * @author 1337 Community Development Team
 * @purpose Генерация и отображение реферальных ссылок для приглашения друзей в турниры
 * @features Копирование ссылки, иконки соцсетей, компактная статистика
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
                    <h3>🔗 Пригласить друга</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {loading && (
                        <div className="referral-loading">
                            <div className="referral-loading-spinner"></div>
                            <p>Генерируем ссылку...</p>
                        </div>
                    )}

                    {error && (
                        <div className="referral-error">
                            <p>❌ {error}</p>
                            <button onClick={generateReferralLink} className="referral-retry-btn">
                                🔄 Повторить
                            </button>
                        </div>
                    )}

                    {referralData && !loading && (
                        <>
                            {/* Информация о турнире */}
                            <div className="referral-tournament-info">
                                <h4>📋 {tournament.name}</h4>
                                <p>🎮 Игра: {tournament.game}</p>
                                <p>🏆 Формат: {tournament.format}</p>
                            </div>

                            {/* Реферальная ссылка */}
                            <div className="referral-link-section">
                                <label>🔗 Ваша реферальная ссылка:</label>
                                <div className="referral-link-input-group">
                                    <input 
                                        type="text" 
                                        value={referralData.full_url} 
                                        readOnly 
                                        className="referral-link-input"
                                    />
                                    <button 
                                        onClick={copyToClipboard}
                                        className={`referral-copy-btn ${copySuccess ? 'success' : ''}`}
                                        title="Копировать ссылку"
                                    >
                                        {copySuccess ? '✅' : '📋'}
                                    </button>
                                </div>
                                {copySuccess && (
                                    <p className="referral-copy-success">✅ Ссылка скопирована!</p>
                                )}
                            </div>

                            {/* Информация о ссылке */}
                            <div className="referral-link-info">
                                <div className="referral-info-grid">
                                    <div className="referral-info-item">
                                        <span className="referral-info-label">📅 Истекает:</span>
                                        <span className="referral-info-value">{formatExpirationDate(referralData.expires_at)}</span>
                                    </div>
                                    <div className="referral-info-item">
                                        <span className="referral-info-label">🔢 Использований:</span>
                                        <span className="referral-info-value">{referralData.uses_count} / {referralData.max_uses}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Способы отправки - только иконки */}
                            <div className="referral-share-methods">
                                <h4>📤 Поделиться:</h4>
                                <div className="referral-share-icons">
                                    <button 
                                        onClick={() => shareViaMethod('telegram')}
                                        className="referral-share-icon telegram"
                                        data-tooltip="Telegram"
                                        title="Отправить в Telegram"
                                    >
                                        📱
                                    </button>
                                    <button 
                                        onClick={() => shareViaMethod('discord')}
                                        className="referral-share-icon discord"
                                        data-tooltip="Discord"
                                        title="Отправить в Discord"
                                    >
                                        🎮
                                    </button>
                                    <button 
                                        onClick={() => shareViaMethod('vk')}
                                        className="referral-share-icon vk"
                                        data-tooltip="VK"
                                        title="Отправить в VK"
                                    >
                                        🔵
                                    </button>
                                    <button 
                                        onClick={() => shareViaMethod('steam')}
                                        className="referral-share-icon steam"
                                        data-tooltip="Steam"
                                        title="Отправить в Steam"
                                    >
                                        🚂
                                    </button>
                                </div>
                            </div>

                            {/* Статистика приглашений - компактная */}
                            {stats && (
                                <div className="referral-stats">
                                    <h4>📊 Статистика:</h4>
                                    <div className="referral-stats-grid">
                                        <div className="referral-stat-item">
                                            <span className="referral-stat-value">{stats.summary.total_invitations}</span>
                                            <span className="referral-stat-label">Ссылок</span>
                                        </div>
                                        <div className="referral-stat-item">
                                            <span className="referral-stat-value">{stats.summary.successful_registrations}</span>
                                            <span className="referral-stat-label">Игроков</span>
                                        </div>
                                        <div className="referral-stat-item">
                                            <span className="referral-stat-value">{stats.summary.tournament_participants}</span>
                                            <span className="referral-stat-label">Участвовали</span>
                                        </div>
                                        <div className="referral-stat-item">
                                            <span className="referral-stat-value">{stats.summary.active_links}</span>
                                            <span className="referral-stat-label">Активных</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Инструкция - компактная */}
                            <div className="referral-instructions">
                                <h4>💡 Как это работает:</h4>
                                <ol>
                                    <li>📤 Отправьте ссылку друзьям</li>
                                    <li>👤 Друг регистрируется</li>
                                    <li>🎮 Получает приглашение в турнир</li>
                                    <li>🏆 Вы получаете бонусы!</li>
                                </ol>
                                <p className="note">
                                    ⏰ Ссылка действует 7 дней, максимум 10 использований
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer referral-modal-footer">
                    <button className="btn-secondary" onClick={onClose}>
                        Закрыть
                    </button>
                    {referralData && (
                        <button 
                            className="btn-primary" 
                            onClick={copyToClipboard}
                            disabled={copySuccess}
                        >
                            {copySuccess ? '✅ Скопировано' : '📋 Копировать'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReferralInviteModal; 