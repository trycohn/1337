/**
 * Скрипт для добавления тестового CS2 сервера
 * Использование: node add_test_server.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '01012006Fortnite!',
  host: process.env.DB_HOST || '80.87.200.23',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || '1337community.com'
});

const addTestServer = async () => {
  const client = await pool.connect();
  try {
    console.log('🔧 Добавление тестового CS2 сервера...');
    
    // Проверяем существование таблицы
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'cs2_servers'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.error('❌ Таблица cs2_servers не существует. Выполните миграцию сначала.');
      return;
    }

    // Данные тестового сервера (замените на реальные)
    const serverData = {
      name: 'Test Server 1337',
      description: 'Тестовый сервер для разработки и отладки',
      host: process.env.CS2_TEST_HOST || '127.0.0.1',
      port: parseInt(process.env.CS2_TEST_PORT || '27015'),
      rcon_password: process.env.CS2_RCON_PASSWORD || 'change_me_rcon',
      server_password: process.env.CS2_TEST_PASSWORD || 'test1337',
      gotv_host: process.env.CS2_GOTV_HOST || '127.0.0.1',
      gotv_port: parseInt(process.env.CS2_GOTV_PORT || '27020'),
      gotv_password: process.env.CS2_GOTV_PASSWORD || 'gotv1337',
      max_slots: 10,
      location: 'RU',
      status: 'offline'
    };

    // Проверяем, существует ли уже сервер с таким именем
    const existingServer = await client.query(
      'SELECT id, name FROM cs2_servers WHERE name = $1',
      [serverData.name]
    );

    if (existingServer.rows.length > 0) {
      console.log(`⚠️ Сервер "${serverData.name}" уже существует (ID: ${existingServer.rows[0].id})`);
      console.log('   Используйте другое имя или удалите существующий сервер.');
      return;
    }

    // Добавляем сервер
    const result = await client.query(
      `INSERT INTO cs2_servers 
      (name, description, host, port, rcon_password, server_password, 
       gotv_host, gotv_port, gotv_password, max_slots, location, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        serverData.name,
        serverData.description,
        serverData.host,
        serverData.port,
        serverData.rcon_password,
        serverData.server_password,
        serverData.gotv_host,
        serverData.gotv_port,
        serverData.gotv_password,
        serverData.max_slots,
        serverData.location,
        serverData.status
      ]
    );

    console.log('✅ Тестовый сервер успешно добавлен:');
    console.log('   ID:', result.rows[0].id);
    console.log('   Название:', result.rows[0].name);
    console.log('   Адрес:', `${result.rows[0].host}:${result.rows[0].port}`);
    console.log('   GOTV:', `${result.rows[0].gotv_host}:${result.rows[0].gotv_port}`);
    console.log('   Локация:', result.rows[0].location);
    console.log('   Статус:', result.rows[0].status);
    
  } catch (err) {
    console.error('❌ Ошибка при добавлении сервера:', err.message);
    console.error('   Детали:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

addTestServer();

