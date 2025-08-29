import { useEffect, useState } from 'react';
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

    async function saveDescription() {
        if (!tournament?.id) return;
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
                {editingDescription ? (
                    <>
                        <SafeRichTextEditor value={description} onChange={setDescription} />
                        <div style={{ marginTop: 12 }}>
                            <button className="btn btn-primary" onClick={saveDescription} disabled={saving}>
                                {saving ? 'Сохранение...' : 'Сохранить'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => setEditingDescription(false)} disabled={saving}>Отмена</button>
                        </div>
                    </>
                ) : (
                    <>
                        <SafeRichTextDisplay htmlContent={description} />
                        <div style={{ marginTop: 12 }}>
                            <button className="btn btn-secondary" onClick={() => setEditingDescription(true)}>Редактировать</button>
                        </div>
                    </>
                )}
            </div>

            <div className="rules-section-block rules-block" style={{ marginTop: 24 }}>
                <h3>Регламент</h3>
                {editingRules ? (
                    <>
                        <SafeRichTextEditor value={rules} onChange={setRules} />
                        <div style={{ marginTop: 12 }}>
                            <button className="btn btn-primary" onClick={saveRules} disabled={saving}>
                                {saving ? 'Сохранение...' : 'Сохранить'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => setEditingRules(false)} disabled={saving}>Отмена</button>
                        </div>
                    </>
                ) : (
                    <>
                        <SafeRichTextDisplay htmlContent={rules} />
                        <div style={{ marginTop: 12 }}>
                            <button className="btn btn-secondary" onClick={() => setEditingRules(true)}>Редактировать</button>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}

export default TournamentRulesPage;


