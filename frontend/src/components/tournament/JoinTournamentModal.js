import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import './JoinTournamentModal.css';

/**
 * Модальное окно для вступления в турнир
 * 
 * Поддерживает различные режимы:
 * - Создание новой команды
 * - Выбор своей существующей команды
 * - Вступление в команду, уже добавленную в турнир
 */
function JoinTournamentModal({ tournament, onClose, onSuccess }) {
    // Получаем токен напрямую из localStorage
    const token = localStorage.getItem('token');
    
    const [mode, setMode] = useState('select'); // select, create_team, join_team, solo
    const [teamName, setTeamName] = useState('');
    const [myTeams, setMyTeams] = useState([]);
    const [tournamentTeams, setTournamentTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [joinMessage, setJoinMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const isSolo = tournament.participant_type === 'solo';
    const isTeamTournament = ['2x2', '3x3', '5x5', 'team'].includes(tournament.participant_type);

    useEffect(() => {
        console.log('🎯 [JoinTournamentModal] Турнир:', {
            participant_type: tournament.participant_type,
            isSolo,
            isTeamTournament
        });
        
        if (isTeamTournament) {
            loadMyTeams();
            loadTournamentTeams();
        }
    }, []);

    // Загрузка команд пользователя
    const loadMyTeams = async () => {
        try {
            const response = await axios.get(
                `${process.env.REACT_APP_API_URL}/api/teams/for-tournament/${tournament.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Объединяем постоянные и временные команды
            const allTeams = [
                ...(response.data.permanent || []),
                ...(response.data.temporary || [])
            ];
            
            setMyTeams(allTeams);
        } catch (err) {
            console.error('Ошибка загрузки команд:', err);
            setMyTeams([]);
        }
    };

    // Загрузка команд турнира
    const loadTournamentTeams = async () => {
        try {
            const response = await axios.get(
                `${process.env.REACT_APP_API_URL}/api/tournaments/${tournament.id}/teams`
            );
            setTournamentTeams(response.data || []);
        } catch (err) {
            console.error('Ошибка загрузки команд турнира:', err);
        }
    };

    // Подтверждение использования инвайта (если был)
    const confirmInviteIfNeeded = async () => {
        try {
            const inviteCode = sessionStorage.getItem('pending_invite_code');
            if (inviteCode) {
                console.log('✅ Подтверждаем использование инвайта:', inviteCode);
                await axios.post(
                    `${process.env.REACT_APP_API_URL}/api/tournaments/invites/${inviteCode}/confirm`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                sessionStorage.removeItem('pending_invite_code');
                console.log('✅ Использование инвайта подтверждено');
            }
        } catch (err) {
            console.error('⚠️ Ошибка подтверждения инвайта:', err);
            // Не критично, продолжаем
        }
    };

    // Обработка вступления в турнир
    const handleJoin = async () => {
        try {
            setLoading(true);
            setError(null);

            if (isSolo) {
                // Для соло турниров - просто вступаем
                await axios.post(
                    `${process.env.REACT_APP_API_URL}/api/tournaments/${tournament.id}/participate`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                
                // Подтверждаем использование инвайта (если был)
                await confirmInviteIfNeeded();
                
                onSuccess();
            } else if (mode === 'my_team') {
                // Используем свою команду
                if (!selectedTeam) {
                    setError('Выберите команду');
                    return;
                }

                await axios.post(
                    `${process.env.REACT_APP_API_URL}/api/tournaments/${tournament.id}/participate`,
                    { teamId: selectedTeam.id },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                
                // Подтверждаем использование инвайта (если был)
                await confirmInviteIfNeeded();
                
                onSuccess();
            } else if (mode === 'create_team') {
                // Создаем новую команду
                if (!teamName.trim()) {
                    setError('Введите название команды');
                    return;
                }

                await axios.post(
                    `${process.env.REACT_APP_API_URL}/api/tournaments/${tournament.id}/participate`,
                    { newTeamName: teamName },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                
                // Подтверждаем использование инвайта (если был)
                await confirmInviteIfNeeded();
                
                onSuccess();
            } else if (mode === 'join_team') {
                // Отправляем запрос на вступление в команду
                if (!selectedTeam) {
                    setError('Выберите команду');
                    return;
                }

                await axios.post(
                    `${process.env.REACT_APP_API_URL}/api/tournaments/${tournament.id}/teams/${selectedTeam.id}/join-requests`,
                    { message: joinMessage },
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                alert('Запрос на вступление отправлен капитану команды!');
                onClose();
            }
        } catch (err) {
            console.error('Ошибка вступления в турнир:', err);
            setError(err.response?.data?.error || 'Не удалось вступить в турнир');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="JTModal-overlay">
            <div className="JTModal-container">
                <div className="JTModal-header">
                    <h2>Вступление в турнир</h2>
                    <button className="JTModal-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="JTModal-content">
                    {/* Выбор режима для командных турниров */}
                    {isTeamTournament && mode === 'select' && (
                        <div className="JTModal-mode-selection">
                            <p className="JTModal-hint">Выберите способ участия:</p>
                            
                            <div className="JTModal-mode-options">
                                {myTeams.length > 0 && (
                                    <button 
                                        className="JTModal-mode-option"
                                        onClick={() => setMode('my_team')}
                                    >
                                        <span className="JTModal-icon">⭐</span>
                                        <span className="JTModal-label">Моя команда</span>
                                        <span className="JTModal-description">Использовать свою постоянную или разовую команду</span>
                                    </button>
                                )}

                                <button 
                                    className="JTModal-mode-option"
                                    onClick={() => setMode('create_team')}
                                >
                                    <span className="JTModal-icon">➕</span>
                                    <span className="JTModal-label">Создать команду</span>
                                    <span className="JTModal-description">Создать новую разовую команду для турнира</span>
                                </button>

                                {tournamentTeams.length > 0 && (
                                    <button 
                                        className="JTModal-mode-option"
                                        onClick={() => setMode('join_team')}
                                    >
                                        <span className="JTModal-icon">👥</span>
                                        <span className="JTModal-label">Вступить в команду</span>
                                        <span className="JTModal-description">Отправить запрос в существующую команду</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Создание новой команды */}
                    {mode === 'create_team' && (
                        <div className="JTModal-create-team-form">
                            <button 
                                className="JTModal-back-btn"
                                onClick={() => setMode('select')}
                            >
                                ← Назад
                            </button>

                            <h3>Создание команды</h3>
                            <p className="JTModal-hint">Введите название вашей команды</p>

                            <input
                                type="text"
                                className="JTModal-team-name-input"
                                placeholder="Название команды"
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                maxLength={50}
                                autoFocus
                            />

                            {error && <div className="JTModal-error-message">{error}</div>}

                            <button 
                                className="JTModal-btn-primary"
                                onClick={handleJoin}
                                disabled={loading || !teamName.trim()}
                            >
                                {loading ? 'Создание...' : 'Создать и вступить'}
                            </button>
                        </div>
                    )}

                    {/* Выбор своей команды */}
                    {mode === 'my_team' && (
                        <div className="JTModal-my-team-form">
                            <button 
                                className="JTModal-back-btn"
                                onClick={() => setMode('select')}
                            >
                                ← Назад
                            </button>

                            <h3>Выбор команды</h3>
                            <p className="JTModal-hint">Выберите команду для участия в турнире</p>

                            <div className="JTModal-teams-list">
                                {myTeams.length === 0 ? (
                                    <div className="JTModal-empty-state">
                                        <p>У вас нет команд</p>
                                    </div>
                                ) : (
                                    myTeams.map(team => (
                                        <div 
                                            key={team.id}
                                            className={`JTModal-team-item ${selectedTeam?.id === team.id ? 'JTModal-selected' : ''}`}
                                            onClick={() => setSelectedTeam(team)}
                                        >
                                            <div className="JTModal-team-info">
                                                <div className="JTModal-team-header">
                                                    <span className="JTModal-team-name">{team.name}</span>
                                                    {team.is_permanent && (
                                                        <span className="JTModal-team-badge JTModal-permanent">Постоянная</span>
                                                    )}
                                                </div>
                                                <span className="JTModal-team-members">
                                                    {team.member_count || 0} участников
                                                </span>
                                            </div>
                                            {selectedTeam?.id === team.id && (
                                                <span className="JTModal-checkmark">✓</span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {selectedTeam && (
                                <>
                                    {error && <div className="JTModal-error-message">{error}</div>}

                                    <button 
                                        className="JTModal-btn-primary"
                                        onClick={handleJoin}
                                        disabled={loading}
                                    >
                                        {loading ? 'Вступление...' : 'Вступить с этой командой'}
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Вступление в существующую команду */}
                    {mode === 'join_team' && (
                        <div className="JTModal-join-team-form">
                            <button 
                                className="JTModal-back-btn"
                                onClick={() => setMode('select')}
                            >
                                ← Назад
                            </button>

                            <h3>Вступление в команду</h3>
                            <p className="JTModal-hint">Выберите команду из списка</p>

                            <div className="JTModal-teams-list">
                                {tournamentTeams.length === 0 ? (
                                    <div className="JTModal-empty-state">
                                        <p>В турнире пока нет команд</p>
                                    </div>
                                ) : (
                                    tournamentTeams.map(team => (
                                        <div 
                                            key={team.id}
                                            className={`JTModal-team-item ${selectedTeam?.id === team.id ? 'JTModal-selected' : ''}`}
                                            onClick={() => setSelectedTeam(team)}
                                        >
                                            <div className="JTModal-team-info">
                                                <span className="JTModal-team-name">{team.name}</span>
                                                <span className="JTModal-team-members">
                                                    {team.member_count || 0} / {getMaxTeamSize(tournament.participant_type)} участников
                                                </span>
                                            </div>
                                            {selectedTeam?.id === team.id && (
                                                <span className="JTModal-checkmark">✓</span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {selectedTeam && (
                                <>
                                    <div className="JTModal-message-field">
                                        <label>Сообщение капитану (опционально):</label>
                                        <textarea
                                            placeholder="Расскажите о себе..."
                                            value={joinMessage}
                                            onChange={(e) => setJoinMessage(e.target.value)}
                                            maxLength={200}
                                        />
                                    </div>

                                    {error && <div className="JTModal-error-message">{error}</div>}

                                    <button 
                                        className="JTModal-btn-primary"
                                        onClick={handleJoin}
                                        disabled={loading}
                                    >
                                        {loading ? 'Отправка...' : 'Отправить запрос'}
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Соло турниры */}
                    {isSolo && (
                        <div className="JTModal-solo-join">
                            <p className="JTModal-hint">Вы готовы участвовать в этом турнире?</p>

                            {error && <div className="JTModal-error-message">{error}</div>}

                            <button 
                                className="JTModal-btn-primary"
                                onClick={handleJoin}
                                disabled={loading}
                            >
                                {loading ? 'Вступление...' : 'Вступить в турнир'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Получение максимального размера команды
function getMaxTeamSize(participantType) {
    const sizes = {
        'solo': 1,
        '2x2': 2,
        '3x3': 3,
        '5x5': 5
    };
    return sizes[participantType] || 5;
}

export default JoinTournamentModal;

