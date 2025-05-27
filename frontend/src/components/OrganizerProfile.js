import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../axios';
import './OrganizerProfile.css';
import { ensureHttps } from '../utils/userHelpers';

function OrganizerProfile() {
    const { slug } = useParams();
    const [organizerData, setOrganizerData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('about');

    useEffect(() => {
        fetchOrganizerData();
    }, [slug]);

    const fetchOrganizerData = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/api/organizers/${slug}`);
            setOrganizerData(response.data);
        } catch (err) {
            console.error('Ошибка загрузки данных организатора:', err);
            setError(err.response?.status === 404 ? 'Организатор не найден' : 'Ошибка загрузки данных');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatPrizePool = (amount) => {
        if (!amount || amount === 0) return 'Не указан';
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const getTournamentStatusText = (status) => {
        const statusMap = {
            'active': 'Активный',
            'completed': 'Завершен',
            'upcoming': 'Предстоящий',
            'registration': 'Регистрация'
        };
        return statusMap[status] || status;
    };

    const getTournamentStatusClass = (status) => {
        return `tournament-status tournament-status-${status}`;
    };

    const renderWinner = (winner) => {
        if (!winner) return <span className="no-winner">Не определен</span>;

        if (winner.type === 'user') {
            return (
                <Link to={`/user/${winner.id}`} className="winner-link">
                    <img 
                        src={ensureHttps(winner.avatar_url) || '/default-avatar.png'} 
                        alt={winner.username}
                        className="winner-avatar"
                    />
                    <span className="winner-name">{winner.username}</span>
                </Link>
            );
        }

        if (winner.type === 'team') {
            return (
                <div className="team-winner">
                    <Link to={`/team/${winner.id}`} className="winner-link">
                        <img 
                            src={ensureHttps(winner.logo_url) || '/default-team-logo.png'} 
                            alt={winner.name}
                            className="winner-avatar"
                        />
                        <span className="winner-name">{winner.name}</span>
                    </Link>
                    {winner.members && (
                        <div className="team-members">
                            {winner.members.map(member => (
                                <Link key={member.id} to={`/user/${member.id}`} className="team-member">
                                    <img 
                                        src={ensureHttps(member.avatar_url) || '/default-avatar.png'}
                                        alt={member.username}
                                        className="member-avatar"
                                    />
                                    <span className="member-name">{member.username}</span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        return <span className="no-winner">Не определен</span>;
    };

    if (loading) {
        return <div className="organizer-loading">Загрузка...</div>;
    }

    if (error) {
        return <div className="organizer-error">{error}</div>;
    }

    if (!organizerData) {
        return <div className="organizer-error">Данные не найдены</div>;
    }

    const { organizer, members, tournaments, stats } = organizerData;

    return (
        <div className="organizer-profile">
            {/* Заголовок профиля */}
            <div className="organizer-header">
                <div className="organizer-logo">
                    <img 
                        src={ensureHttps(organizer.logo_url) || '/default-org-logo.png'}
                        alt={organizer.name}
                        className="org-logo"
                    />
                </div>
                <div className="organizer-info">
                    <h1 className="organizer-name">{organizer.name}</h1>
                    <div className="organizer-manager">
                        <span>Менеджер: </span>
                        <Link to={`/user/${organizer.manager_id}`} className="manager-link">
                            <img 
                                src={ensureHttps(organizer.manager_avatar) || '/default-avatar.png'}
                                alt={organizer.manager_username}
                                className="manager-avatar"
                            />
                            {organizer.manager_username}
                        </Link>
                    </div>
                    <div className="organizer-stats-summary">
                        <div className="stat-item">
                            <span className="stat-value">{stats.total_tournaments}</span>
                            <span className="stat-label">Турниров</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{stats.total_members}</span>
                            <span className="stat-label">Участников</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{formatPrizePool(stats.total_prize_pool)}</span>
                            <span className="stat-label">Призовой фонд</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Навигация по вкладкам */}
            <div className="organizer-navigation">
                <button 
                    className={`nav-tab ${activeTab === 'about' ? 'active' : ''}`}
                    onClick={() => setActiveTab('about')}
                >
                    О нас
                </button>
                <button 
                    className={`nav-tab ${activeTab === 'tournaments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tournaments')}
                >
                    Турниры ({tournaments.length})
                </button>
                <button 
                    className={`nav-tab ${activeTab === 'members' ? 'active' : ''}`}
                    onClick={() => setActiveTab('members')}
                >
                    Команда ({members.length})
                </button>
                <button 
                    className={`nav-tab ${activeTab === 'contacts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('contacts')}
                >
                    Контакты
                </button>
            </div>

            {/* Содержимое вкладок */}
            <div className="organizer-content">
                {/* Вкладка "О нас" */}
                {activeTab === 'about' && (
                    <div className="about-tab">
                        <div className="organizer-description">
                            <h3>Описание</h3>
                            <p>{organizer.description || 'Описание не указано'}</p>
                        </div>

                        <div className="organizer-detailed-stats">
                            <h3>Статистика</h3>
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-value">{stats.total_tournaments}</div>
                                    <div className="stat-label">Всего турниров</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{stats.completed_tournaments}</div>
                                    <div className="stat-label">Завершено</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{stats.active_tournaments}</div>
                                    <div className="stat-label">Активных</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{stats.total_members}</div>
                                    <div className="stat-label">Участников</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Вкладка "Турниры" */}
                {activeTab === 'tournaments' && (
                    <div className="tournaments-tab">
                        <h3>Проведенные турниры</h3>
                        {tournaments.length > 0 ? (
                            <div className="tournaments-list">
                                {tournaments.map(tournament => (
                                    <div key={tournament.id} className="tournament-card">
                                        <div className="tournament-header">
                                            <div className="tournament-info">
                                                <h4>
                                                    <Link to={`/tournament/${tournament.id}`} className="tournament-link">
                                                        {tournament.name}
                                                    </Link>
                                                </h4>
                                                <div className="tournament-meta">
                                                    <span className={getTournamentStatusClass(tournament.status)}>
                                                        {getTournamentStatusText(tournament.status)}
                                                    </span>
                                                    <span className="tournament-discipline">{tournament.discipline}</span>
                                                    <span className="tournament-date">
                                                        {formatDate(tournament.start_date)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="tournament-details">
                                                <div className="detail-item">
                                                    <span className="detail-label">Участники:</span>
                                                    <span className="detail-value">
                                                        {tournament.current_teams}/{tournament.max_teams}
                                                    </span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-label">Призовой фонд:</span>
                                                    <span className="detail-value">
                                                        {formatPrizePool(tournament.prize_pool)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {tournament.status === 'completed' && tournament.winner && (
                                            <div className="tournament-winner">
                                                <h5>🏆 Победитель:</h5>
                                                {renderWinner(tournament.winner)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="no-tournaments">Турниры не найдены</div>
                        )}
                    </div>
                )}

                {/* Вкладка "Команда" */}
                {activeTab === 'members' && (
                    <div className="members-tab">
                        <h3>Команда организации</h3>
                        {members.length > 0 ? (
                            <div className="members-list">
                                {members.map(member => (
                                    <div key={member.id} className="member-card">
                                        <Link to={`/user/${member.id}`} className="member-link">
                                            <img 
                                                src={ensureHttps(member.avatar_url) || '/default-avatar.png'}
                                                alt={member.username}
                                                className="member-avatar"
                                            />
                                            <div className="member-info">
                                                <div className="member-name">{member.username}</div>
                                                <div className="member-role">
                                                    {member.role === 'manager' ? 'Менеджер' : 
                                                     member.role === 'admin' ? 'Администратор' : 'Участник'}
                                                </div>
                                                <div className="member-joined">
                                                    С {formatDate(member.joined_at)}
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="no-members">Участники не найдены</div>
                        )}
                    </div>
                )}

                {/* Вкладка "Контакты" */}
                {activeTab === 'contacts' && (
                    <div className="contacts-tab">
                        <h3>Контактная информация</h3>
                        <div className="contacts-grid">
                            {organizer.contact_email && (
                                <div className="contact-item">
                                    <div className="contact-label">📧 Email:</div>
                                    <div className="contact-value">
                                        <a href={`mailto:${organizer.contact_email}`}>
                                            {organizer.contact_email}
                                        </a>
                                    </div>
                                </div>
                            )}
                            
                            {organizer.contact_phone && (
                                <div className="contact-item">
                                    <div className="contact-label">📞 Телефон:</div>
                                    <div className="contact-value">
                                        <a href={`tel:${organizer.contact_phone}`}>
                                            {organizer.contact_phone}
                                        </a>
                                    </div>
                                </div>
                            )}
                            
                            {organizer.website_url && (
                                <div className="contact-item">
                                    <div className="contact-label">🌐 Сайт:</div>
                                    <div className="contact-value">
                                        <a href={ensureHttps(organizer.website_url)} target="_blank" rel="noopener noreferrer">
                                            {organizer.website_url.replace(/^https?:\/\//, '')}
                                        </a>
                                    </div>
                                </div>
                            )}
                            
                            {organizer.vk_url && (
                                <div className="contact-item">
                                    <div className="contact-label">📘 VK:</div>
                                    <div className="contact-value">
                                        <a href={ensureHttps(organizer.vk_url)} target="_blank" rel="noopener noreferrer">
                                            {organizer.vk_url.replace(/^https?:\/\//, '')}
                                        </a>
                                    </div>
                                </div>
                            )}
                            
                            {organizer.telegram_url && (
                                <div className="contact-item">
                                    <div className="contact-label">✈️ Telegram:</div>
                                    <div className="contact-value">
                                        <a href={ensureHttps(organizer.telegram_url)} target="_blank" rel="noopener noreferrer">
                                            {organizer.telegram_url.replace(/^https?:\/\//, '')}
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!organizer.contact_email && !organizer.contact_phone && !organizer.website_url && !organizer.vk_url && !organizer.telegram_url && (
                            <div className="no-contacts">Контактная информация не указана</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default OrganizerProfile; 