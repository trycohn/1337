import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Home.css';

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const wsRef = useRef(null);

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
                  axios.get(`/api/notifications?userId=${userId}&includeProcessed=true`, {
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  .then(res => setNotifications(res.data))
                  .catch(err => console.error('Ошибка получения уведомлений:', err));
                } else {
                  // Добавляем новое уведомление в список
                  setNotifications((prev) => [data.data, ...prev]);
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
          axios
            .get(`/api/notifications?userId=${userId}&includeProcessed=true`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .then((res) => setNotifications(res.data))
            .catch((err) => setError(err.response?.data?.error || 'Ошибка загрузки уведомлений'));
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
      const response2 = await axios.get(`/api/notifications?userId=${notification.user_id}&includeProcessed=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(response2.data);
      
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

      // Отмечаем уведомление как прочитанное
      await axios.post(
        `/api/notifications/mark-read?userId=${notification.user_id}&notificationId=${notification.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Получаем обновленный список уведомлений
      const notificationsResponse = await axios.get(`/api/notifications?userId=${notification.user_id}&includeProcessed=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(notificationsResponse.data);
      
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

      // Отмечаем уведомление как прочитанное
      await axios.post(
        `/api/notifications/mark-read?userId=${notification.user_id}&notificationId=${notification.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Получаем обновленный список уведомлений
      const notificationsResponse = await axios.get(`/api/notifications?userId=${notification.user_id}&includeProcessed=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(notificationsResponse.data);
      
      alert('Заявка в друзья отклонена');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при обработке заявки в друзья');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <section className="notifications-page">
      <h2>История уведомлений</h2>
      {error && <p className="error">{error}</p>}
      {notifications.length > 0 ? (
        <div className="notification-list">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${notification.is_read ? '' : 'unread'}`}
            >
              {notification.message ? (
                <>
                  {notification.type === 'admin_request' && notification.tournament_id && notification.requester_id ? (
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
                      </div>
                    </>
                  ) : notification.type === 'friend_request_accepted' && notification.requester_id ? (
                    <>
                      {notification.message} - {new Date(notification.created_at).toLocaleString('ru-RU')}
                      <div className="friend-request-status">
                        <span className="status-accepted">Заявка принята</span>
                        <Link to={`/profile/${notification.requester_id}`} className="view-profile-link">
                          Посмотреть профиль
                        </Link>
                      </div>
                    </>
                  ) : notification.tournament_id ? (
                    <>
                      {notification.message.split(' турнира ')[0]} турнира{' '}
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
                </>
              ) : (
                <>Неизвестное уведомление - {new Date(notification.created_at).toLocaleString('ru-RU')}</>
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