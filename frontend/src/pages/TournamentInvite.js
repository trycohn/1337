import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthPage from './AuthPage';
import axios from 'axios';
import './TournamentInvite.css';

/**
 * Страница обработки инвайт-ссылок для закрытых турниров
 * 
 * Workflow:
 * 1. Проверка валидности инвайт-кода
 * 2. Если пользователь не авторизован - показываем форму авторизации/регистрации
 * 3. После авторизации используем инвайт и редиректим на страницу турнира
 */
function TournamentInvite() {
    const { inviteCode } = useParams();
    const { user, token } = useAuth();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [inviteValid, setInviteValid] = useState(false);
    const [inviteData, setInviteData] = useState(null);
    const [error, setError] = useState(null);
    const [processing, setProcessing] = useState(false);

    // Проверка валидности инвайта при загрузке
    useEffect(() => {
        checkInviteValidity();
    }, [inviteCode]);

    // Автоматическое использование инвайта после авторизации
    useEffect(() => {
        if (user && token && inviteValid && !processing) {
            useInvite();
        }
    }, [user, token, inviteValid]);

    const checkInviteValidity = async () => {
        try {
            setLoading(true);
            const response = await axios.get(
                `${process.env.REACT_APP_API_URL}/api/tournaments/invites/${inviteCode}`
            );

            if (response.data.valid) {
                setInviteValid(true);
                setInviteData(response.data.tournament);
            } else {
                setInviteValid(false);
                setError(response.data.error || 'Приглашение недействительно');
            }
        } catch (err) {
            console.error('Ошибка проверки приглашения:', err);
            setInviteValid(false);
            setError(err.response?.data?.error || 'Не удалось проверить приглашение');
        } finally {
            setLoading(false);
        }
    };

    const useInvite = async () => {
        try {
            setProcessing(true);
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/tournaments/invites/${inviteCode}/use`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (response.data.success) {
                // Сохраняем информацию о том, что пользователь использовал инвайт
                sessionStorage.setItem('invite_used', 'true');
                sessionStorage.setItem('tournament_id', response.data.tournament.id);
                
                // Редиректим на страницу турнира с информацией о том, что нужно вступить
                navigate(`/tournaments/${response.data.tournament.id}?join=true`);
            }
        } catch (err) {
            console.error('Ошибка использования приглашения:', err);
            setError(err.response?.data?.error || 'Не удалось использовать приглашение');
        } finally {
            setProcessing(false);
        }
    };

    // Если загрузка
    if (loading) {
        return (
            <div className="tournament-invite-container">
                <div className="invite-card">
                    <div className="invite-loading">
                        <div className="spinner"></div>
                        <p>Проверка приглашения...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Если инвайт невалидный
    if (!inviteValid) {
        return (
            <div className="tournament-invite-container">
                <div className="invite-card error">
                    <div className="invite-icon error-icon">❌</div>
                    <h2>Приглашение недействительно</h2>
                    <p className="error-message">{error}</p>
                    <button 
                        className="btn-primary"
                        onClick={() => navigate('/tournaments')}
                    >
                        Перейти к турнирам
                    </button>
                </div>
            </div>
        );
    }

    // Если пользователь не авторизован - показываем форму авторизации
    if (!user) {
        return (
            <div className="tournament-invite-container">
                <div className="invite-info-banner">
                    <div className="banner-content">
                        <h2>🏆 Приглашение в турнир</h2>
                        <p>Вы приглашены в турнир <strong>{inviteData?.name}</strong></p>
                        <p className="hint">Войдите или зарегистрируйтесь, чтобы принять приглашение</p>
                    </div>
                </div>
                <AuthPage redirectAfterAuth={`/tournaments/invite/${inviteCode}`} />
            </div>
        );
    }

    // Если пользователь авторизован и идет обработка инвайта
    if (processing) {
        return (
            <div className="tournament-invite-container">
                <div className="invite-card">
                    <div className="invite-loading">
                        <div className="spinner"></div>
                        <p>Подтверждение участия...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Если произошла ошибка при использовании инвайта
    if (error && !processing) {
        return (
            <div className="tournament-invite-container">
                <div className="invite-card error">
                    <div className="invite-icon error-icon">⚠️</div>
                    <h2>Ошибка</h2>
                    <p className="error-message">{error}</p>
                    <button 
                        className="btn-primary"
                        onClick={() => navigate(`/tournaments/${inviteData?.id || ''}`)}
                    >
                        Перейти к турниру
                    </button>
                </div>
            </div>
        );
    }

    // Fallback (обычно не должен показываться)
    return (
        <div className="tournament-invite-container">
            <div className="invite-card">
                <div className="invite-loading">
                    <div className="spinner"></div>
                    <p>Обработка приглашения...</p>
                </div>
            </div>
        </div>
    );
}

export default TournamentInvite;

