/**
 * Импорт последнего матча с указанного CS2 сервера
 * Использование: node reimport_last_match.js [server_id]
 * По умолчанию: server_id = 1
 */

const pool = require('./db');
const { withMySql, importMatchFromMySql, materializePlayerStatsFromMatchzy } = require('./services/matchzyPollingService');

async function reimportLastMatch() {
  const serverId = parseInt(process.argv[2]) || 1; // По умолчанию сервер ID 1
  
  console.log(`🔄 Импорт последнего матча с сервера ID ${serverId}...\n`);
  
  try {
    // Получаем данные сервера
    const serverResult = await pool.query(
      'SELECT id, name, db_host, db_port, db_user, db_name FROM cs2_servers WHERE id = $1',
      [serverId]
    );
    
    if (!serverResult.rows[0]) {
      console.error(`❌ Сервер с ID ${serverId} не найден`);
      process.exit(1);
    }
    
    const server = serverResult.rows[0];
    console.log(`🖥️  Сервер: ${server.name}`);
    console.log(`📍 БД: ${server.db_host}:${server.db_port || 3306}/${server.db_name}\n`);
    
    if (!server.db_host) {
      console.error(`❌ У сервера не настроены данные MySQL БД (db_host пустой)`);
      process.exit(1);
    }
    
    // Подключаемся к MySQL БД сервера
    await withMySql(async (conn) => {
      // Получаем последний завершенный матч
      const [rows] = await conn.execute(
        `SELECT * FROM matchzy_stats_matches WHERE end_time IS NOT NULL ORDER BY end_time DESC LIMIT 1`
      );
      
      if (rows.length === 0) {
        console.log('⚠️ В БД сервера нет завершенных матчей');
        process.exit(0);
      }
      
      const matchRow = rows[0];
      const matchid = Number(matchRow.matchid);
      
      console.log(`📊 Последний матч:`);
      console.log(`   Match ID: ${matchid}`);
      console.log(`   Команды: ${matchRow.team1_name} ${matchRow.team1_score}:${matchRow.team2_score} ${matchRow.team2_name}`);
      console.log(`   Завершен: ${matchRow.end_time}\n`);
      
      // Проверяем, есть ли уже в нашей БД
      const exists = await pool.query('SELECT matchid FROM matchzy_matches WHERE matchid = $1', [matchid]);
      
      if (exists.rows[0]) {
        console.log('⚠️ Этот матч уже импортирован, удаляем старые данные...');
        // Удаляем старые данные этого матча
        await pool.query('DELETE FROM matchzy_players WHERE matchid = $1', [matchid]);
        await pool.query('DELETE FROM matchzy_maps WHERE matchid = $1', [matchid]);
        await pool.query('DELETE FROM matchzy_matches WHERE matchid = $1', [matchid]);
        console.log('✅ Старые данные удалены\n');
      }
      
      // Импортируем матч
      console.log('📥 Импортирую матч...');
      const imported = await importMatchFromMySql(matchRow, conn);
      
      if (!imported) {
        console.error('❌ Не удалось импортировать матч');
        process.exit(1);
      }
      
      console.log('✅ Матч импортирован\n');
      
      // Связываем с нашими матчами
      console.log('🔗 Связываю с локальными матчами...');
      await linkOurRefs(matchid);
      
      // Материализуем статистику
      console.log('📊 Материализую статистику игроков...');
      try {
        const materialized = await materializePlayerStatsFromMatchzy(matchid);
        if (materialized) {
          console.log('✅ Статистика материализована\n');
        } else {
          console.log('⚠️ Статистика не материализована (возможно, матч не связан с нашим match_id)\n');
        }
      } catch (matErr) {
        console.warn('⚠️ Ошибка материализации:', matErr.message, '\n');
      }
      
      // Проверяем результат
      const playersCheck = await pool.query(
        'SELECT steamid64, name, kills, deaths FROM matchzy_players WHERE matchid = $1 LIMIT 5',
        [matchid]
      );
      
      if (playersCheck.rows.length > 0) {
        console.log('🎮 Примеры игроков:');
        playersCheck.rows.forEach(p => {
          console.log(`   ${p.name} | Steam64: ${p.steamid64} | K/D: ${p.kills}/${p.deaths}`);
        });
      }
      
    }, serverId);
    
    console.log('\n✅ Готово!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Функция связывания с локальными матчами
async function linkOurRefs(matchid) {
  const client = await pool.connect();
  try {
    const adminLobbyId = deriveLobbyIdFromMatchId(matchid);
    if (adminLobbyId) {
      const admin = await client.query('SELECT match_id FROM admin_match_lobbies WHERE id = $1', [adminLobbyId]);
      const ourMatchId = admin.rows[0]?.match_id;
      if (ourMatchId) {
        await client.query(
          'UPDATE matchzy_matches SET our_match_id = $1, lobby_id = $2 WHERE matchid = $3',
          [ourMatchId, adminLobbyId, matchid]
        );
        console.log(`   ✅ Связал с admin лобби ${adminLobbyId}, match_id=${ourMatchId}`);
      }
    }
  } catch (e) {
    console.warn('   ⚠️ Не удалось связать с локальным матчем');
  } finally {
    client.release();
  }
}

function deriveLobbyIdFromMatchId(matchid) {
  try {
    const s = String(matchid);
    if (s.length <= 8) return null;
    const lobbyId = Number(s.slice(0, -8));
    return Number.isInteger(lobbyId) && lobbyId > 0 ? lobbyId : null;
  } catch (_) {
    return null;
  }
}

reimportLastMatch();

