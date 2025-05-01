import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { ensureHttps } from '../utils/userHelpers';
import TeamCard from './TeamCard';
import './TeamGenerator.css';

/**
 * Компонент для генерации команд в турнире
 * 
 * @param {Object} props - Свойства компонента
 * @param {Object} props.tournament - Объект турнира
 * @param {Array} props.participants - Список участников для формирования команд
 * @param {Function} props.onTeamsGenerated - Функция обратного вызова при формировании команд
 * @param {Function} props.onTeamsUpdated - Функция обратного вызова для обновления данных турнира
 * @param {Function} props.onRemoveParticipant - Функция для удаления участника
 * @param {boolean} props.isAdminOrCreator - Имеет ли пользователь права администратора
 * @param {Function} props.toast - Функция для отображения уведомлений
 */
const TeamGenerator = ({ 
    tournament, 
    participants, 
    onTeamsGenerated, 
    onTeamsUpdated,
    onRemoveParticipant,
    isAdminOrCreator = false,
    toast
}) => {
    const [ratingType, setRatingType] = useState('faceit');
    const [teamSize, setTeamSize] = useState('5');
    const [loading, setLoading] = useState(false);
    const [mixedTeams, setMixedTeams] = useState([]);
    const [originalParticipants, setOriginalParticipants] = useState([]);
    const [loadingParticipants, setLoadingParticipants] = useState(false);

    // При инициализации устанавливаем размер команды из турнира
    useEffect(() => {
        if (tournament && tournament.team_size) {
            setTeamSize(tournament.team_size.toString());
        }
        
        // При инициализации сохраняем полученных участников и загружаем оригинальных если
        // это турнир в режиме team (уже были сформированы команды)
        if (participants && participants.length > 0) {
            setOriginalParticipants(participants);
        }
        
        // Загружаем оригинальных участников, если это турнир с командами
        if (tournament && tournament.id && tournament.participant_type === 'team' && tournament.format === 'mix') {
            fetchOriginalParticipants();
        }
    }, [tournament, participants]);

    // Функция для загрузки оригинальных участников
    const fetchOriginalParticipants = async () => {
        if (!tournament || !tournament.id) return;
        
        setLoadingParticipants(true);
        try {
            const response = await api.get(`/api/tournaments/${tournament.id}/original-participants`);
            if (response.data && Array.isArray(response.data)) {
                setOriginalParticipants(response.data);
            }
        } catch (error) {
            console.error('Ошибка при загрузке оригинальных участников:', error);
            if (toast) {
                toast.error('Не удалось загрузить список участников');
            }
        } finally {
            setLoadingParticipants(false);
        }
    };

    // Функция для обновления размера команды на сервере
    const updateTeamSize = async (newSize) => {
        if (!tournament || !tournament.id || !isAdminOrCreator) return;
        
        try {
            const token = localStorage.getItem('token');
            await api.patch(`/api/tournaments/${tournament.id}/team-size`, {
                teamSize: parseInt(newSize, 10)
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (toast) {
                toast.success(`Размер команды изменен на ${newSize}`);
            }
            
            if (onTeamsUpdated) {
                onTeamsUpdated();
            }
        } catch (error) {
            console.error('Ошибка при обновлении размера команды:', error);
            if (toast) {
                toast.error(error.response?.data?.error || 'Не удалось обновить размер команды');
            }
        }
    };

    // Функция для формирования команд
    const handleFormTeams = async () => {
        if (!tournament || !tournament.id) return;
        
        if (participants && participants.length > 0) {
            setOriginalParticipants([...participants]);
        }
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.post(`/api/tournaments/${tournament.id}/form-teams`, {
                ratingType: ratingType,
                teamSize: parseInt(teamSize, 10)
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.data) {
                if (response.data.teams) {
                    setMixedTeams(response.data.teams);
                }
                
                if (onTeamsGenerated) {
                    onTeamsGenerated(response.data.teams || []);
                }
                
                if (onTeamsUpdated) {
                    onTeamsUpdated();
                }
                
                // После формирования команд загружаем оригинальных участников для отображения
                fetchOriginalParticipants();
                
                if (toast) {
                    toast.success('Команды успешно сформированы');
                }
            }
        } catch (error) {
            console.error('Ошибка при формировании команд:', error);
            if (toast) {
                toast.error(error.response?.data?.error || 'Не удалось сформировать команды');
            }
        } finally {
            setLoading(false);
        }
    };

    const teamsExist = tournament?.teams && tournament.teams.length > 0;
    const teamsList = teamsExist ? tournament.teams : mixedTeams;
    const displayParticipants = originalParticipants.length > 0 ? originalParticipants : participants;

    return (
        <div className="team-generator">
            {tournament?.format === 'mix' && !tournament?.bracket && (
                <>
                    {/* Секция с исходными участниками */}
                    <div className="original-participants-section">
                        <h3>Зарегистрированные игроки ({displayParticipants?.length || 0})</h3>
                        <div className="mix-players-list">
                            {loadingParticipants ? (
                                <p className="loading-participants">Загрузка участников...</p>
                            ) : displayParticipants && displayParticipants.length > 0 ? (
                                <div className="participants-grid">
                                    {displayParticipants.map((participant) => (
                                        <div key={participant?.id || `participant-${Math.random()}`} className="participant-card">
                                            <div className="participant-avatar">
                                                <img 
                                                    src={ensureHttps(participant.avatar_url) || '/default-avatar.png'} 
                                                    alt={`${participant.name} avatar`}
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = '/default-avatar.png';
                                                    }}
                                                />
                                            </div>
                                            <div className="participant-info">
                                                <span className="participant-name">{participant.name}</span>
                                                <span className="participant-rating">
                                                    {ratingType === 'faceit' 
                                                        ? `FACEIT: ${participant.faceit_elo || 1000}`
                                                        : `Premier: ${participant.premier_rank || 5}`
                                                    }
                                                </span>
                                            </div>
                                            {isAdminOrCreator && tournament.participant_type === 'solo' && (
                                                <button 
                                                    className="remove-participant"
                                                    onClick={() => onRemoveParticipant(participant.id)}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="no-participants">Нет зарегистрированных игроков</p>
                            )}
                        </div>
                    </div>

                    {/* Секция сформированных команд - переместили сюда, сразу после исходных участников */}
                    {(teamsExist || teamsList.length > 0) && (
                        <div className="mixed-teams-section">
                            <h3>Сформированные команды</h3>
                            <div className="mixed-teams-grid">
                                {teamsList.map((team, index) => (
                                    <TeamCard
                                        key={index}
                                        team={team}
                                        index={index}
                                        ratingType={ratingType}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Секция с настройками микса */}
                    {isAdminOrCreator && (
                        <div className="mix-settings-section">
                            <h3>Настройки микса</h3>
                            <div className="mix-controls-row">
                                <div className="mix-form-group">
                                    <label>Размер команды:</label>
                                    <select
                                        value={teamSize}
                                        onChange={(e) => {
                                            const newSize = e.target.value;
                                            setTeamSize(newSize);
                                            updateTeamSize(newSize);
                                        }}
                                        disabled={teamsExist || loading}
                                    >
                                        <option value="2">2 игрока</option>
                                        <option value="5">5 игроков</option>
                                    </select>
                                </div>
                            
                                <div className="mix-form-group rating-group">
                                    <label>Миксовать по рейтингу:</label>
                                    <select
                                        value={ratingType}
                                        onChange={(e) => setRatingType(e.target.value)}
                                    >
                                        <option value="faceit">FACEit</option>
                                        <option value="premier">Steam Premier</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mix-buttons-row">
                                {tournament.participant_type === 'solo' && (!teamsExist || teamsList.length === 0) && (
                                    <button 
                                        onClick={handleFormTeams} 
                                        className="form-teams-button"
                                        disabled={loading}
                                    >
                                        {loading ? 'Создание команд...' : 'Сформировать команды из участников'}
                                    </button>
                                )}
                                {tournament.participant_type === 'solo' && (teamsExist || teamsList.length > 0) && tournament.status === 'pending' && (
                                    <button 
                                        onClick={handleFormTeams} 
                                        className="reformate-teams-button"
                                        disabled={loading}
                                    >
                                        {loading ? 'Пересоздание команд...' : 'Переформировать команды'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TeamGenerator; 