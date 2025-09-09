const { asyncHandler } = require('../../utils/asyncHandler');
const FullMixService = require('../../services/tournament/FullMixService');

class FullMixController {
    static start = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const { wins_to_win, rating_mode } = req.body || {};
        const result = await FullMixService.start(tournamentId, req.user.id, { wins_to_win, rating_mode });
        res.json({ success: true, ...result });
    });

    static generateNext = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const result = await FullMixService.generateNextRound(tournamentId);
        res.json({ success: true, ...result });
    });

    static completeRound = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const { round } = req.body || {};
        const result = await FullMixService.completeRound(tournamentId, parseInt(round));
        res.json({ success: true, ...result });
    });

    static standings = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const standings = await FullMixService.calculateStandings(tournamentId);
        res.json({ success: true, standings });
    });

    static snapshots = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const items = await FullMixService.listSnapshots(tournamentId);
        res.json({ success: true, items });
    });

    static getRound = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const round = parseInt(req.params.round);
        const item = await FullMixService.getSnapshot(tournamentId, round);
        res.json({ success: true, item });
    });

    static approve = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        const round = parseInt(req.params.round);
        const { approveTeams, approveMatches } = req.body || {};
        const result = await FullMixService.approveRound(tournamentId, round, { approveTeams, approveMatches });
        res.json({ success: true, ...result });
    });

    static settings = asyncHandler(async (req, res) => {
        const tournamentId = parseInt(req.params.id);
        if (req.method === 'GET') {
            const settings = await FullMixService.getSettings(tournamentId);
            return res.json({ success: true, settings });
        }
        if (req.method === 'PUT') {
            const { wins_to_win, rating_mode } = req.body || {};
            const settings = await FullMixService.upsertSettings(tournamentId, { wins_to_win, rating_mode });
            return res.json({ success: true, settings });
        }
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    });
}

module.exports = FullMixController;


