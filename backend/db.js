// backend/db.js
require('dotenv').config();
const { Pool } = require('pg');

// Проверяем, локальная ли база (если DATABASE_URL содержит "localhost")
const isProduction = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:S1lverbooze@localhost:5432/postgres',
  ssl: isProduction ? { rejectUnauthorized: false } : false // SSL отключается для локальной базы
});

console.log('🔍 Подключение к базе:', process.env.DATABASE_URL || 'Локальная база');

// Экспортируем пул соединений
module.exports = pool;
