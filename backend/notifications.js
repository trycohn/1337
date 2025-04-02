// notifications.js

const { Server } = require('socket.io');

// Хранение подключённых пользователей (Map для сопоставления userId и socketId)
const connectedUsers = new Map();

// Инициализация Socket.IO
let io;

// Функция для инициализации Socket.IO
const initializeSocket = (server) => {
  // Настройка Socket.IO с CORS для локальной разработки и продакшена
  io = new Server(server, {
    cors: {
      // Разрешаем подключения с фронтенда
      origin: process.env.NODE_ENV === 'production'
        ? 'https://1337brackets-frontend.vercel.app' // URL фронтенда на Vercel
        : ['http://localhost:3001', 'http://127.0.0.1:5500'], // Локальные URL для разработки
      methods: ['GET', 'POST'],
      credentials: true, // Разрешаем отправку куки и заголовков авторизации
    },
  });

  // Обработка подключения нового клиента
  io.on('connection', (socket) => {
    console.log('🔌 Клиент подключён:', socket.id);

    // Регистрация пользователя (сопоставление userId с socketId)
    socket.on('register', (userId) => {
      if (userId) {
        connectedUsers.set(userId, socket.id);
        console.log(`✅ Пользователь ${userId} зарегистрирован с socket ${socket.id}`);
      } else {
        console.log('⚠️ Пользователь не предоставил userId при регистрации');
      }
    });

    // Обработка отключения клиента
    socket.on('disconnect', () => {
      for (let [userId, socketId] of connectedUsers) {
        if (socketId === socket.id) {
          connectedUsers.delete(userId);
          console.log(`❌ Пользователь ${userId} отключён`);
          break;
        }
      }
    });
  });

  return io;
};

// Функция отправки уведомления конкретному пользователю
const sendNotification = (userId, notification) => {
  const socketId = connectedUsers.get(userId);
  if (socketId && io) {
    io.to(socketId).emit('notification', notification);
    console.log(`📩 Уведомление отправлено пользователю ${userId}:`, notification);
  } else {
    console.log(`⚠️ Не удалось отправить уведомление пользователю ${userId}: пользователь не подключён или io не инициализирован`);
  }
};

module.exports = { initializeSocket, sendNotification };