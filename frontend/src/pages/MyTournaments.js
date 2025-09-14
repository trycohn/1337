import { useEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { Link } from 'react-router-dom';
import { GameIcon } from '../utils/game-icons';
import api from '../axios';

function MyTournaments() {
    const [items, setItems] = useState([]);
    const [showOnlyHidden, setShowOnlyHidden] = useState(false);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        (async function load() {
            const startedAt = Date.now();
            try {
                const qs = showOnlyHidden ? '?hidden=true' : '';
                const { data } = await api.get(`/api/tournaments/my${qs}`);
                if (isMounted) setItems(Array.isArray(data) ? data : []);
            } catch (e) {
                setError('Не удалось загрузить список ваших турниров');
            } finally {
                const elapsed = Date.now() - startedAt;
                const minDelay = 1000;
                const wait = elapsed < minDelay ? (minDelay - elapsed) : 0;
                if (isMounted) {
                    setTimeout(() => {
                        if (isMounted) setLoading(false);
                    }, wait);
                }
            }
        })();
        return () => { isMounted = false; };
    }, [showOnlyHidden]);

    if (loading) return (
        <section className="tournaments-list">
            <h2>Мои турниры</h2>
            <table>
                    <thead>
                        <tr>
                            <th>Игра</th>
                            <th>Название</th>
                            <th>Участники</th>
                            <th>Формат</th>
                            <th>Дата</th>
                            <th>Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...Array(3)].map((_, i) => (
                            <tr key={i}>
                                <td data-label="Игра">
                                    <Skeleton circle width={24} height={24} />
                                </td>
                                <td data-label="Название">
                                    <Skeleton width="60%" />
                                </td>
                                <td data-label="Участники">
                                    <Skeleton width="40%" />
                                </td>
                                <td data-label="Формат">
                                    <Skeleton width="40%" />
                                </td>
                                <td data-label="Дата">
                                    <Skeleton width="50%" />
                                </td>
                                <td data-label="Статус">
                                    <Skeleton width="50%" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
        </section>
    );
    if (error) return <section><p className="error">{error}</p></section>;

    const renderParticipantsCell = (t) => {
        const displayedCount = t.format === 'mix'
            ? (t.players_count ?? t.participant_count)
            : t.participant_count;
        return t.max_participants
            ? `${displayedCount} из ${t.max_participants}`
            : displayedCount;
    };

    const renderAccessCell = (t) => {
        if (t.is_hidden) return 'Скрытый';
        if ((t.access_type || '').toLowerCase() === 'closed') return 'Закрытый';
        return 'Открытый';
    };

    const filtered = showOnlyHidden ? items.filter(t => t.is_hidden) : items;

    return (
        <section className="tournaments-list">
            <h2>Мои турниры</h2>
            <div style={{display:'flex', alignItems:'center', gap:12, margin:'12px 0'}}>
                <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                    <input type="checkbox" checked={showOnlyHidden} onChange={(e)=>setShowOnlyHidden(e.target.checked)} />
                    Показать только скрытые
                </label>
            </div>
            {filtered.length === 0 && <p>Нет турниров, подходящих под выбранные условия.</p>}
            {filtered.length > 0 && (
                <table>
                    <thead>
                        <tr>
                            <th>Игра</th>
                            <th>Название</th>
                            <th>Участники</th>
                            <th>Формат</th>
                            <th>Доступ</th>
                            <th>Дата</th>
                            <th>Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((t) => (
                            <tr key={t.id}>
                                <td data-label="Игра" title={t.game}>
                                    <GameIcon game={t.game} size={24} className="tournament-game-icon" />
                                </td>
                                <td data-label="Название" title={t.name}>
                                    {t.is_hidden && <span title="Скрытый турнир" style={{marginRight: 6}}>🔒</span>}
                                    <Link to={`/tournaments/${t.id}`}>{t.name}</Link>
                                </td>
                                <td data-label="Участники">{renderParticipantsCell(t)}</td>
                                <td data-label="Формат" title={t.format}>{t.format}</td>
                                <td data-label="Доступ">{renderAccessCell(t)}</td>
                                <td data-label="Дата">{t.start_date ? new Date(t.start_date).toLocaleDateString('ru-RU') : '-'}</td>
                                <td data-label="Статус">
                                    <span className={`tournament-status-badge ${
                                        t.status === 'active' ? 'tournament-status-active' : 
                                        t.status === 'in_progress' ? 'tournament-status-in-progress' : 
                                        t.status === 'completed' ? 'tournament-status-completed' : 
                                        'tournament-status-completed'
                                    }`}>
                                        {t.status === 'active' ? 'Активен' : 
                                         t.status === 'in_progress' ? 'Идет' : 
                                         t.status === 'completed' ? 'Завершен' : 
                                         'Неизвестно'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

export default MyTournaments;


