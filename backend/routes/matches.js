const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, restrictTo } = require('../middleware/auth');

// 📊 Агрегатор статистики кастомного матча (только для матчей с лобби)
router.get('/custom/:id/stats', async (req, res) => {
    const matchId = Number(req.params.id);
    if (!Number.isInteger(matchId) || matchId <= 0) return res.status(400).json({ success: false, error: 'Bad match id' });
    const client = await pool.connect();
    try {
        // 1) Ищем admin‑лобби ИЛИ fallback матч
        const lob = await client.query('SELECT id, team1_name, team2_name FROM admin_match_lobbies WHERE match_id = $1', [matchId]);
        const lobbyId = lob.rows[0]?.id || null;

        // 2) Находим соответствующий matchzy матч
        const m = await client.query(
            lobbyId
            ? 'SELECT * FROM matchzy_matches WHERE lobby_id = $1 OR our_match_id = $2 ORDER BY end_time DESC NULLS LAST LIMIT 1'
            : 'SELECT * FROM matchzy_matches WHERE our_match_id = $1 ORDER BY end_time DESC NULLS LAST LIMIT 1',
            lobbyId ? [lobbyId, matchId] : [matchId]
        );
        if (!m.rows[0]) return res.status(404).json({ success: false, error: 'Статистика матча ещё не импортирована' });
        const mz = m.rows[0];

        // 3) Карты и игроки
        const mapsRes = await client.query('SELECT * FROM matchzy_maps WHERE matchid = $1 ORDER BY mapnumber ASC', [mz.matchid]);
        const playersRes = await client.query('SELECT * FROM matchzy_players WHERE matchid = $1', [mz.matchid]);
        const maps = mapsRes.rows;
        const players = playersRes.rows;

        // 4) Подсчёт раундов всей серии и по картам
        const totalRounds = maps.reduce((acc, r) => acc + Number(r.team1_score || 0) + Number(r.team2_score || 0), 0) || 1;
        const roundsByMap = new Map(maps.map(r => [Number(r.mapnumber), (Number(r.team1_score||0)+Number(r.team2_score||0)) || 1]));

        // 5) Агрегируем игроков по steamid64 (сумма по картам)
        const bySteam = new Map();
        for (const p of players) {
            const key = String(p.steamid64);
            if (!bySteam.has(key)) bySteam.set(key, {
                steamid64: key,
                team: p.team,
                name: p.name,
                kills: 0, deaths: 0, assists: 0, damage: 0,
                head_shot_kills: 0,
                shots_fired_total: 0, shots_on_target_total: 0,
                entry_count: 0, entry_wins: 0,
                v1_count: 0, v1_wins: 0, v2_count: 0, v2_wins: 0,
                enemy5ks: 0, enemy4ks: 0, enemy3ks: 0, enemy2ks: 0,
                utility_damage: 0, enemies_flashed: 0
            });
            const a = bySteam.get(key);
            a.kills += p.kills||0; a.deaths += p.deaths||0; a.assists += p.assists||0; a.damage += p.damage||0;
            a.head_shot_kills += p.head_shot_kills||0;
            a.shots_fired_total += p.shots_fired_total||0; a.shots_on_target_total += p.shots_on_target_total||0;
            a.entry_count += p.entry_count||0; a.entry_wins += p.entry_wins||0;
            a.v1_count += p.v1_count||0; a.v1_wins += p.v1_wins||0; a.v2_count += p.v2_count||0; a.v2_wins += p.v2_wins||0;
            a.enemy5ks += p.enemy5ks||0; a.enemy4ks += p.enemy4ks||0; a.enemy3ks += p.enemy3ks||0; a.enemy2ks += p.enemy2ks||0;
            a.utility_damage += p.utility_damage||0; a.enemies_flashed += p.enemies_flashed||0;
        }

        // 6) Командные суммы для RWS*
        const teamDamage = {};
        for (const v of bySteam.values()) {
            const t = v.team || 'Unknown';
            teamDamage[t] = (teamDamage[t]||0) + (v.damage||0);
        }

        function metricFor(a) {
            const kd = a.deaths > 0 ? a.kills / a.deaths : a.kills;
            const adr = totalRounds > 0 ? a.damage / totalRounds : 0;
            const hs = a.kills > 0 ? a.head_shot_kills / a.kills : 0;
            const acc = a.shots_fired_total > 0 ? a.shots_on_target_total / a.shots_fired_total : 0;
            const entry = a.entry_count > 0 ? a.entry_wins / a.entry_count : 0;
            const clutch1 = a.v1_count > 0 ? a.v1_wins / a.v1_count : 0;
            const clutch2 = a.v2_count > 0 ? a.v2_wins / a.v2_count : 0;
            const rws = teamDamage[a.team] > 0 ? (a.damage / teamDamage[a.team]) * 100 : 0; // приближённый RWS*
            return { kd, adr, hs, acc, entry, clutch1, clutch2, rws };
        }

        // 7) Сборка игроков по командам (сумма) и по картам
        const team1Name = mz.team1_name || lob.rows[0].team1_name || 'TEAM_A';
        const team2Name = mz.team2_name || lob.rows[0].team2_name || 'TEAM_B';
        const team1 = [];
        const team2 = [];
        const playersByMap = {}; // { mapnumber: { team1:[], team2:[] } }
        function pushToTeam(listObj, a, metrics) {
            const row = { ...a, ...metrics };
            if (a.team === team1Name) listObj.team1.push(row);
            else if (a.team === team2Name) listObj.team2.push(row);
            else {
                const t = (a.team||'').toLowerCase();
                if (t.includes(team1Name.toLowerCase())) listObj.team1.push(row);
                else if (t.includes(team2Name.toLowerCase())) listObj.team2.push(row);
                else (listObj.team1.length <= listObj.team2.length ? listObj.team1 : listObj.team2).push(row);
            }
        }
        for (const a of bySteam.values()) {
            const metrics = metricFor(a);
            if (a.team === team1Name) team1.push({ ...a, ...metrics });
            else if (a.team === team2Name) team2.push({ ...a, ...metrics });
            else {
                const t = (a.team||'').toLowerCase();
                if (t.includes(team1Name.toLowerCase())) team1.push({ ...a, ...metrics });
                else if (t.includes(team2Name.toLowerCase())) team2.push({ ...a, ...metrics });
                else team1.length <= team2.length ? team1.push({ ...a, ...metrics }) : team2.push({ ...a, ...metrics });
            }
        }
        // По картам: пересчитываем метрики с раундами конкретной карты
        for (const p of players) {
            const mapno = Number(p.mapnumber);
            const rounds = roundsByMap.get(mapno) || 1;
            const a = {
                steamid64: String(p.steamid64),
                team: p.team, name: p.name,
                kills: p.kills||0, deaths: p.deaths||0, assists: p.assists||0, damage: p.damage||0,
                head_shot_kills: p.head_shot_kills||0, shots_fired_total: p.shots_fired_total||0,
                shots_on_target_total: p.shots_on_target_total||0, entry_count: p.entry_count||0, entry_wins: p.entry_wins||0,
                v1_count: p.v1_count||0, v1_wins: p.v1_wins||0, v2_count: p.v2_count||0, v2_wins: p.v2_wins||0,
                enemy5ks: p.enemy5ks||0, enemy4ks: p.enemy4ks||0, enemy3ks: p.enemy3ks||0, enemy2ks: p.enemy2ks||0,
                utility_damage: p.utility_damage||0, enemies_flashed: p.enemies_flashed||0
            };
            const kd = a.deaths > 0 ? a.kills / a.deaths : a.kills;
            const adr = rounds > 0 ? a.damage / rounds : 0;
            const hs = a.kills > 0 ? a.head_shot_kills / a.kills : 0;
            const acc = a.shots_fired_total > 0 ? a.shots_on_target_total / a.shots_fired_total : 0;
            const entry = a.entry_count > 0 ? a.entry_wins / a.entry_count : 0;
            const clutch1 = a.v1_count > 0 ? a.v1_wins / a.v1_count : 0;
            const clutch2 = a.v2_count > 0 ? a.v2_wins / a.v2_count : 0;
            const rws = teamDamage[a.team] > 0 ? (a.damage / teamDamage[a.team]) * 100 : 0;
            if (!playersByMap[mapno]) playersByMap[mapno] = { team1: [], team2: [] };
            pushToTeam(playersByMap[mapno], a, { kd, adr, hs, acc, entry, clutch1, clutch2, rws });
        }

        // 8) Лидеры
        const everyone = [...team1, ...team2];
        function topBy(key) { return [...everyone].sort((a,b)=> (b[key]||0)-(a[key]||0))[0] || null; }
        const leaders = {
            mvpApprox: [...everyone].sort((a,b)=> (b.damage - a.damage) || (b.kills - a.kills))[0] || null,
            kills: topBy('kills'),
            damage: topBy('damage'),
            adr: topBy('adr'),
            hsPercent: topBy('hs'),
            entryWinRate: topBy('entry'),
            clutch1: topBy('clutch1'),
            clutch2: topBy('clutch2'),
            accuracy: topBy('acc'),
            fiveKs: topBy('enemy5ks'),
            fourKs: topBy('enemy4ks'),
            threeKs: topBy('enemy3ks'),
            flashed: topBy('enemies_flashed'),
            utilityDamage: topBy('utility_damage')
        };

        // 9) История pick/ban (по нашему match_id, если уже связали, иначе по lobby)
        const stepsRes = await client.query(
            `SELECT step_index, action, team_name, team_id, mapname, created_at
             FROM matchzy_pickban_steps
             WHERE our_match_id = $1 OR lobby_id = $2 OR tournament_lobby_id = $3
             ORDER BY step_index ASC, id ASC`, [matchId, lobbyId, lobbyId]
        );

        res.json({
            success: true,
            match: {
                matchid: mz.matchid,
                series_type: mz.series_type,
                start_time: mz.start_time,
                end_time: mz.end_time,
                winner: mz.winner,
                server_ip: mz.server_ip,
                team1_name: team1Name,
                team1_score: mz.team1_score,
                team2_name: team2Name,
                team2_score: mz.team2_score
            },
            maps: maps.map(r => ({
                mapnumber: r.mapnumber,
                mapname: r.mapname,
                team1_score: r.team1_score,
                team2_score: r.team2_score,
                winner: r.winner,
                picked_by: r.picked_by_name || null,
                picked_by_team_id: r.picked_by_team_id || null,
                is_decider: !!r.is_decider,
                start_time: r.start_time,
                end_time: r.end_time
            })),
            playersByTeam: { team1, team2 },
            playersByMap,
            leaders,
            pickban: stepsRes.rows
        });
    } catch (e) {
        console.error('GET /api/matches/custom/:id/stats error', e);
        res.status(500).json({ success: false, error: 'Internal error' });
    } finally {
        client.release();
    }
});

// 📊 Агрегатор статистики турнирного матча (только для турниров с лобби)
router.get('/tournament/:id/stats', async (req, res) => {
    const matchId = Number(req.params.id);
    if (!Number.isInteger(matchId) || matchId <= 0) return res.status(400).json({ success: false, error: 'Bad match id' });
    const client = await pool.connect();
    try {
        // 1) Проверяем лобби этого турнирного матча
        const lob = await client.query('SELECT id, team1_name, team2_name FROM match_lobbies WHERE match_id = $1 ORDER BY created_at DESC NULLS LAST LIMIT 1', [matchId]);
        if (!lob.rows[0]) return res.status(404).json({ success: false, error: 'Для этого матча не найдено турнирное лобби' });
        const lobbyId = lob.rows[0].id;

        // 2) Находим matchzy матч, привязанный к этому лобби либо через admin лобби
        const m = await client.query(
            'SELECT * FROM matchzy_matches WHERE tournament_lobby_id = $1 OR our_match_id = $2 OR lobby_id = $3 ORDER BY end_time DESC NULLS LAST LIMIT 1',
            [lobbyId, matchId, lobbyId]
        );
        if (!m.rows[0]) return res.status(404).json({ success: false, error: 'Статистика матча ещё не импортирована' });
        const mz = m.rows[0];

        // Переиспользуем логику из custom endpoint (локальная функция)
        async function buildPayload() {
            const mapsRes = await client.query('SELECT * FROM matchzy_maps WHERE matchid = $1 ORDER BY mapnumber ASC', [mz.matchid]);
            const playersRes = await client.query('SELECT * FROM matchzy_players WHERE matchid = $1', [mz.matchid]);
            const maps = mapsRes.rows;
            const players = playersRes.rows;
            const totalRounds = maps.reduce((acc, r) => acc + Number(r.team1_score || 0) + Number(r.team2_score || 0), 0) || 1;
            const roundsByMap = new Map(maps.map(r => [Number(r.mapnumber), (Number(r.team1_score||0)+Number(r.team2_score||0)) || 1]));

            const bySteam = new Map();
            for (const p of players) {
                const key = String(p.steamid64);
                if (!bySteam.has(key)) bySteam.set(key, {
                    steamid64: key, team: p.team, name: p.name,
                    kills:0,deaths:0,assists:0,damage:0, head_shot_kills:0,
                    shots_fired_total:0, shots_on_target_total:0,
                    entry_count:0, entry_wins:0, v1_count:0, v1_wins:0, v2_count:0, v2_wins:0,
                    enemy5ks:0, enemy4ks:0, enemy3ks:0, enemy2ks:0, utility_damage:0, enemies_flashed:0
                });
                const a = bySteam.get(key);
                a.kills += p.kills||0; a.deaths += p.deaths||0; a.assists += p.assists||0; a.damage += p.damage||0;
                a.head_shot_kills += p.head_shot_kills||0;
                a.shots_fired_total += p.shots_fired_total||0; a.shots_on_target_total += p.shots_on_target_total||0;
                a.entry_count += p.entry_count||0; a.entry_wins += p.entry_wins||0;
                a.v1_count += p.v1_count||0; a.v1_wins += p.v1_wins||0; a.v2_count += p.v2_count||0; a.v2_wins += p.v2_wins||0;
                a.enemy5ks += p.enemy5ks||0; a.enemy4ks += p.enemy4ks||0; a.enemy3ks += p.enemy3ks||0; a.enemy2ks += p.enemy2ks||0;
                a.utility_damage += p.utility_damage||0; a.enemies_flashed += p.enemies_flashed||0;
            }
            const teamDamage = {};
            for (const v of bySteam.values()) {
                const t = v.team || 'Unknown';
                teamDamage[t] = (teamDamage[t]||0) + (v.damage||0);
            }
            function metricFor(a, rounds) {
                const kd = a.deaths > 0 ? a.kills / a.deaths : a.kills;
                const adr = rounds > 0 ? a.damage / rounds : 0;
                const hs = a.kills > 0 ? a.head_shot_kills / a.kills : 0;
                const acc = a.shots_fired_total > 0 ? a.shots_on_target_total / a.shots_fired_total : 0;
                const entry = a.entry_count > 0 ? a.entry_wins / a.entry_count : 0;
                const clutch1 = a.v1_count > 0 ? a.v1_wins / a.v1_count : 0;
                const clutch2 = a.v2_count > 0 ? a.v2_wins / a.v2_count : 0;
                const rws = teamDamage[a.team] > 0 ? (a.damage / teamDamage[a.team]) * 100 : 0;
                return { kd, adr, hs, acc, entry, clutch1, clutch2, rws };
            }
            const team1Name = mz.team1_name || lob.rows[0].team1_name || 'TEAM_A';
            const team2Name = mz.team2_name || lob.rows[0].team2_name || 'TEAM_B';
            const team1 = [];
            const team2 = [];
            const playersByMap = {};
            function push(listObj, a, metrics) {
                const row = { ...a, ...metrics };
                if (a.team === team1Name) listObj.team1.push(row);
                else if (a.team === team2Name) listObj.team2.push(row);
                else {
                    const t = (a.team||'').toLowerCase();
                    if (t.includes(team1Name.toLowerCase())) listObj.team1.push(row);
                    else if (t.includes(team2Name.toLowerCase())) listObj.team2.push(row);
                    else (listObj.team1.length <= listObj.team2.length ? listObj.team1 : listObj.team2).push(row);
                }
            }
            for (const a of bySteam.values()) {
                const metrics = metricFor(a, totalRounds);
                if (a.team === team1Name) team1.push({ ...a, ...metrics });
                else if (a.team === team2Name) team2.push({ ...a, ...metrics });
                else {
                    const t = (a.team||'').toLowerCase();
                    if (t.includes(team1Name.toLowerCase())) team1.push({ ...a, ...metrics });
                    else if (t.includes(team2Name.toLowerCase())) team2.push({ ...a, ...metrics });
                    else team1.length <= team2.length ? team1.push({ ...a, ...metrics }) : team2.push({ ...a, ...metrics });
                }
            }
            for (const p of players) {
                const mno = Number(p.mapnumber);
                const rounds = roundsByMap.get(mno) || 1;
                const a = {
                    steamid64:String(p.steamid64), team:p.team, name:p.name,
                    kills:p.kills||0, deaths:p.deaths||0, assists:p.assists||0, damage:p.damage||0,
                    head_shot_kills:p.head_shot_kills||0, shots_fired_total:p.shots_fired_total||0,
                    shots_on_target_total:p.shots_on_target_total||0, entry_count:p.entry_count||0, entry_wins:p.entry_wins||0,
                    v1_count:p.v1_count||0, v1_wins:p.v1_wins||0, v2_count:p.v2_count||0, v2_wins:p.v2_wins||0,
                    enemy5ks:p.enemy5ks||0, enemy4ks:p.enemy4ks||0, enemy3ks:p.enemy3ks||0, enemy2ks:p.enemy2ks||0,
                    utility_damage:p.utility_damage||0, enemies_flashed:p.enemies_flashed||0
                };
                const metrics = metricFor(a, rounds);
                if (!playersByMap[mno]) playersByMap[mno] = { team1: [], team2: [] };
                push(playersByMap[mno], a, metrics);
            }
            const everyone = [...team1, ...team2];
            function topBy(key) { return [...everyone].sort((a,b)=> (b[key]||0)-(a[key]||0))[0] || null; }
            const leaders = {
                mvpApprox: [...everyone].sort((a,b)=> (b.damage - a.damage) || (b.kills - a.kills))[0] || null,
                kills: topBy('kills'), damage: topBy('damage'), adr: topBy('adr'), hsPercent: topBy('hs'),
                entryWinRate: topBy('entry'), clutch1: topBy('clutch1'), clutch2: topBy('clutch2'), accuracy: topBy('acc'),
                fiveKs: topBy('enemy5ks'), fourKs: topBy('enemy4ks'), threeKs: topBy('enemy3ks'), flashed: topBy('enemies_flashed'), utilityDamage: topBy('utility_damage')
            };
        const stepsRes = await client.query(
            `SELECT step_index, action, team_name, team_id, mapname, created_at
             FROM matchzy_pickban_steps
             WHERE our_match_id = $1 OR lobby_id = $2
             ORDER BY step_index ASC, id ASC`, [matchId, lobbyId || null]
        );
            return {
                success: true,
                match: {
                    matchid: mz.matchid,
                    series_type: mz.series_type,
                    start_time: mz.start_time,
                    end_time: mz.end_time,
                    winner: mz.winner,
                    server_ip: mz.server_ip,
                    team1_name: mz.team1_name || lob.rows[0].team1_name,
                    team1_score: mz.team1_score,
                    team2_name: mz.team2_name || lob.rows[0].team2_name,
                    team2_score: mz.team2_score
                },
                maps: maps,
                playersByTeam: { team1, team2 },
                playersByMap,
                leaders,
                pickban: stepsRes.rows
            };
        }
        const payload = await buildPayload();
        res.json(payload);
    } catch (e) {
        console.error('GET /api/matches/tournament/:id/stats error', e);
        res.status(500).json({ success: false, error: 'Internal error' });
    } finally { client.release(); }
});

// Получение списка всех матчей
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM matches');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создание нового матча (доступно организаторам и администраторам)
router.post('/', authenticateToken, restrictTo(['organizer', 'admin']), async (req, res) => {
    const { tournament_id, round, participant1_id, participant2_id } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO matches (tournament_id, round, participant1_id, participant2_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [tournament_id, round, participant1_id, participant2_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновление матча через PUT (например, запись результата)
router.put('/:id', authenticateToken, restrictTo(['organizer', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { winner_id, score1, score2 } = req.body; // Заменили score на score1 и score2
    try {
        const result = await pool.query(
            'UPDATE matches SET winner_id = $1, score1 = $2, score2 = $3 WHERE id = $4 RETURNING *',
            [winner_id, score1, score2, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Матч не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Новый маршрут для обновления матча (соответствует фронтенду)
router.post('/:tournamentId/update-match', authenticateToken, restrictTo(['organizer', 'admin']), async (req, res) => {
    const { tournamentId } = req.params;
    const { matchId, winner_team_id, score1, score2 } = req.body;
    const userId = req.user.id;

    try {
        // Проверяем права администратора или создателя
        const adminCheck = await pool.query(
            `SELECT * FROM tournament_admins WHERE tournament_id = $1 AND admin_id = $2`,
            [tournamentId, userId]
        );
        const creatorCheck = await pool.query(
            `SELECT created_by FROM tournaments WHERE id = $1`,
            [tournamentId]
        );

        if (adminCheck.rows.length === 0 && creatorCheck.rows[0]?.created_by !== userId) {
            return res.status(403).json({ error: 'У вас нет прав для редактирования матча' });
        }

        // Проверяем существование матча
        const matchCheck = await pool.query(
            `SELECT * FROM matches WHERE id = $1 AND tournament_id = $2`,
            [matchId, tournamentId]
        );
        if (matchCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Матч не найден' });
        }

        // Обновляем матч
        const result = await pool.query(
            'UPDATE matches SET winner_id = $1, score1 = $2, score2 = $3 WHERE id = $4 AND tournament_id = $5 RETURNING *',
            [winner_team_id, score1, score2, matchId, tournamentId]
        );

        res.json({ message: 'Матч успешно обновлён', match: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удаление матча
router.delete('/:id', authenticateToken, restrictTo(['organizer', 'admin']), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM matches WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Матч не найден' });
        }
        res.json({ message: 'Матч удалён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
 
// Детали матча (турнирного или кастомного) + шаги пик/бан (если есть)
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const matchId = Number(id);
    if (!Number.isInteger(matchId)) return res.status(400).json({ error: 'Bad id' });
    const client = await pool.connect();
    try {
        const m = await client.query('SELECT * FROM matches WHERE id = $1', [matchId]);
        if (m.rows.length === 0) return res.status(404).json({ error: 'Матч не найден' });
        const match = m.rows[0];
        const steps = await client.query(
            'SELECT action_order, action_type, team_id, map_name, created_at FROM match_veto_steps WHERE match_id = $1 ORDER BY action_order ASC',
            [matchId]
        );
        return res.json({ success: true, match, veto_steps: steps.rows });
    } catch (e) {
        console.error('get match details error', e);
        return res.status(500).json({ error: 'Failed to load match' });
    } finally {
        client.release();
    }
});