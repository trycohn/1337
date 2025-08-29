import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

    return (
        <section className="tournaments-list">
            <h2>Мои турниры</h2>
            {items.length === 0 && <p>Нет турниров, где вы создатель или администратор.</p>}
            {items.length > 0 && (
                <div className="tournaments-cards">
                    {items.map(t => (
                        <div key={t.id} className="tournament-card">
                            <h3 className="tournament-name">
                                <Link to={`/tournaments/${t.id}`}>{t.name}</Link>
                            </h3>
                            <div className="tournament-details">
                                <div className="tournament-info">
                                    <span className="tournament-label">Игра:</span>
                                    <span className="tournament-value">{t.game}</span>
                                </div>
                                <div className="tournament-info">
                                    <span className="tournament-label">Формат:</span>
                                    <span className="tournament-value">{t.format}</span>
                                </div>
                                <div className="tournament-info">
                                    <span className="tournament-label">Статус:</span>
                                    <span className={`tournament-status ${t.status === 'active' ? 'active' : t.status === 'in_progress' ? 'in-progress' : 'completed'}`}>
                                        {t.status === 'active' ? 'Активен' : t.status === 'in_progress' ? 'Идет' : t.status === 'completed' ? 'Завершен' : 'Неизвестно'}
                                    </span>
                                </div>
                                {t.start_date && (
                                    <div className="tournament-info">
                                        <span className="tournament-label">Дата:</span>
                                        <span className="tournament-value">{new Date(t.start_date).toLocaleDateString('ru-RU')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default MyTournaments;


