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
    const { user } = useAuth();
    const navigate = useNavigate();
    
    // Получаем токен напрямую из localStorage
    const token = localStorage.getItem('token');
    
    const [loading, setLoading] = useState(true);
    const [inviteValid, setInviteValid] = useState(false);
    const [inviteData, setInviteData] = useState(null);
    const [error, setError] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [inviteUsed, setInviteUsed] = useState(false); // Флаг, что инвайт уже использован

    // Проверка валидности инвайта при загрузке
    useEffect(() => {
        checkInviteValidity();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inviteCode]);

    // Сохранение инвайт-кода для возврата после авторизации (только для НЕавторизованных)
    useEffect(() => {
        const currentToken = localStorage.getItem('token');
        
        // Редиректим ТОЛЬКО если НЕТ токена (действительно не авторизован)
        if (!currentToken && !user && inviteValid && inviteData) {
            console.log('⚠️ Пользователь не авторизован, редирект на /auth');
            sessionStorage.setItem('invite_return_url', `/tournaments/invite/${inviteCode}`);
            sessionStorage.setItem('invite_tournament_name', inviteData.name || '');
            
            // Редиректим на страницу авторизации
            navigate(`/auth?redirect=${encodeURIComponent(`/tournaments/invite/${inviteCode}`)}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, inviteValid, inviteData]);

    // Автоматическое использование инвайта для авторизованных пользователей
    useEffect(() => {
        const currentToken = localStorage.getItem('token');
        
        console.log('🔍 Проверка условий для использования инвайта:', {
            user: !!user,
            token: !!currentToken,
            inviteValid,
            processing,
            inviteUsed
        });
        
        // Для авторизованных сразу используем инвайт и редиректим
        if (user && currentToken && inviteValid && !processing && !inviteUsed) {
            console.log('✅ Пользователь авторизован, используем инвайт и редиректим...');
            handleUseInvite();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, token, inviteValid]);

    const checkInviteValidity = async () => {
        try {
            console.log('🔍 Проверка валидности инвайта:', inviteCode);
            setLoading(true);
            
            const response = await axios.get(
                `${process.env.REACT_APP_API_URL}/api/tournaments/invites/${inviteCode}`
            );

            console.log('📥 Ответ от сервера:', response.data);

            if (response.data.valid) {
                setInviteValid(true);
                setInviteData(response.data.tournament);
                console.log('✅ Инвайт валиден, турнир:', response.data.tournament.name);
            } else {
                setInviteValid(false);
                setError(response.data.error || 'Приглашение недействительно');
                console.log('❌ Инвайт невалиден:', response.data.error);
            }
        } catch (err) {
            console.error('❌ Ошибка проверки приглашения:', err);
            setInviteValid(false);
            setError(err.response?.data?.error || 'Не удалось проверить приглашение');
        } finally {
            setLoading(false);
        }
    };

    const handleUseInvite = async () => {
        // Предотвращаем повторный вызов
        if (inviteUsed || processing) {
            console.log('⚠️ Инвайт уже обрабатывается или использован');
            return;
        }

        try {
            setProcessing(true);
            setInviteUsed(true); // Устанавливаем флаг сразу
            
            console.log('📤 Отправка запроса на использование инвайта...');
            
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/tournaments/invites/${inviteCode}/use`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            console.log('✅ Инвайт успешно использован:', response.data);

            if (response.data.success) {
                const tournamentId = response.data.tournament.id;
                
                // Очищаем флаг pending инвайта
                sessionStorage.removeItem('pending_invite');
                
                // Используем window.location для жесткого редиректа (избегаем проблем с AuthPage)
                console.log('🔀 Редирект на турнир:', tournamentId);
                window.location.href = `/tournaments/${tournamentId}?join=true`;
            }
        } catch (err) {
            console.error('❌ Ошибка использования приглашения:', err);
            setError(err.response?.data?.error || 'Не удалось использовать приглашение');
            setInviteUsed(false); // Сбрасываем флаг при ошибке
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

    // Если пользователь не авторизован (и нет токена) - показываем loader
    const currentToken = localStorage.getItem('token');
    if (!currentToken && !user && inviteValid) {
        return (
            <div className="tournament-invite-container">
                <div className="invite-card">
                    <div className="invite-loading">
                        <div className="spinner"></div>
                        <p>Перенаправление на авторизацию...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Если пользователь авторизован - показываем loader (используем инвайт и редиректим)
    if (user && inviteValid) {
        return (
            <div className="tournament-invite-container">
                <div className="invite-card">
                    <div className="invite-loading">
                        <div className="spinner"></div>
                        <p>Подтверждение приглашения...</p>
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

