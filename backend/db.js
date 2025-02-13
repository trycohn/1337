// backend/db.js
require('dotenv').config(); // [Строка 1: Загружаем переменные окружения из .env]
const { Pool } = require('pg'); // [Строка 2: Импортируем класс Pool из pg]

// [Строка 4] Создаём пул соединений с использованием переменной окружения DATABASE_URL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:S1lverbooze@localhost:5432/postgres'
  });
  
// Экспортируем пул для использования в других модулях
module.exports = pool;
