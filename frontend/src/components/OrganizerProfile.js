import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../axios';
import './OrganizerProfile.css';
import { ensureHttps } from '../utils/userHelpers';
import { getAvatarCategoryClass } from '../utils/avatarCategory';

function OrganizerProfile() {
    const { slug } = useParams();
    const [organizerData, setOrganizerData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('about');

    const fetchOrganizerData = useCallback(async () => {
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
    }, [slug]);

    useEffect(() => {
        fetchOrganizerData();
    }, [fetchOrganizerData]);

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
        if (!status) return 'badge';
        const normalized = String(status).toLowerCase();
        return normalized === 'active' || normalized === 'registration' ? 'badge live' : 'badge';
    };

    //

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
            <div className="wrap">
                <section className="header">
                    <div className="logo">
                        <img src={ensureHttps(organizer.logo_url) || '/default-org-logo.png'} alt={organizer.name} />
                    </div>
                    <div className="head-main">
                        <h1 className="org-name">{organizer.name}</h1>
                        <div className="meta">
                            <div className="manager">
                                <img className="mini" src={ensureHttps(organizer.manager_avatar) || '/default-avatar.png'} alt={organizer.manager_username} />
                                <span>Менеджер: <Link to={`/user/${organizer.manager_id}`} className="manager-strong">{organizer.manager_username}</Link></span>
                            </div>
                        </div>
                        <div className="kpis">
                            <div className="kpi"><div className="val">{stats.total_tournaments || 0}</div><div className="label">Турниров</div></div>
                            <div className="kpi"><div className="val">{stats.total_members || 0}</div><div className="label">Участников</div></div>
                            <div className="kpi"><div className="val">{formatPrizePool(stats.total_prize_pool)}</div><div className="label">Призовой фонд</div></div>
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className="btn primary">Пригласить</button>
                        <button type="button" className="btn">Редактировать</button>
                    </div>
                </section>

                <section className="tabs">
                    <button className={activeTab === 'about' ? 'tab active' : 'tab'} onClick={() => setActiveTab('about')}>О нас</button>
                    <button className={activeTab === 'tournaments' ? 'tab active' : 'tab'} onClick={() => setActiveTab('tournaments')}>Турниры</button>
                    <button className={activeTab === 'members' ? 'tab active' : 'tab'} onClick={() => setActiveTab('members')}>Команда</button>
                    <button className={activeTab === 'contacts' ? 'tab active' : 'tab'} onClick={() => setActiveTab('contacts')}>Контакты</button>
                </section>

                <section className="sections">
                    {activeTab === 'about' && (
                        <div id="s1" className="section show">
                            <div className="card">
                                <h3 className="card-title">Описание</h3>
                                <div className="text">{organizer.description || 'Описание не указано'}</div>
                                <div className="section-divider" />
                                <h3 className="card-title">Статистика</h3>
                                <div className="grid-4">
                                    <div className="stat"><div className="n">{stats.total_tournaments || 0}</div><div className="t">Всего турниров</div></div>
                                    <div className="stat"><div className="n">{stats.completed_tournaments || 0}</div><div className="t">Завершено</div></div>
                                    <div className="stat"><div className="n">{stats.active_tournaments || 0}</div><div className="t">Активных</div></div>
                                    <div className="stat"><div className="n">{stats.total_members || 0}</div><div className="t">Участников</div></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tournaments' && (
                        <div id="s2" className="section show">
                            <div className="card">
                                <h3 className="card-title">Турниры организации</h3>
                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Название</th>
                                                <th>Дисциплина</th>
                                                <th>Участники</th>
                                                <th>Формат</th>
                                                <th>Дата</th>
                                                <th>Статус</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tournaments && tournaments.length > 0 ? (
                                                tournaments.map((t) => (
                                                    <tr key={t.id}>
                                                        <td>
                                                            <Link to={`/tournaments/${t.id}`} className="table-link">{t.name}</Link>
                                                        </td>
                                                        <td>{t.discipline || '—'}</td>
                                                        <td>{(t.current_teams ?? t.current_participants ?? 0)}{t.max_teams || t.max_participants ? `/${t.max_teams || t.max_participants}` : ''}</td>
                                                        <td>{t.format || t.type || '—'}</td>
                                                        <td>{t.start_date ? formatDate(t.start_date) : '—'}</td>
                                                        <td>
                                                            <span className={getTournamentStatusClass(t.status)}>
                                                                {getTournamentStatusText(t.status)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} className="muted">Турниры не найдены</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'members' && (
                        <div id="s3" className="section show">
                            <div className="card">
                                <h3 className="card-title">Команда</h3>
                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Участник</th>
                                                <th>Роль</th>
                                                <th>Статус</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {members && members.length > 0 ? (
                                                members.map((m) => (
                                                    <tr key={m.id}>
                                                        <td>
                                                            <div className="member">
                                                                <img className={`ph ${getAvatarCategoryClass(m.avatar_url)}`} src={ensureHttps(m.avatar_url) || '/default-avatar.png'} alt={m.username} />
                                                                <Link to={`/user/${m.id}`} className="table-link">{m.username}</Link>
                                                            </div>
                                                        </td>
                                                        <td className="muted">{m.role === 'manager' ? 'Менеджер' : m.role === 'admin' ? 'Администратор' : 'Игрок'}</td>
                                                        <td><span className="badge">В штате</span></td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={3} className="muted">Участники не найдены</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'contacts' && (
                        <div id="s4" className="section show">
                            <div className="card">
                                <h3 className="card-title">Контакты</h3>
                                <div className="kontakt">
                                    {organizer.contact_email && (
                                        <div><span className="muted">Email:</span> <a className="link" href={`mailto:${organizer.contact_email}`}>{organizer.contact_email}</a></div>
                                    )}
                                    {organizer.telegram_url && (
                                        <div><span className="muted">Telegram:</span> <a className="link" href={ensureHttps(organizer.telegram_url)} target="_blank" rel="noreferrer">{organizer.telegram_url.replace(/^https?:\/\//, '')}</a></div>
                                    )}
                                    {organizer.website_url && (
                                        <div><span className="muted">Сайт:</span> <a className="link" href={ensureHttps(organizer.website_url)} target="_blank" rel="noreferrer">{organizer.website_url.replace(/^https?:\/\//, '')}</a></div>
                                    )}
                                    {!organizer.contact_email && !organizer.telegram_url && !organizer.website_url && (
                                        <div className="muted">Контактная информация не указана</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

export default OrganizerProfile; 