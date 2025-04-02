import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Home.css';

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios
        .get('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          const userId = response.data.id;
          axios
            .get(`/api/notifications?userId=${userId}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .then((res) => setNotifications(res.data))
            .catch((err) => setError(err.response?.data?.error || 'Ошибка загрузки уведомлений'));
        })
        .catch((err) => setError(err.response?.data?.error || 'Ошибка загрузки пользователя'));
    }
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
        `/api/notifications/mark-read?userId=${notification.user_id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)).filter((n) => n.id !== notification.id)
      );
      alert(response.data.message);
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при обработке запроса');
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
                      {!notification.is_read && (
                        <div className="admin-request-actions">
                          <button onClick={() => handleRespondAdminRequest(notification, 'accept')}>
                            Принять
                          </button>
                          <button onClick={() => handleRespondAdminRequest(notification, 'reject')}>
                            Отклонить
                          </button>
                        </div>
                      )}
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