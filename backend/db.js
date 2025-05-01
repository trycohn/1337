const { Pool } = require('pg');
require('dotenv').config();

// Проверка наличия необходимых параметров подключения
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Параметр DATABASE_URL не найден в конфигурации!');
    console.error('Убедитесь, что переменная DATABASE_URL задана в файле .env');
    console.error('Пример формата: postgresql://username:password@localhost:5432/database_name');
    
    // В production режиме стоит завершить процесс при отсутствии параметров подключения
    if (process.env.NODE_ENV === 'production') {
        console.error('Завершение работы приложения из-за критической ошибки конфигурации.');
        process.exit(1);
    }
}

// Параметры подключения к БД
const poolConfig = {
    connectionString: DATABASE_URL,
    // Максимальное время простоя соединения в пуле (30 секунд)
    idleTimeoutMillis: 30000,
    // Максимальное время ожидания соединения из пула (30 секунд)
    connectionTimeoutMillis: 30000,
    // Максимальное количество соединений в пуле
    max: 20
};

// Создаем пул соединений с базой данных
const pool = new Pool(poolConfig);

// Обработчик ошибок на уровне пула
pool.on('error', (err, client) => {
    console.error('❌ Неожиданная ошибка на клиенте PostgreSQL', err);
});

// Функция для проверки состояния соединения с БД
const checkDatabaseConnection = async (retries = 5, delay = 3000) => {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const client = await pool.connect();
            const result = await client.query('SELECT NOW()');
            client.release();
            console.log('✅ Успешное подключение к базе данных');
            return true;
        } catch (err) {
            lastError = err;
            console.error(`❌ Попытка подключения к БД #${attempt} не удалась:`, err.message);
            
            if (attempt < retries) {
                console.log(`Повторная попытка через ${delay/1000} сек...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    console.error(`❌ Не удалось подключиться к базе данных после ${retries} попыток. Последняя ошибка:`, lastError);
    return false;
};

// Выполняем проверку подключения при инициализации
// Используем асинхронную функцию, чтобы не блокировать запуск приложения
(async () => {
    try {
        await checkDatabaseConnection();
    } catch (err) {
        console.error('❌ Ошибка проверки подключения к базе данных:', err);
    }
})();

// Вспомогательная функция для выполнения запросов с повторными попытками
pool.queryWithRetry = async (text, params, retries = 3, delay = 1000) => {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await pool.query(text, params);
        } catch (err) {
            lastError = err;
            console.error(`❌ Ошибка выполнения запроса (попытка ${attempt}/${retries}):`, err.message);
            
            // Проверяем, не потеряно ли соединение с БД
            if (err.code === 'ECONNREFUSED' || err.code === '57P01' || err.code === '57P02' || err.code === '57P03') {
                console.log('📡 Потеряно соединение с базой данных, проверяем статус...');
                await checkDatabaseConnection(1);
            }
            
            if (attempt < retries) {
                console.log(`Повторный запрос через ${delay/1000} сек...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
};

module.exports = pool;