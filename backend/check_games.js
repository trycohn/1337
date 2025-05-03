const db = require('./db');

async function checkAndCreateGamesTable() {
  try {
    console.log('Проверка существования таблицы games...');
    
    // Проверяем, существует ли таблица games
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'games'
      );
    `;
    
    const tableExists = await db.query(tableExistsQuery);
    
    if (!tableExists.rows[0].exists) {
      console.log('Таблица games не существует. Создаю таблицу...');
      
      // Создаем таблицу games
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS games (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          image_url TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `;
      
      await db.query(createTableQuery);
      console.log('Таблица games успешно создана.');
      
      // Добавляем базовые игры
      const insertGamesQuery = `
        INSERT INTO games (name, description, created_at) VALUES
          ('Counter-Strike 2', 'Командный тактический шутер от первого лица', NOW()),
          ('Dota 2', 'Многопользовательская командная игра в жанре MOBA', NOW()),
          ('League of Legends', 'Многопользовательская командная игра в жанре MOBA', NOW()),
          ('Valorant', 'Тактический шутер от первого лица', NOW()),
          ('Apex Legends', 'Королевская битва от первого лица', NOW()),
          ('Fortnite', 'Королевская битва от третьего лица', NOW()),
          ('PUBG', 'Королевская битва от первого лица', NOW()),
          ('Rocket League', 'Футбол на автомобилях', NOW()),
          ('Overwatch 2', 'Командный шутер от первого лица', NOW()),
          ('Rainbow Six Siege', 'Тактический шутер от первого лица', NOW())
        ON CONFLICT (name) DO NOTHING;
      `;
      
      await db.query(insertGamesQuery);
      console.log('Базовые игры успешно добавлены.');
    } else {
      console.log('Таблица games уже существует.');
      
      // Проверяем, есть ли записи в таблице games
      const countQuery = `SELECT COUNT(*) FROM games;`;
      const countResult = await db.query(countQuery);
      const gameCount = parseInt(countResult.rows[0].count);
      
      if (gameCount === 0) {
        console.log('Таблица games пуста. Добавляю базовые игры...');
        
        // Добавляем базовые игры
        const insertGamesQuery = `
          INSERT INTO games (name, description, created_at) VALUES
            ('Counter-Strike 2', 'Командный тактический шутер от первого лица', NOW()),
            ('Dota 2', 'Многопользовательская командная игра в жанре MOBA', NOW()),
            ('League of Legends', 'Многопользовательская командная игра в жанре MOBA', NOW()),
            ('Valorant', 'Тактический шутер от первого лица', NOW()),
            ('Apex Legends', 'Королевская битва от первого лица', NOW()),
            ('Fortnite', 'Королевская битва от третьего лица', NOW()),
            ('PUBG', 'Королевская битва от первого лица', NOW()),
            ('Rocket League', 'Футбол на автомобилях', NOW()),
            ('Overwatch 2', 'Командный шутер от первого лица', NOW()),
            ('Rainbow Six Siege', 'Тактический шутер от первого лица', NOW())
          ON CONFLICT (name) DO NOTHING;
        `;
        
        await db.query(insertGamesQuery);
        console.log('Базовые игры успешно добавлены.');
      } else {
        console.log(`В таблице games найдено ${gameCount} записей.`);
        
        // Выводим список игр
        const gamesQuery = `SELECT id, name, description FROM games ORDER BY id;`;
        const games = await db.query(gamesQuery);
        
        console.log('Список игр:');
        games.rows.forEach(game => {
          console.log(`ID: ${game.id}, Название: ${game.name}`);
        });
      }
    }
    
    console.log('Проверка завершена успешно.');
  } catch (error) {
    console.error('Ошибка при проверке или создании таблицы games:', error);
  } finally {
    // Закрываем пул соединений только если скрипт запущен напрямую
    if (require.main === module) {
      await db.end();
    }
  }
}

// Запускаем функцию только если скрипт вызван напрямую
if (require.main === module) {
  checkAndCreateGamesTable().then(() => {
    console.log('Скрипт завершен.');
  });
}

module.exports = { checkAndCreateGamesTable }; 