import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axios';
import './AdminPanel.css';
import { ensureHttps } from '../utils/userHelpers';

function AdminPanel() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState([]);
    const [stats, setStats] = useState({});
    const [activeTab, setActiveTab] = useState('requests');
    const [statusFilter, setStatusFilter] = useState('pending');
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Состояния для модалок действий
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [actionData, setActionData] = useState({
        contact_email: '',
        contact_phone: '',
        admin_comment: ''
    });

    const checkAdminAccess = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/auth');
                return;
            }

            const response = await api.get('/api/users/me', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.role !== 'admin') {
                navigate('/');
                return;
            }

            setUser(response.data);
        } catch (err) {
            console.error('Ошибка проверки доступа:', err);
            navigate('/auth');
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    const fetchRequests = useCallback(async () => {
        try {
            const response = await api.get(`/api/admin/organization-requests?status=${statusFilter}&page=${pagination.page}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setRequests(response.data.requests);
            setPagination(response.data.pagination);
        } catch (err) {
            console.error('Ошибка загрузки заявок:', err);
        }
    }, [statusFilter, pagination.page]);

    const fetchStats = useCallback(async () => {
        try {
            const response = await api.get('/api/admin/stats', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setStats(response.data);
        } catch (err) {
            console.error('Ошибка загрузки статистики:', err);
        }
    }, []);

    useEffect(() => {
        checkAdminAccess();
    }, [checkAdminAccess]);

    useEffect(() => {
        if (user && user.role === 'admin') {
            fetchRequests();
            fetchStats();
        }
    }, [user, fetchRequests, fetchStats]);

    const fetchRequestDetails = async (requestId) => {
        try {
            const response = await api.get(`/api/admin/organization-requests/${requestId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setSelectedRequest(response.data);
            setShowRequestModal(true);
        } catch (err) {
            console.error('Ошибка загрузки деталей заявки:', err);
        }
    };

    const handleApprove = async () => {
        if (!selectedRequest) return;

        setActionLoading(true);
        try {
            await api.post(`/api/admin/organization-requests/${selectedRequest.id}/approve`, actionData, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            setShowApproveModal(false);
            setShowRequestModal(false);
            setActionData({ contact_email: '', contact_phone: '', admin_comment: '' });
            fetchRequests();
            fetchStats();
        } catch (err) {
            console.error('Ошибка одобрения заявки:', err);
            alert('Ошибка при одобрении заявки');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selectedRequest || !actionData.admin_comment.trim()) {
            alert('Комментарий обязателен при отклонении заявки');
            return;
        }

        setActionLoading(true);
        try {
            await api.post(`/api/admin/organization-requests/${selectedRequest.id}/reject`, {
                admin_comment: actionData.admin_comment
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            setShowRejectModal(false);
            setShowRequestModal(false);
            setActionData({ contact_email: '', contact_phone: '', admin_comment: '' });
            fetchRequests();
            fetchStats();
        } catch (err) {
            console.error('Ошибка отклонения заявки:', err);
            alert('Ошибка при отклонении заявки');
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'pending': return 'status-pending';
            case 'approved': return 'status-approved';
            case 'rejected': return 'status-rejected';
            default: return '';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return 'На рассмотрении';
            case 'approved': return 'Одобрена';
            case 'rejected': return 'Отклонена';
            default: return status;
        }
    };

    if (loading) {
        return <div className="admin-loading">Загрузка...</div>;
    }

    if (!user || user.role !== 'admin') {
        return <div className="admin-error">Доступ запрещен</div>;
    }

    return (
        <div className="admin-panel">
            <div className="admin-header">
                <h1>Административная панель</h1>
                <p>Добро пожаловать, {user.username}!</p>
            </div>

            {/* Навигация */}
            <div className="admin-navigation">
                <button 
                    className={`nav-tab ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stats')}
                >
                    Статистика
                </button>
                <button 
                    className={`nav-tab ${activeTab === 'requests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('requests')}
                >
                    Заявки на организации
                </button>
            </div>

            {/* Содержимое вкладок */}
            {activeTab === 'stats' && (
                <div className="stats-tab">
                    <h2>Статистика платформы</h2>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">{stats.users?.total_users || 0}</div>
                            <div className="stat-label">Всего пользователей</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.users?.admin_users || 0}</div>
                            <div className="stat-label">Администраторов</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.organizers?.total_organizers || 0}</div>
                            <div className="stat-label">Организаций</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.tournaments?.total_tournaments || 0}</div>
                            <div className="stat-label">Турниров</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.requests?.pending || 0}</div>
                            <div className="stat-label">Заявок на рассмотрении</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.requests?.approved || 0}</div>
                            <div className="stat-label">Одобренных заявок</div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'requests' && (
                <div className="requests-tab">
                    <div className="requests-header">
                        <h2>Заявки на создание организаций</h2>
                        <div className="requests-filters">
                            <select 
                                value={statusFilter} 
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="status-filter"
                            >
                                <option value="all">Все заявки</option>
                                <option value="pending">На рассмотрении</option>
                                <option value="approved">Одобренные</option>
                                <option value="rejected">Отклоненные</option>
                            </select>
                        </div>
                    </div>

                    <div className="requests-list">
                        {requests.length > 0 ? (
                            requests.map(request => (
                                <div key={request.id} className="request-card">
                                    <div className="request-header">
                                        <div className="request-info">
                                            <h3>{request.organization_name}</h3>
                                            <p className="request-user">
                                                От: <span>{request.username}</span> ({request.email})
                                            </p>
                                            <p className="request-date">
                                                {formatDate(request.created_at)}
                                            </p>
                                        </div>
                                        <div className="request-status">
                                            <span className={`status-badge ${getStatusClass(request.status)}`}>
                                                {getStatusText(request.status)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="request-description">
                                        <p>{request.description.length > 150 
                                            ? request.description.substring(0, 150) + '...' 
                                            : request.description}
                                        </p>
                                    </div>

                                    <div className="request-actions">
                                        <button 
                                            className="view-details-btn"
                                            onClick={() => fetchRequestDetails(request.id)}
                                        >
                                            Подробнее
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="no-requests">Заявки не найдены</div>
                        )}
                    </div>

                    {/* Пагинация */}
                    {pagination.pages > 1 && (
                        <div className="pagination">
                            <button 
                                disabled={pagination.page === 1}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            >
                                Назад
                            </button>
                            <span>Страница {pagination.page} из {pagination.pages}</span>
                            <button 
                                disabled={pagination.page === pagination.pages}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            >
                                Далее
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Модальное окно деталей заявки */}
            {showRequestModal && selectedRequest && (
                <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
                    <div className="modal-content request-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Заявка на создание организации</h3>
                            <button 
                                className="close-btn"
                                onClick={() => setShowRequestModal(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="request-details">
                            <div className="detail-section">
                                <h4>Информация о заявителе</h4>
                                <div className="user-info">
                                    <img 
                                        src={ensureHttps(selectedRequest.avatar_url) || '/default-avatar.png'}
                                        alt={selectedRequest.username}
                                        className="user-avatar"
                                    />
                                    <div>
                                        <p><strong>Никнейм:</strong> {selectedRequest.username}</p>
                                        <p><strong>Email:</strong> {selectedRequest.email}</p>
                                        <p><strong>ID пользователя:</strong> {selectedRequest.user_id}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h4>Данные организации</h4>
                                <p><strong>Название:</strong> {selectedRequest.organization_name}</p>
                                <p><strong>Описание:</strong></p>
                                <div className="description-box">{selectedRequest.description}</div>
                                
                                {selectedRequest.website_url && (
                                    <p><strong>Сайт:</strong> <a href={ensureHttps(selectedRequest.website_url)} target="_blank" rel="noopener noreferrer">{selectedRequest.website_url}</a></p>
                                )}
                                {selectedRequest.vk_url && (
                                    <p><strong>VK:</strong> <a href={ensureHttps(selectedRequest.vk_url)} target="_blank" rel="noopener noreferrer">{selectedRequest.vk_url}</a></p>
                                )}
                                {selectedRequest.telegram_url && (
                                    <p><strong>Telegram:</strong> <a href={ensureHttps(selectedRequest.telegram_url)} target="_blank" rel="noopener noreferrer">{selectedRequest.telegram_url}</a></p>
                                )}
                                
                                {selectedRequest.logo_url && (
                                    <div className="logo-section">
                                        <p><strong>Логотип:</strong></p>
                                        <img 
                                            src={ensureHttps(selectedRequest.logo_url)}
                                            alt="Логотип организации"
                                            className="organization-logo"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="detail-section">
                                <p><strong>Дата подачи:</strong> {formatDate(selectedRequest.created_at)}</p>
                                <p><strong>Статус:</strong> <span className={`status-badge ${getStatusClass(selectedRequest.status)}`}>{getStatusText(selectedRequest.status)}</span></p>
                                
                                {selectedRequest.reviewed_by_username && (
                                    <>
                                        <p><strong>Рассмотрена:</strong> {selectedRequest.reviewed_by_username}</p>
                                        <p><strong>Дата рассмотрения:</strong> {formatDate(selectedRequest.reviewed_at)}</p>
                                    </>
                                )}
                                
                                {selectedRequest.admin_comment && (
                                    <div className="admin-comment">
                                        <p><strong>Комментарий администратора:</strong></p>
                                        <div className="comment-box">{selectedRequest.admin_comment}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedRequest.status === 'pending' && (
                            <div className="modal-actions">
                                <button 
                                    className="approve-btn"
                                    onClick={() => setShowApproveModal(true)}
                                >
                                    Одобрить
                                </button>
                                <button 
                                    className="reject-btn"
                                    onClick={() => setShowRejectModal(true)}
                                >
                                    Отклонить
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Модальное окно одобрения */}
            {showApproveModal && (
                <div className="modal-overlay">
                    <div className="modal-content action-modal">
                        <h3>Одобрение заявки</h3>
                        <p>Вы уверены, что хотите одобрить заявку на создание организации "{selectedRequest?.organization_name}"?</p>
                        
                        <div className="form-group">
                            <label>Контактный email (необязательно):</label>
                            <input 
                                type="email"
                                value={actionData.contact_email}
                                onChange={(e) => setActionData(prev => ({ ...prev, contact_email: e.target.value }))}
                                placeholder="Оставьте пустым для использования email заявителя"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Контактный телефон (необязательно):</label>
                            <input 
                                type="tel"
                                value={actionData.contact_phone}
                                onChange={(e) => setActionData(prev => ({ ...prev, contact_phone: e.target.value }))}
                                placeholder="+7 (900) 123-45-67"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Комментарий (необязательно):</label>
                            <textarea 
                                value={actionData.admin_comment}
                                onChange={(e) => setActionData(prev => ({ ...prev, admin_comment: e.target.value }))}
                                placeholder="Дополнительные комментарии или инструкции..."
                                rows="3"
                            />
                        </div>
                        
                        <div className="modal-actions">
                            <button 
                                className="confirm-btn"
                                onClick={handleApprove}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Обработка...' : 'Одобрить'}
                            </button>
                            <button 
                                className="cancel-btn"
                                onClick={() => setShowApproveModal(false)}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно отклонения */}
            {showRejectModal && (
                <div className="modal-overlay">
                    <div className="modal-content action-modal">
                        <h3>Отклонение заявки</h3>
                        <p>Укажите причину отклонения заявки на создание организации "{selectedRequest?.organization_name}":</p>
                        
                        <div className="form-group">
                            <label>Причина отклонения <span className="required">*</span>:</label>
                            <textarea 
                                value={actionData.admin_comment}
                                onChange={(e) => setActionData(prev => ({ ...prev, admin_comment: e.target.value }))}
                                placeholder="Укажите подробную причину отклонения заявки..."
                                rows="4"
                                required
                            />
                        </div>
                        
                        <div className="modal-actions">
                            <button 
                                className="confirm-btn reject-confirm"
                                onClick={handleReject}
                                disabled={actionLoading || !actionData.admin_comment.trim()}
                            >
                                {actionLoading ? 'Обработка...' : 'Отклонить'}
                            </button>
                            <button 
                                className="cancel-btn"
                                onClick={() => setShowRejectModal(false)}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPanel; 