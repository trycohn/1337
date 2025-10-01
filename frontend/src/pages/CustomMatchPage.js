import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../axios';

function CustomMatchPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const r = await api.get(`/api/matches/${id}`);
                if (!mounted) return;
                if (r?.data?.match) setData(r.data);
                else setError('Матч не найден');
            } catch (e) {
                setError('Не удалось загрузить матч');
            } finally {
                setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [id]);

    if (loading) return <div className="container"><h2>Загрузка матча…</h2></div>;
    if (error) return (
        <div className="container">
            <h2>Ошибка</h2>
            <p>{error}</p>
            <button className="btn" onClick={() => navigate(-1)}>Назад</button>
        </div>
    );

    const { match, veto_steps } = data || {};
    const titleLeft = match.team1_name || 'Команда 1';
    const titleRight = match.team2_name || 'Команда 2';
    const score1 = match.score1 ?? '-';
    const score2 = match.score2 ?? '-';

    return (
        <div className="container">
            <div className="custom-match-mt-16">
                <h2>Custom match — {match.game || 'CS2'}</h2>
                <div className="list-row">
                    <div className="list-row-left">
                        <strong>{titleLeft}</strong> vs <strong>{titleRight}</strong>
                    </div>
                    <div className="list-row-right">
                        <span>Счёт: {score1}:{score2}</span>
                    </div>
                </div>
            </div>

            {(match.connect_url || match.gotv_url) && (
                <div className="custom-match-mt-16">
                    <h3>Подключение</h3>
                    {match.connect_url && (
                        <div className="list-row">
                            <div className="list-row-left">
                                <span>Игроки:</span>
                                <code className="code-inline">{match.connect_url}</code>
                            </div>
                            <div className="list-row-right">
                                <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(match.connect_url)}>Копировать</button>
                            </div>
                        </div>
                    )}
                    {match.gotv_url && (
                        <div className="list-row custom-match-mt-8">
                            <div className="list-row-left">
                                <span>GOTV:</span>
                                <code className="code-inline">{match.gotv_url}</code>
                            </div>
                            <div className="list-row-right">
                                <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(match.gotv_url)}>Копировать</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {Array.isArray(match.maps_data) && match.maps_data.length > 0 && (
                <div className="custom-match-mt-16">
                    <h3>Карты</h3>
                    <ul>
                        {match.maps_data.map((m) => (
                            <li key={m.order}>Карта {m.index}: {m.map}</li>
                        ))}
                    </ul>
                </div>
            )}

            {Array.isArray(veto_steps) && veto_steps.length > 0 && (
                <div className="custom-match-mt-16">
                    <h3>История пик/бан</h3>
                    <ol>
                        {veto_steps.map((s) => (
                            <li key={s.action_order}>
                                {s.action_order}. {s.action_type.toUpperCase()} — {s.map_name} (team {s.team_id || '?'})
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    );
}

export default CustomMatchPage;

