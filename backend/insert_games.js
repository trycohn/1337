const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: 'postgres',
  password: '01012006Fortnite!',
  host: '80.87.200.23',
  port: 5432,
  database: '1337community.com'
});

const insertGames = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const games = [
      ['Counter Strike 2', 'Командный тактический шутер от первого лица'],
      ['Dota 2', 'Многопользовательская командная игра в жанре MOBA'],
      ['League of Legends', 'Многопользовательская командная игра в жанре MOBA'],
      ['Valorant', 'Тактический шутер от первого лица'],
      ['Apex Legends', 'Королевская битва от первого лица'],
      ['Fortnite', 'Королевская битва от третьего лица'],
      ['PUBG', 'Королевская битва от первого лица'],
      ['Rocket League', 'Футбол на автомобилях'],
      ['Overwatch 2', 'Командный шутер от первого лица'],
      ['Rainbow Six Siege', 'Тактический шутер от первого лица']
    ];

    for (const [name, description] of games) {
      await client.query(
        'INSERT INTO games (name, description) VALUES ($1, $2)',
        [name, description]
      );
    }

    await client.query('COMMIT');
    console.log('Данные успешно добавлены в таблицу games');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка при добавлении данных:', err);
  } finally {
    client.release();
    pool.end();
  }
};

insertGames(); 