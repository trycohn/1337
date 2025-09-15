import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import './LiveParticipantSearch.css';

const MIN_QUERY = 2;

function LiveParticipantSearch({ tournamentId, onAdded }) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [error, setError] = useState('');
    const [addingId, setAddingId] = useState(null);
    const [debounce, setDebounce] = useState(null);

    const search = useCallback(async (q) => {
        if (!q || q.length < MIN_QUERY) { setResults([]); return; }
        setLoading(true);
        setError('');
        try {
            // Используем универсальный пользовательский поиск (предполагается /api/users/search?q=...)
            // Если есть другой ваш эндпоинт поиска — замените здесь
            const { data } = await api.get(`/api/users/search?query=${encodeURIComponent(q)}&limit=20`);
            setResults(Array.isArray(data) ? data : (data?.users || []));
        } catch (e) {
            setError('Ошибка поиска');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (debounce) clearTimeout(debounce);
        const t = setTimeout(() => search(query), 300);
        setDebounce(t);
        return () => clearTimeout(t);
    }, [query, search]);

    const handleAdd = async (user) => {
        if (!user?.id) return;
        setAddingId(user.id);
        try {
            // Добавляем как зарегистрированного участника по userId
            await api.post(`/api/tournaments/${tournamentId}/add-participant`, {
                userId: user.id
            });
            onAdded?.();
        } catch (e) {
            // no-op, можно отобразить уведомление
        } finally {
            setAddingId(null);
        }
    };

    return (
        <div className="live-search-container">
            <input
                type="text"
                placeholder="Поиск по пользователям (минимум 3 символа)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="live-search-input"
            />
            {loading && <div className="live-search-loading">Поиск...</div>}
            {error && <div className="live-search-error">{error}</div>}
            {!loading && results && results.length > 0 && (
                <div className="live-search-results">
                    {results.map((u) => (
                        <div key={u.id} className="live-search-row">
                            <div className="live-search-user">
                                <div className="live-search-avatar">
                                    {(u.username || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="live-search-username">{u.username || `User #${u.id}`}</div>
                                    {(u.faceit_elo || u.cs2_premier_rank) && (
                                        <div className="live-search-meta">
                                            {u.faceit_elo && `${u.faceit_elo} ELO`}
                                            {u.faceit_elo && u.cs2_premier_rank ? ' • ' : ''}
                                            {u.cs2_premier_rank && `Premier ${u.cs2_premier_rank}`}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button className="btn btn-primary" disabled={addingId===u.id} onClick={() => handleAdd(u)}>
                                {addingId===u.id ? 'Добавление...' : 'Добавить'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {!loading && query.length >= MIN_QUERY && results.length === 0 && !error && (
                <div className="live-search-empty">Ничего не найдено</div>
            )}
        </div>
    );
}

export default LiveParticipantSearch;

