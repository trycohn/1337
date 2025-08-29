import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../axios';
import SafeRichTextEditor from '../components/SafeRichTextEditor';
import SafeRichTextDisplay from '../components/SafeRichTextDisplay';

function TournamentRulesPage() {
    const { id } = useParams();
    const [tournament, setTournament] = useState(null);
    const [editingDescription, setEditingDescription] = useState(false);
    const [editingRules, setEditingRules] = useState(false);
    const [description, setDescription] = useState('');
    const [rules, setRules] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);

    useEffect(() => {
        let cancelled = false;
        async function loadTournament() {
            try {
                const { data } = await api.get(`/api/tournaments/${id}`);
                if (!cancelled) {
                    setTournament(data);
                    setDescription(data?.description || '');
                    setRules(data?.rules || '');
                }
            } catch (e) {
                setError(e?.response?.data?.message || 'Не удалось загрузить турнир');
            }
        }
        loadTournament();
        return () => { cancelled = true; };
    }, [id]);

    // Загружаем текущего пользователя для проверки прав
    useEffect(() => {
        let cancelled = false;
        const token = localStorage.getItem('token');
        if (!token) return;
        api.get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => { if (!cancelled) setUser(res.data); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    const isAdminOrCreator = useMemo(() => {
        if (!tournament || !user) return false;
        if (Number(user.id) === Number(tournament.created_by)) return true;
        const admins = Array.isArray(tournament.admins) ? tournament.admins : [];
        return admins.some(a => Number(a.user_id) === Number(user.id));
    }, [tournament, user]);

    async function saveDescription() {
        if (!tournament?.id) return;
        if (!isAdminOrCreator) { setEditingDescription(false); return; }
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const { data } = await api.put(
                `/api/tournaments/${tournament.id}/description`, 
                { description },
                token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
            );
            if (data?.tournament) {
                setTournament(data.tournament);
                setDescription(data.tournament.description || '');
            }
            setEditingDescription(false);
            // Перезагружаем свежие данные с сервера для уверенности
            try {
                const refreshed = await api.get(`/api/tournaments/${tournament.id}`);
                setTournament(refreshed.data);
                setDescription(refreshed.data?.description || '');
            } catch (_) {}
        } catch (e) {
            setError(e?.response?.data?.message || 'Ошибка сохранения описания');
        } finally {
            setSaving(false);
        }
    }

    async function saveRules() {
        if (!tournament?.id) return;
        if (!isAdminOrCreator) { setEditingRules(false); return; }
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const { data } = await api.put(
                `/api/tournaments/${tournament.id}/rules`, 
                { rules },
                token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
            );
            if (data?.tournament) {
                setTournament(data.tournament);
                setRules(data.tournament.rules || '');
            }
            setEditingRules(false);
            // Перезагружаем свежие данные с сервера
            try {
                const refreshed = await api.get(`/api/tournaments/${tournament.id}`);
                setTournament(refreshed.data);
                setRules(refreshed.data?.rules || '');
            } catch (_) {}
        } catch (e) {
            setError(e?.response?.data?.message || 'Ошибка сохранения регламента');
        } finally {
            setSaving(false);
        }
    }

    if (error) return <section><p className="error">{error}</p></section>;
    if (!tournament) return <section><p>Загрузка...</p></section>;

    return (
        <section className="tournament-rules-page">
            <h2>{tournament.name}: описание и регламент</h2>

            <div className="rules-section-block">
                <h3>Описание</h3>
                {isAdminOrCreator && editingDescription ? (
                    <>
                        <SafeRichTextEditor value={description} onChange={setDescription} forceSimpleEditor={true} />
                        <div style={{ marginTop: 12 }}>
                            <button className="btn btn-primary" onClick={saveDescription} disabled={saving}>
                                {saving ? 'Сохранение...' : 'Сохранить'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => setEditingDescription(false)} disabled={saving}>Отмена</button>
                        </div>
                    </>
                ) : (
                    <>
                        <SafeRichTextDisplay content={description} />
                        {isAdminOrCreator && (
                            <div style={{ marginTop: 12 }}>
                                <button className="btn btn-secondary" onClick={() => setEditingDescription(true)}>Редактировать</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="rules-section-block rules-block" style={{ marginTop: 24 }}>
                <h3>Регламент</h3>
                {isAdminOrCreator && editingRules ? (
                    <>
                        <SafeRichTextEditor value={rules} onChange={setRules} forceSimpleEditor={true} />
                        <div style={{ marginTop: 12 }}>
                            <button className="btn btn-primary" onClick={saveRules} disabled={saving}>
                                {saving ? 'Сохранение...' : 'Сохранить'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => setEditingRules(false)} disabled={saving}>Отмена</button>
                        </div>
                    </>
                ) : (
                    <>
                        <SafeRichTextDisplay content={rules} />
                        {isAdminOrCreator && (
                            <div style={{ marginTop: 12 }}>
                                <button className="btn btn-secondary" onClick={() => setEditingRules(true)}>Редактировать</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}

export default TournamentRulesPage;


