import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Home.css';
import { isCurrentUser } from '../utils/userHelpers';
import InvitationNotification from './InvitationNotification';

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [friendshipStatuses, setFriendshipStatuses] = useState({});
  const wsRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios
        .get('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          const userId = response.data.id;
          
          // Создаем WebSocket соединение
          const wsUrl = (process.env.REACT_APP_API_URL || 'http://localhost:3000').replace(/^http/, 'ws');
          const webSocket = new WebSocket(`${wsUrl}/ws`);
          
          webSocket.onopen = () => {
            console.log('WebSocket соединение установлено в компоненте Notifications');
            // После установления соединения отправляем идентификатор пользователя
            webSocket.send(JSON.stringify({
              type: 'register',
              userId: userId
            }));
          };
          
          webSocket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'notification') {
                console.log('Получено новое уведомление в Notifications:', data.data);
                if (data.data.type === 'admin_request_accepted' || data.data.type === 'admin_request_rejected' || 
                    data.data.type === 'friend_request_accepted') {
                  // Обновить список уведомлений при получении ответа на запрос администрирования или заявку в друзья
                  fetchNotifications(userId, token);
                } else {
                  // Добавляем новое уведомление в список
                  setNotifications((prev) => [data.data, ...prev]);
                  // Если это заявка в друзья, обновляем статусы дружбы
                  if (data.data.type === 'friend_request' && data.data.requester_id) {
                    fetchFriendshipStatus(data.data.requester_id, token);
                  }
                }
              }
            } catch (error) {
              console.error('Ошибка при обработке сообщения WebSocket:', error);
            }
          };
          
          webSocket.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
          };
          
          webSocket.onclose = () => {
            console.log('WebSocket соединение закрыто');
          };
          
          // Сохраняем ссылку на WebSocket
          wsRef.current = webSocket;
          
          // Получаем существующие уведомления
          fetchNotifications(userId, token);
        })
        .catch((err) => setError(err.response?.data?.error || 'Ошибка загрузки пользователя'));
    }
    
    // Закрываем WebSocket соединение при размонтировании компонента
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Функция для получения уведомлений
  const fetchNotifications = async (userId, token) => {
    try {
      const res = await axios.get(`/api/notifications?userId=${userId}&includeProcessed=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setNotifications(res.data);
      
      // Для всех уведомлений типа friend_request получаем актуальный статус дружбы
      const friendRequests = res.data.filter(n => n.type === 'friend_request' && n.requester_id);
      
      for (const request of friendRequests) {
        fetchFriendshipStatus(request.requester_id, token);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка загрузки уведомлений');
    } finally {
      setLoading(false);
    }
  };

  // Функция для получения статуса дружбы с конкретным пользователем
  const fetchFriendshipStatus = async (userId, token) => {
    try {
      const response = await axios.get(`/api/friends/status/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setFriendshipStatuses(prev => ({
        ...prev,
        [userId]: response.data
      }));
    } catch (err) {
      console.error('Ошибка получения статуса дружбы:', err);
    }
  };

  const handleRespondAdminRequest = async (notification, action) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.post(
        `/api/tournaments/${notification.tournament_id}/respond-admin-request`,
        { requesterId: notification.requester_id, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Отмечаем уведомление как прочитанное
      await axios.post(
        `/api/notifications/mark-read?userId=${notification.user_id}&notificationId=${notification.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Получаем обновленный список уведомлений
      fetchNotifications(notification.user_id, token);
      
      alert(response.data.message);
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при обработке запроса');
    }
  };

  // Функция для обработки принятия заявки в друзья
  const handleAcceptFriendRequest = async (notification) => {
    const token = localStorage.getItem('token');
    setActionLoading(notification.id);
    try {
      // Получаем ID заявки в друзья из базы данных
      const friendsResponse = await axios.get(`/api/friends/requests/incoming`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const friendRequest = friendsResponse.data.find(req => req.userId === notification.requester_id);
      
      if (!friendRequest) {
        alert('Заявка в друзья не найдена или уже обработана');
        return;
      }

      // Принимаем заявку
      await axios.post('/api/friends/accept', { requestId: friendRequest.id }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Отмечаем уведомление как прочитанное только после принятия
      await axios.post(
        `/api/notifications/mark-read?userId=${notification.user_id}&notificationId=${notification.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Обновляем статус дружбы после принятия заявки
      await fetchFriendshipStatus(notification.requester_id, token);
      
      // Получаем обновленный список уведомлений
      fetchNotifications(notification.user_id, token);
      
      alert('Заявка в друзья принята');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при обработке заявки в друзья');
    } finally {
      setActionLoading(null);
    }
  };

  // Функция для обработки отклонения заявки в друзья
  const handleRejectFriendRequest = async (notification) => {
    const token = localStorage.getItem('token');
    setActionLoading(notification.id);
    try {
      // Получаем ID заявки в друзья из базы данных
      const friendsResponse = await axios.get(`/api/friends/requests/incoming`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const friendRequest = friendsResponse.data.find(req => req.userId === notification.requester_id);
      
      if (!friendRequest) {
        alert('Заявка в друзья не найдена или уже обработана');
        return;
      }

      // Отклоняем заявку
      await axios.post('/api/friends/reject', { requestId: friendRequest.id }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Отмечаем уведомление как прочитанное только после отклонения
      await axios.post(
        `/api/notifications/mark-read?userId=${notification.user_id}&notificationId=${notification.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Обновляем статус дружбы после отклонения заявки
      await fetchFriendshipStatus(notification.requester_id, token);
      
      // Получаем обновленный список уведомлений
      fetchNotifications(notification.user_id, token);
      
      alert('Заявка в друзья отклонена');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при обработке заявки в друзья');
    } finally {
      setActionLoading(null);
    }
  };

  // Функция для проверки, является ли заявка в друзья уже принятой
  const isFriendRequestAccepted = (requesterId) => {
    return friendshipStatuses[requesterId]?.status === 'accepted';
  };

  // Функция для проверки, является ли заявка в друзья отклоненной или обработанной
  const isFriendRequestProcessed = (requesterId) => {
    return !!friendshipStatuses[requesterId] && friendshipStatuses[requesterId].status !== 'pending';
  };

  const handleInvitationResponse = async (invitationId, action) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.post(
        `/api/tournaments/${invitationId}/handle-invitation`,
        { action, invitation_id: invitationId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Отмечаем уведомление как прочитанное только после ответа
      await axios.post(
        `/api/notifications/mark-read?userId=${user.id}&notificationId=${invitationId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Обновляем список уведомлений
      setNotifications(notifications.filter(n => n.invitation_id !== invitationId));
    } catch (err) {
      setError('Ошибка при обработке приглашения');
    }
  };

  if (loading) return <div>Загрузка уведомлений...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <section className="notifications-page">
      <h2>История уведомлений</h2>
      {notifications.length > 0 ? (
        <div className="notification-list">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${notification.is_read ? '' : 'unread'}`}
            >
              {notification.type === 'tournament_invite' ? (
                <InvitationNotification
                  notification={notification}
                  onAccept={() => handleInvitationResponse(notification.invitation_id, 'accept')}
                  onReject={() => handleInvitationResponse(notification.invitation_id, 'reject')}
                />
              ) : notification.type === 'admin_request' && notification.tournament_id && notification.requester_id ? (
                <>
                  {notification.message.split(' для турнира ')[0]} для турнира{' '}
                  <Link to={`/tournaments/${notification.tournament_id}`}>
                    "{notification.message.split(' для турнира ')[1]?.split('"')[1] || 'турнир'}"
                  </Link>{' '}
                  - {new Date(notification.created_at).toLocaleString('ru-RU')}
                  <div className="admin-request-status">
                    {notification.request_status === 'pending' || !notification.request_status ? (
                      <>
                        <span className="status-pending">В ожидании</span>
                        <div className="admin-request-actions">
                          <button onClick={() => handleRespondAdminRequest(notification, 'accept')}>
                            Принять
                          </button>
                          <button onClick={() => handleRespondAdminRequest(notification, 'reject')}>
                            Отклонить
                          </button>
                        </div>
                      </>
                    ) : notification.request_status === 'accepted' ? (
                      <span className="status-accepted">Запрос принят</span>
                    ) : (
                      <span className="status-rejected">Запрос отклонен</span>
                    )}
                  </div>
                </>
              ) : notification.type === 'admin_request_accepted' && notification.tournament_id ? (
                <>
                  {notification.message} - {new Date(notification.created_at).toLocaleString('ru-RU')}
                  <div className="admin-request-status">
                    <span className="status-accepted">Запрос принят</span>
                  </div>
                </>
              ) : notification.type === 'admin_request_rejected' && notification.tournament_id ? (
                <>
                  {notification.message} - {new Date(notification.created_at).toLocaleString('ru-RU')}
                  <div className="admin-request-status">
                    <span className="status-rejected">Запрос отклонен</span>
                  </div>
                </>
              ) : notification.type === 'friend_request' && notification.requester_id ? (
                <>
                  {notification.message} - {new Date(notification.created_at).toLocaleString('ru-RU')}
                  <div className="friend-request-status">
                    {isFriendRequestAccepted(notification.requester_id) ? (
                      <>
                        <span className="status-accepted">Заявка принята</span>
                        <Link to={isCurrentUser(notification.requester_id) ? "/profile" : `/user/${notification.requester_id}`} className="view-profile-link">
                          Посмотреть профиль
                        </Link>
                      </>
                    ) : isFriendRequestProcessed(notification.requester_id) ? (
                      <span className="status-rejected">Заявка отклонена</span>
                    ) : (
                      <>
                        <span className="status-pending">В ожидании</span>
                        <div className="friend-request-actions">
                          <button 
                            onClick={() => handleAcceptFriendRequest(notification)}
                            disabled={actionLoading === notification.id}
                          >
                            {actionLoading === notification.id ? 'Обработка...' : 'Принять'}
                          </button>
                          <button 
                            onClick={() => handleRejectFriendRequest(notification)}
                            disabled={actionLoading === notification.id}
                          >
                            {actionLoading === notification.id ? 'Обработка...' : 'Отклонить'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : notification.type === 'friend_request_accepted' && notification.requester_id ? (
                <>
                  {notification.message} - {new Date(notification.created_at).toLocaleString('ru-RU')}
                  <div className="friend-request-status">
                    <span className="status-accepted">Заявка принята</span>
                    <Link to={isCurrentUser(notification.requester_id) ? "/profile" : `/user/${notification.requester_id}`} className="view-profile-link">
                      Посмотреть профиль
                    </Link>
                  </div>
                </>
              ) : notification.tournament_id ? (
                <>
                  {notification.message.split(' турнира ')[0]} турниров{' '}
                  <Link to={`/tournaments/${notification.tournament_id}`}>
                    "{notification.message.split(' турнира ')[1]?.split('"')[1] || 'турнир'}"
                  </Link>{' '}
                  - {new Date(notification.created_at).toLocaleString('ru-RU')}
                </>
              ) : (
                <>
                  {notification.message} - {new Date(notification.created_at).toLocaleString('ru-RU')}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p>Уведомлений пока нет</p>
      )}
    </section>
  );
}

export default Notifications;