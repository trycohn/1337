/**
 * ReferralLanding v1.0.0 - Страница обработки реферальных ссылок
 * 
 * @version 1.0.0
 * @updated 2025-01-25
 * @author 1337 Community Development Team
 * @purpose Обработка реферальных ссылок и перенаправление на регистрацию
 * @features Извлечение кода из URL, отображение информации о турнире, переход к регистрации
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import './ReferralLanding.css';

const ReferralLanding = () => {
    const { referralCode } = useParams();
    const navigate = useNavigate();
    const [referralInfo, setReferralInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [acceptLoading, setAcceptLoading] = useState(false);

    useEffect(() => {
        if (referralCode) {
            loadReferralInfo();
        } else {
            setError('Реферальный код не указан');
            setLoading(false);
        }
    }, [referralCode]);

    // Загрузка информации о реферальной ссылке
    const loadReferralInfo = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await api.get(`/api/referrals/info/${referralCode}`);
            
            if (response.data.success) {
                setReferralInfo(response.data.data);
                console.log('✅ Информация о реферальной ссылке загружена:', response.data.data);
            } else {
                setError(response.data.message || 'Ссылка недействительна или истекла');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки информации о реферальной ссылке:', error);
            if (error.response?.status === 404) {
                setError('Реферальная ссылка не найдена или истекла');
            } else {
                setError('Ошибка загрузки информации о приглашении');
            }
        } finally {
            setLoading(false);
        }
    };

    // Проверка авторизации (минимальная)
    useEffect(() => {
        const token = localStorage.getItem('token');
        setIsAuthenticated(Boolean(token));
    }, []);

    // Переход к регистрации с реферальным кодом
    const handleRegister = () => {
        navigate(`/register?referral=${referralCode}`);
    };

    // Переход к входу
    const handleLogin = () => {
        navigate(`/login?referral=${referralCode}`);
    };

    // Принять приглашение (для авторизованных)
    const handleAcceptInvite = async () => {
        if (!referralInfo?.tournament?.id) {
            setError('Невозможно принять приглашение: турнир не указан');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            navigate(`/login?referral=${referralCode}`);
            return;
        }

        try {
            setAcceptLoading(true);
            const tournamentId = referralInfo.tournament.id;
            await api.post(`/api/tournaments/${tournamentId}/participate`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Успешно — переходим на страницу турнира
            navigate(`/tournaments/${tournamentId}?from=invite`);
        } catch (err) {
            console.error('❌ Ошибка принятия приглашения:', err);
            const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Ошибка принятия приглашения';
            setError(msg);
        } finally {
            setAcceptLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="referral-landing">
                <div className="referral-container">
                    <div className="loading-section">
                        <div className="loading-spinner"></div>
                        <h2>Загружаем информацию о приглашении...</h2>
                        <p>Пожалуйста, подождите</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="referral-landing">
                <div className="referral-container">
                    <div className="error-section">
                        <div className="error-icon">❌</div>
                        <h2>Приглашение недоступно</h2>
                        <p className="error-message">{error}</p>
                        {!isAuthenticated && (
                            <div className="error-actions">
                                <Link to="/register" className="btn-primary">
                                    Регистрация
                                </Link>
                                <Link to="/login" className="btn-secondary">
                                    Вход
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="referral-landing">
            <div className="referral-container">
                {/* Заголовок приглашения */}
                <div className="referral-header">
                    <div className="invite-icon">🎮</div>
                    <h1>Приглашение в 1337 Community</h1>
                    <p className="invite-subtitle">
                        Вас пригласил <strong>{referralInfo.referrer_username}</strong>
                    </p>
                </div>

                {/* Информация о турнире */}
                {referralInfo.tournament && (
                    <div className="tournament-preview">
                        <h2>🏆 Турнир: {referralInfo.tournament.name}</h2>
                        <div className="tournament-details">
                            <div className="detail-row">
                                <span className="detail-label">🎮 Игра:</span>
                                <span className="detail-value">{referralInfo.tournament.game}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">🏆 Формат:</span>
                                <span className="detail-value">{referralInfo.tournament.format}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">👥 Участников:</span>
                                <span className="detail-value">
                                    {referralInfo.tournament.participants_count}
                                    {referralInfo.tournament.max_participants && ` / ${referralInfo.tournament.max_participants}`}
                                </span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">📅 Статус:</span>
                                <span className={`detail-value status-${referralInfo.tournament.status}`}>
                                    {referralInfo.tournament.status === 'active' ? 'Активный' : 
                                     referralInfo.tournament.status === 'upcoming' ? 'Предстоящий' : 
                                     referralInfo.tournament.status}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Убрано: блок преимуществ, чтобы не перегружать лендинг */}

                {/* Убрано: блок сроков и использований ссылки для приглашённого пользователя */}

                {/* Кнопки действий */}
                <div className="action-buttons">
                    {!isAuthenticated && (
                        <>
                            <button 
                                className="btn-primary register-btn"
                                onClick={handleRegister}
                            >
                                🎯 Зарегистрироваться и участвовать
                            </button>
                            <button 
                                className="btn-secondary login-btn"
                                onClick={handleLogin}
                            >
                                🔑 У меня уже есть аккаунт
                            </button>
                        </>
                    )}
                    {isAuthenticated && referralInfo?.tournament?.id && (
                        <button
                            className="btn-primary accept-btn"
                            onClick={handleAcceptInvite}
                            disabled={acceptLoading}
                        >
                            {acceptLoading ? '⏳ Принимаем...' : '✅ Принять приглашение на участие в турнире'}
                        </button>
                    )}
                </div>

                {/* Дополнительные ссылки */}
                <div className="additional-links">
                    <Link to="/tournaments" className="link">
                        📋 Посмотреть все турниры
                    </Link>
                    <Link to="/about" className="link">
                        ❓ Узнать больше о платформе
                    </Link>
                </div>

                {/* Информация о бонусах */}
                {referralInfo.tournament && (
                    <div className="bonus-info">
                        <h4>🎁 Бонусы за регистрацию по приглашению:</h4>
                        <ul>
                            <li>🎮 Автоматическое участие в турнире "{referralInfo.tournament.name}"</li>
                            <li>🏆 Дополнительные очки рейтинга за первую игру</li>
                            <li>🎯 Специальные достижения для приглашенных игроков</li>
                            <li>⭐ Поддержка от {referralInfo.referrer_username} в освоении платформы</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReferralLanding; 