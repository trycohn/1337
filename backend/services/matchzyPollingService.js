const pool = require('../db');

// Внешняя БД matchzy: поддерживаем MySQL через mysql2/promise
let mysql = null;
try {
  // Опциональная зависимость; если нет — сервис просто не стартует
  mysql = require('mysql2/promise');
} catch (_) {}

const DEFAULT_INTERVAL_MS = 15000; // 15s

function getConfig() {
  return {
    enabled: String(process.env.MATCHZY_POLLING_ENABLED || 'false').toLowerCase() === 'true',
    driver: (process.env.MATCHZY_POLLING_DRIVER || 'mysql').toLowerCase(),
    intervalMs: Number(process.env.MATCHZY_POLLING_INTERVAL_MS || DEFAULT_INTERVAL_MS),
    mysql: {
      host: process.env.MATCHZY_MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MATCHZY_MYSQL_PORT || 3306),
      user: process.env.MATCHZY_MYSQL_USER || 'root',
      password: process.env.MATCHZY_MYSQL_PASSWORD || '',
      database: process.env.MATCHZY_MYSQL_DATABASE || 'matchzy',
    },
  };
}

async function withMySql(fn) {
  const cfg = getConfig();
  if (cfg.driver !== 'mysql') throw new Error('Only MySQL driver is supported for now');
  if (!mysql) throw new Error('mysql2 is not installed');
  const conn = await mysql.createConnection(cfg.mysql);
  try { return await fn(conn); } finally { try { await conn.end(); } catch (_) {} }
}

function deriveLobbyIdFromMatchId(matchid) {
  // Наш формат: matchid = Number(`${lobbyId}${last8Ts}`)
  try {
    const s = String(matchid);
    if (s.length <= 8) return null;
    const lobbyId = Number(s.slice(0, -8));
    return Number.isInteger(lobbyId) && lobbyId > 0 ? lobbyId : null;
  } catch (_) { return null; }
}

async function importMatchFromMySql(matchRow, conn) {
  const matchid = Number(matchRow.matchid);
  const lobbyId = deriveLobbyIdFromMatchId(matchid);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Пропускаем, если уже есть
    const exists = await client.query('SELECT 1 FROM matchzy_matches WHERE matchid = $1', [matchid]);
    if (exists.rows[0]) { await client.query('ROLLBACK'); return false; }

    // Вставляем матч
    await client.query(
      `INSERT INTO matchzy_matches (matchid, our_match_id, lobby_id, start_time, end_time, winner, series_type, team1_name, team1_score, team2_name, team2_score, server_ip)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [matchid, lobbyId, matchRow.start_time, matchRow.end_time, matchRow.winner || '', matchRow.series_type || 'bo1', matchRow.team1_name || '', matchRow.team1_score || 0, matchRow.team2_name || '', matchRow.team2_score || 0, matchRow.server_ip || '0']
    );

    // Карты
    const [maps] = await conn.execute('SELECT * FROM matchzy_stats_maps WHERE matchid = ?', [matchid]);
    for (const m of maps) {
      await client.query(
        `INSERT INTO matchzy_maps (matchid, mapnumber, start_time, end_time, winner, mapname, team1_score, team2_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (matchid, mapnumber) DO NOTHING`,
        [matchid, m.mapnumber, m.start_time, m.end_time, m.winner || '', m.mapname, m.team1_score || 0, m.team2_score || 0]
      );
    }

    // Игроки
    const [players] = await conn.execute('SELECT * FROM matchzy_stats_players WHERE matchid = ?', [matchid]);
    for (const p of players) {
      await client.query(
        `INSERT INTO matchzy_players (
           matchid,mapnumber,steamid64,team,name,kills,deaths,damage,assists,enemy5ks,enemy4ks,enemy3ks,enemy2ks,
           utility_count,utility_damage,utility_successes,utility_enemies,flash_count,flash_successes,
           health_points_removed_total,health_points_dealt_total,shots_fired_total,shots_on_target_total,
           v1_count,v1_wins,v2_count,v2_wins,entry_count,entry_wins,equipment_value,money_saved,kill_reward,live_time,
           head_shot_kills,cash_earned,enemies_flashed
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
           $14,$15,$16,$17,$18,$19,
           $20,$21,$22,$23,
           $24,$25,$26,$27,$28,$29,$30,$31,$32,$33,
           $34,$35,$36
         ) ON CONFLICT (matchid, mapnumber, steamid64) DO NOTHING`,
        [
          matchid, p.mapnumber, String(p.steamid64), p.team || '', p.name || '', p.kills||0, p.deaths||0, p.damage||0, p.assists||0,
          p.enemy5ks||0, p.enemy4ks||0, p.enemy3ks||0, p.enemy2ks||0,
          p.utility_count||0, p.utility_damage||0, p.utility_successes||0, p.utility_enemies||0, p.flash_count||0, p.flash_successes||0,
          p.health_points_removed_total||0, p.health_points_dealt_total||0, p.shots_fired_total||0, p.shots_on_target_total||0,
          p.v1_count||0, p.v1_wins||0, p.v2_count||0, p.v2_wins||0, p.entry_count||0, p.entry_wins||0, p.equipment_value||0, p.money_saved||0, p.kill_reward||0, p.live_time||0,
          p.head_shot_kills||0, p.cash_earned||0, p.enemies_flashed||0
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`✅ [matchzy-poll] Импортирован матч ${matchid}${lobbyId ? ` (lobby ${lobbyId})` : ''}`);
    return true;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('❌ [matchzy-poll] Ошибка импорта матча', e.message);
    return false;
  } finally {
    client.release();
  }
}

async function linkOurRefs(matchid) {
  const client = await pool.connect();
  try {
    // 1) Пробуем связать с ADMIN лобби по нашему формату matchid → admin_lobby_id → match_id
    const adminLobbyId = deriveLobbyIdFromMatchId(matchid);
    if (adminLobbyId) {
      const admin = await client.query('SELECT match_id FROM admin_match_lobbies WHERE id = $1', [adminLobbyId]);
      const ourMatchId = admin.rows[0]?.match_id;
      if (ourMatchId) {
        await client.query('UPDATE matchzy_matches SET our_match_id = $1, lobby_id = $2 WHERE matchid = $3 AND (our_match_id IS NULL OR lobby_id IS NULL)', [ourMatchId, adminLobbyId, matchid]);
        await client.query('UPDATE matchzy_pickban_steps SET our_match_id = $1 WHERE lobby_id = $2 AND (our_match_id IS NULL)', [ourMatchId, adminLobbyId]);
        console.log(`🔗 [matchzy-poll] Связал admin лобби ${adminLobbyId} с матчем ${matchid} → our_match_id=${ourMatchId}`);
        return;
      }
    }

    // 2) Пробуем связать с ТУРНИРНЫМ лобби по именам команд и времени
    const mz = await client.query('SELECT team1_name, team2_name, start_time FROM matchzy_matches WHERE matchid = $1', [matchid]);
    if (mz.rows[0]) {
      const t1 = (mz.rows[0].team1_name || '').toLowerCase();
      const t2 = (mz.rows[0].team2_name || '').toLowerCase();
      const st = mz.rows[0].start_time;
      const candidate = await client.query(
        `SELECT ml.id AS lobby_id, m.id AS match_id
         FROM match_lobbies ml
         JOIN matches m ON m.id = ml.match_id
         WHERE LOWER(m.team1_name) = $1 AND LOWER(m.team2_name) = $2
           AND ABS(EXTRACT(EPOCH FROM (COALESCE(ml.created_at, NOW()) - $3))) < 43200
         ORDER BY ABS(EXTRACT(EPOCH FROM (COALESCE(ml.created_at, NOW()) - $3))) ASC
         LIMIT 1`,
        [t1, t2, st]
      );
      if (candidate.rows[0]) {
        const tlobby = candidate.rows[0].lobby_id;
        const ourMatchId = candidate.rows[0].match_id;
        await client.query('UPDATE matchzy_matches SET our_match_id = $1, tournament_lobby_id = $2 WHERE matchid = $3 AND (our_match_id IS NULL OR tournament_lobby_id IS NULL)', [ourMatchId, tlobby, matchid]);
        await client.query('UPDATE matchzy_pickban_steps SET our_match_id = $1 WHERE tournament_lobby_id = $2 AND (our_match_id IS NULL)', [ourMatchId, tlobby]);
        console.log(`🔗 [matchzy-poll] Связал tournament лобби ${tlobby} с матчем ${matchid} → our_match_id=${ourMatchId}`);
        return;
      }
    }
  } catch (e) {
    console.warn('⚠️ [matchzy-poll] Не удалось связать our_match_id/lobby для', matchid, e.message);
  } finally { client.release(); }
}

async function pollOnce() {
  const cfg = getConfig();
  if (!cfg.enabled) return;
  if (cfg.driver !== 'mysql') return; // пока только MySQL
  try {
    await withMySql(async (conn) => {
      const [rows] = await conn.execute(
        `SELECT * FROM matchzy_stats_matches WHERE end_time IS NOT NULL ORDER BY end_time DESC LIMIT 20`
      );
      for (const row of rows) {
        // импортируем, если в PG ещё нет
        const exists = await pool.query('SELECT 1 FROM matchzy_matches WHERE matchid = $1', [row.matchid]);
        if (!exists.rows[0]) { await importMatchFromMySql(row, conn); }
        await linkOurRefs(Number(row.matchid));
      }
    });
  } catch (e) {
    console.error('❌ [matchzy-poll] Ошибка опроса:', e.message);
  }
}

let timer = null;
async function start() {
  const cfg = getConfig();
  if (!cfg.enabled) {
    console.log('ℹ️ [matchzy-poll] Пуллинг отключён');
    return;
  }
  if (cfg.driver === 'mysql' && !mysql) {
    console.warn('⚠️ [matchzy-poll] Нет зависимости mysql2, пуллинг не будет запущен');
    return;
  }
  const tick = async () => { await pollOnce(); timer = setTimeout(tick, cfg.intervalMs); };
  console.log(`▶️  [matchzy-poll] Старт пуллинга (driver=${cfg.driver}, every=${cfg.intervalMs}ms)`);
  timer = setTimeout(tick, 2000);
}

function stop() { if (timer) { clearTimeout(timer); timer = null; } }

module.exports = { start, stop, pollOnce };


