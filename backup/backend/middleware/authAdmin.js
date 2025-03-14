const db = require('../db');

async function checkTournamentAdmin(req, res, next) {
    const userId = req.user.id; // ID пользователя из JWT-токена
    const tournamentId = req.params.id;
    try {
        const [tournament] = await db.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        if (tournament.created_by === userId) {
            return next(); // Пользователь — создатель
        }
        const admins = await db.query('SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2', [tournamentId, userId]);
        if (admins.length > 0) {
            return next(); // Пользователь — администратор
        }
        res.status(403).json({ error: 'Нет доступа' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка базы данных' });
    }
}

module.exports = checkTournamentAdmin;