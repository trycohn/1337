import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GameIcon } from '../utils/game-icons';
import api from '../axios';

function MyTournaments() {
    const [items, setItems] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        (async function load() {
            try {
                const { data } = await api.get('/api/tournaments/my');
                if (isMounted) setItems(Array.isArray(data) ? data : []);
            } catch (e) {
                setError('Не удалось загрузить список ваших турниров');
            } finally {
                if (isMounted) setLoading(false);
            }
        })();
        return () => { isMounted = false; };
    }, []);

    if (loading) return <section><p>Загрузка...</p></section>;
    if (error) return <section><p className="error">{error}</p></section>;

    const renderParticipantsCell = (t) => {
        const displayedCount = t.format === 'mix'
            ? (t.players_count ?? t.participant_count)
            : t.participant_count;
        return t.max_participants
            ? `${displayedCount} из ${t.max_participants}`
            : displayedCount;
    };

    return (
        <section className="tournaments-list">
            <h2>Мои турниры</h2>
            {items.length === 0 && <p>Нет турниров, где вы создатель или администратор.</p>}
            {items.length > 0 && (
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
                        {items.map((t) => (
                            <tr key={t.id}>
                                <td data-label="Игра" title={t.game}>
                                    <GameIcon game={t.game} size={24} className="tournament-game-icon" />
                                </td>
                                <td data-label="Название" title={t.name}>
                                    <Link to={`/tournaments/${t.id}`}>{t.name}</Link>
                                </td>
                                <td data-label="Участники">{renderParticipantsCell(t)}</td>
                                <td data-label="Формат" title={t.format}>{t.format}</td>
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


