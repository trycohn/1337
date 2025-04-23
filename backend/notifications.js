// notifications.js

// Функция для отправки уведомления конкретному пользователю
const sendNotification = (userId, notification) => {
  try {
    const app = global.app || require('./server');
    const io = app.get('io');
    if (!io) {
      console.error('❌ socket.io instance not found');
      return;
    }
    io.to(`user_${userId}`).emit('notification', notification);
    console.log(`📩 Уведомление отправлено пользователю ${userId}:`, notification);
  } catch (error) {
    console.error('❌ Ошибка при отправке уведомления через Socket.IO:', error);
  }
};

// Функция для отправки уведомления всем подключенным клиентам
const broadcastNotification = (notification) => {
  try {
    const app = global.app || require('./server');
    const io = app.get('io');
    if (!io) {
      console.error('❌ socket.io instance not found');
      return;
    }
    io.emit('broadcast', notification);
    console.log(`📢 Широковещательное уведомление отправлено:`, notification);
  } catch (error) {
    console.error('❌ Ошибка при отправке широковещательного уведомления через Socket.IO:', error);
  }
};

// Функция для отправки обновлений турнира всем клиентам на странице турнира
const broadcastTournamentUpdate = (tournamentId, tournamentData) => {
  try {
    const app = global.app || require('./server');
    const io = app.get('io');
    if (!io) {
      console.error('❌ socket.io instance not found');
      return;
    }
    io.to(`tournament_${tournamentId}`).emit('tournament_update', tournamentData);
    console.log(`📢 Обновление турнира ${tournamentId} отправлено через Socket.IO`);
  } catch (error) {
    console.error(`❌ Ошибка при отправке обновления турнира ${tournamentId} через Socket.IO:`, error);
  }
};

module.exports = { sendNotification, broadcastNotification, broadcastTournamentUpdate };