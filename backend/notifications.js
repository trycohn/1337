const { Server } = require('socket.io');
const http = require('http');

// Хранение подключённых пользователей
const connectedUsers = new Map();

// Инициализация Socket.IO
let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: 'http://localhost:3001',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Клиент подключён:', socket.id);

    socket.on('register', (userId) => {
      connectedUsers.set(userId, socket.id);
      console.log(`Пользователь ${userId} зарегистрирован с socket ${socket.id}`);
    });

    socket.on('disconnect', () => {
      for (let [userId, socketId] of connectedUsers) {
        if (socketId === socket.id) {
          connectedUsers.delete(userId);
          console.log(`Пользователь ${userId} отключён`);
          break;
        }
      }
    });
  });
};

// Функция отправки уведомления
const sendNotification = (userId, notification) => {
    const socketId = connectedUsers.get(userId);
    if (socketId && io) {
      io.to(socketId).emit('notification', notification);
      console.log(`Уведомление отправлено пользователю ${userId}:`, notification);
    }
  };

module.exports = { initializeSocket, sendNotification };