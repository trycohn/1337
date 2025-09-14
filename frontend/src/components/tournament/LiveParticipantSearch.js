import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

const MIN_QUERY = 3;

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
            const { data } = await api.get(`/api/users/search?q=${encodeURIComponent(q)}&limit=20`);
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
        <div>
            <input
                type="text"
                placeholder="Поиск по пользователям (минимум 3 символа)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{background:'#000', color:'#fff', border:'1px solid #333', padding: '8px 10px', borderRadius: 6, width:'100%', marginBottom: 8}}
            />
            {loading && <div style={{fontSize:12, color:'#bbb'}}>Поиск...</div>}
            {error && <div style={{fontSize:12, color:'#f66'}}>{error}</div>}
            {!loading && results && results.length > 0 && (
                <div style={{maxHeight: 220, overflowY: 'auto', border:'1px solid #222', borderRadius: 6}}>
                    {results.map((u) => (
                        <div key={u.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', borderBottom:'1px solid #222'}}>
                            <div style={{display:'flex', alignItems:'center', gap:8}}>
                                <div style={{width:24, height:24, borderRadius:'50%', background:'#222', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff'}}>
                                    {(u.username || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{color:'#fff'}}>{u.username || `User #${u.id}`}</div>
                                    {(u.faceit_elo || u.cs2_premier_rank) && (
                                        <div style={{fontSize:12, color:'#bbb'}}>
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
                <div style={{fontSize:12, color:'#bbb'}}>Ничего не найдено</div>
            )}
        </div>
    );
}

export default LiveParticipantSearch;

