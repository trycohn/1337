# ✅ Реализация устаревания лобби и повторной отправки приглашений

## 📋 Что сделано

### Backend:

1. **MatchLobbyService.js** - добавлены методы:
   - `isLobbyExpired(lobby)` - проверка устаревания (> 1 час)
   - `getUserActiveLobbyInTournament(userId, tournamentId)` - получение активного лобби пользователя
   - `resendLobbyInvitations(lobbyId, io)` - повторная отправка приглашений

2. **MatchLobbyController.js** - добавлены контроллеры:
   - `resendLobbyInvitations` - endpoint для повторной отправки
   - `getUserActiveLobby` - endpoint для получения активного лобби
   - Обновлен `getLobbyInfo` - возвращает 410 статус для устаревших лобби

3. **Routes (backend/routes/tournament/index.js)** - добавлены роуты:
   - `POST /api/tournaments/:tournamentId/lobby/:lobbyId/resend-invites`
   - `GET /api/tournaments/:tournamentId/my-active-lobby`

### Frontend:

1. **useTournamentLobby.js** - добавлена обработка 410 статуса (лобби устарело)

2. **ActiveLobbyWidget.js** - новый компонент виджета активного лобби:
   - Показывает баннер если у пользователя есть активное лобби
   - Кнопка быстрого перехода в лобби
   - Предупреждение об устаревших лобби

3. **TournamentAdminPanel.js** - добавлен блок активных лобби:
   - Список активных лобби с кнопкой "Переслать приглашения"
   - Стили для новых элементов

## 🔧 Что нужно завершить вручную

### В файле `frontend/src/components/TournamentDetails.js`:

1. Добавить функцию (после `handleCreateMatchLobby`):

```javascript
// 📨 Повторная отправка приглашений в лобби
const handleResendLobbyInvites = useCallback(async (lobbyId) => {
    try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('Отсутствует токен авторизации');
        }
        
        console.log('📨 Пересылаем приглашения в лобби:', lobbyId);
        
        const response = await api.post(
            `/api/tournaments/${id}/lobby/${lobbyId}/resend-invites`,
            {},
            {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Приглашения отправлены:', response.data);
        
        setMessage(response.data.message || 'Приглашения успешно отправлены!');
        
    } catch (error) {
        console.error('❌ Ошибка отправки приглашений:', error);
        
        let errorMessage = 'Ошибка при отправке приглашений';
        
        if (error.response?.status === 403) {
            errorMessage = 'У вас нет прав для управления лобби';
        } else if (error.response?.data?.error) {
            errorMessage = error.response.data.error;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        setMessage(`${errorMessage}`);
    } finally {
        setLoading(false);
        setTimeout(() => setMessage(''), 5000);
    }
}, [id]);
```

2. Добавить проп в `TournamentAdminPanel` (строка ~1431):

```javascript
onResendLobbyInvites={handleResendLobbyInvites}
```

3. Добавить виджет `ActiveLobbyWidget` после заголовка турнира (строка ~700):

```javascript
{/* Виджет активного лобби */}
{user && <ActiveLobbyWidget tournamentId={id} user={user} />}
```

## 📊 Как работает

1. **Устаревание лобби**:
   - Лобби устаревает через 1 час после создания
   - При попытке войти в устаревшее лобби - показывается ошибка
   - В виджете отображается предупреждение

2. **Повторная отправка приглашений**:
   - Админ видит список активных лобби в админ-панели
   - Кнопка "📨 Переслать приглашения" для каждого лобби
   - Участники получают новое уведомление через WebSocket + БД

3. **Виджет активного лобби**:
   - Автоматически проверяет наличие активного лобби при входе в турнир
   - Кнопка быстрого входа в лобби
   - Предупреждение если лобби устарело

## 🚀 Деплой

```bash
# Коммит изменений
git add .
git commit -m "Добавлена система устаревания лобби и повторной отправки приглашений"
git push origin main

# На сервере
ssh root@80.87.200.23
cd /var/www/1337community.com/
git pull origin main
pm2 restart 1337-backend
```

## ✅ Преимущества

- ✅ Нет клонирования лобби - одно лобби на матч
- ✅ Участники могут вернуться в лобби через виджет
- ✅ Админ может переслать приглашения если кто-то потерял ссылку
- ✅ Устаревшие лобби (> 1 час) автоматически блокируются
- ✅ Минимум изменений в коде

