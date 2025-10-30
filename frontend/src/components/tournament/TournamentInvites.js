import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TournamentInvites.css';

/**
 * Компонент управления инвайт-ссылками для организаторов турнира
 * Только для закрытых турниров
 */
function TournamentInvites({ tournament, token }) {
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newInvite, setNewInvite] = useState({
        max_uses: '',
        expires_in_days: ''
    });
    const [copiedId, setCopiedId] = useState(null);

    useEffect(() => {
        loadInvites();
    }, [tournament.id]);

    const loadInvites = async () => {
        try {
            setLoading(true);
            const response = await axios.get(
                `${process.env.REACT_APP_API_URL}/api/tournaments/${tournament.id}/invites`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setInvites(response.data.invites || []);
        } catch (err) {
            console.error('Ошибка загрузки инвайтов:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateInvite = async () => {
        try {
            setCreating(true);
            const payload = {};
            
            if (newInvite.max_uses) {
                payload.max_uses = parseInt(newInvite.max_uses);
            }
            if (newInvite.expires_in_days) {
                payload.expires_in_days = parseInt(newInvite.expires_in_days);
            }

            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/tournaments/${tournament.id}/invites`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Добавляем новый инвайт в список
            setInvites([response.data.invite, ...invites]);
            
            // Сбрасываем форму
            setNewInvite({ max_uses: '', expires_in_days: '' });
            setShowCreateForm(false);
            
            alert('✅ Инвайт-ссылка создана!');
        } catch (err) {
            console.error('Ошибка создания инвайта:', err);
            alert(err.response?.data?.error || 'Не удалось создать инвайт-ссылку');
        } finally {
            setCreating(false);
        }
    };

    const copyInviteLink = (inviteCode, inviteId) => {
        const baseUrl = process.env.REACT_APP_PUBLIC_URL || window.location.origin;
        const inviteUrl = `${baseUrl}/tournaments/invite/${inviteCode}`;
        
        navigator.clipboard.writeText(inviteUrl).then(() => {
            setCopiedId(inviteId);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const handleDeactivate = async (inviteId) => {
        if (!window.confirm('Деактивировать эту ссылку?')) return;

        try {
            await axios.put(
                `${process.env.REACT_APP_API_URL}/api/tournaments/${tournament.id}/invites/${inviteId}/deactivate`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Обновляем список
            setInvites(invites.map(inv => 
                inv.id === inviteId ? { ...inv, is_active: false } : inv
            ));
            
            alert('✅ Ссылка деактивирована');
        } catch (err) {
            console.error('Ошибка деактивации:', err);
            alert('Не удалось деактивировать ссылку');
        }
    };

    const handleDelete = async (inviteId) => {
        if (!window.confirm('Удалить эту ссылку?')) return;

        try {
            await axios.delete(
                `${process.env.REACT_APP_API_URL}/api/tournaments/${tournament.id}/invites/${inviteId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Убираем из списка
            setInvites(invites.filter(inv => inv.id !== inviteId));
            
            alert('✅ Ссылка удалена');
        } catch (err) {
            console.error('Ошибка удаления:', err);
            alert('Не удалось удалить ссылку');
        }
    };

    if (loading) {
        return (
            <div className="tournament-invites">
                <h3>🔗 Инвайт-ссылки</h3>
                <div className="loading">Загрузка...</div>
            </div>
        );
    }

    return (
        <div className="tournament-invites">
            <div className="invites-header">
                <h3>🔗 Инвайт-ссылки</h3>
                <button 
                    className="btn-create-invite"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                >
                    {showCreateForm ? '✕ Отмена' : '➕ Создать ссылку'}
                </button>
            </div>

            {/* Форма создания */}
            {showCreateForm && (
                <div className="create-invite-form">
                    <div className="form-row">
                        <div className="form-field">
                            <label>Макс. использований (опционально)</label>
                            <input
                                type="number"
                                placeholder="Неограниченно"
                                value={newInvite.max_uses}
                                onChange={(e) => setNewInvite({ ...newInvite, max_uses: e.target.value })}
                                min="1"
                            />
                        </div>
                        <div className="form-field">
                            <label>Срок действия (дней)</label>
                            <input
                                type="number"
                                placeholder="Бессрочно"
                                value={newInvite.expires_in_days}
                                onChange={(e) => setNewInvite({ ...newInvite, expires_in_days: e.target.value })}
                                min="1"
                            />
                        </div>
                    </div>
                    <button 
                        className="btn-create"
                        onClick={handleCreateInvite}
                        disabled={creating}
                    >
                        {creating ? 'Создание...' : 'Создать'}
                    </button>
                </div>
            )}

            {/* Список инвайтов */}
            {invites.length === 0 ? (
                <div className="empty-state">
                    <p>Нет созданных ссылок</p>
                    <p className="hint">Создайте инвайт-ссылку, чтобы пригласить участников</p>
                </div>
            ) : (
                <div className="invites-list">
                    {invites.map(invite => (
                        <div 
                            key={invite.id} 
                            className={`invite-item ${!invite.is_active ? 'inactive' : ''}`}
                        >
                            <div className="invite-info">
                                <div className="invite-code">
                                    <span className="code-label">Код:</span>
                                    <code>{invite.invite_code}</code>
                                    {!invite.is_active && (
                                        <span className="inactive-badge">Неактивна</span>
                                    )}
                                </div>
                                
                                <div className="invite-stats">
                                    <span className="stat">
                                        📊 Использовано: {invite.current_uses}
                                        {invite.max_uses ? ` / ${invite.max_uses}` : ' / ∞'}
                                    </span>
                                    {invite.expires_at && (
                                        <span className="stat">
                                            ⏰ Истекает: {new Date(invite.expires_at).toLocaleDateString('ru-RU')}
                                        </span>
                                    )}
                                    <span className="stat">
                                        👤 Создал: {invite.creator_username}
                                    </span>
                                </div>
                            </div>

                            <div className="invite-actions">
                                <button
                                    className={`btn-copy ${copiedId === invite.id ? 'copied' : ''}`}
                                    onClick={() => copyInviteLink(invite.invite_code, invite.id)}
                                    disabled={!invite.is_active}
                                >
                                    {copiedId === invite.id ? '✓ Скопировано' : '📋 Копировать'}
                                </button>
                                
                                {invite.is_active && (
                                    <button
                                        className="btn-deactivate"
                                        onClick={() => handleDeactivate(invite.id)}
                                    >
                                        🔒 Деактивировать
                                    </button>
                                )}
                                
                                <button
                                    className="btn-delete"
                                    onClick={() => handleDelete(invite.id)}
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default TournamentInvites;

