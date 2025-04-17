// notifications.js

// Функция для отправки уведомления конкретному пользователю
const sendNotification = (userId, notification) => {
  try {
    // Получаем Express приложение из глобального контекста
    const app = global.app || require('./server');
    // Получаем WebSocket сервер из приложения
    const connectedClients = app.get('connectedClients');
    
    if (!connectedClients) {
      console.error('❌ Не удалось получить карту подключенных клиентов');
      return;
    }
    
    const ws = connectedClients.get(userId);
    
    if (ws && ws.readyState === 1) { // 1 = WebSocket.OPEN
      ws.send(JSON.stringify({
        type: 'notification',
        data: notification
      }));
      console.log(`📩 Уведомление отправлено пользователю ${userId}:`, notification);
    } else {
      console.log(`⚠️ Не удалось отправить уведомление пользователю ${userId}: пользователь не подключён`);
    }
  } catch (error) {
    console.error('❌ Ошибка при отправке уведомления:', error);
  }
};

// Функция для отправки уведомления всем подключенным клиентам
const broadcastNotification = (notification) => {
  try {
    // Получаем Express приложение из глобального контекста
    const app = global.app || require('./server');
    // Получаем WebSocket сервер из приложения
    const wss = app.get('wss');
    
    if (!wss) {
      console.error('❌ Не удалось получить WebSocket сервер');
      return;
    }
    
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // 1 = WebSocket.OPEN
        client.send(JSON.stringify({
          type: 'broadcast',
          data: notification
        }));
      }
    });
    
    console.log(`📢 Широковещательное уведомление отправлено:`, notification);
  } catch (error) {
    console.error('❌ Ошибка при отправке широковещательного уведомления:', error);
  }
};

// Функция для отправки обновлений турнира всем клиентам на странице турнира
const broadcastTournamentUpdate = (tournamentId, tournamentData) => {
  try {
    // Получаем Express приложение из глобального контекста
    const app = global.app || require('./server');
    // Получаем WebSocket сервер из приложения
    const wss = app.get('wss');
    const tournamentClients = app.get('tournamentClients') || new Map();
    
    if (!wss) {
      console.error('❌ Не удалось получить WebSocket сервер');
      return;
    }
    
    // Получаем клиентов, просматривающих этот турнир
    const clients = tournamentClients.get(tournamentId) || [];
    console.log(`📊 Отправка обновления турнира ${tournamentId} для ${clients.length} клиентов`);
    
    // Отправляем всем клиентам на странице турнира
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // 1 = WebSocket.OPEN
        if (client.tournamentId === tournamentId) {
          client.send(JSON.stringify({
            type: 'tournament_update',
            tournamentId: tournamentId,
            data: tournamentData
          }));
        }
      }
    });
    
    console.log(`📢 Обновление турнира ${tournamentId} отправлено`);
  } catch (error) {
    console.error(`❌ Ошибка при отправке обновления турнира ${tournamentId}:`, error);
  }
};

module.exports = { sendNotification, broadcastNotification, broadcastTournamentUpdate };