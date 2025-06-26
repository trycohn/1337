const ChatService = require('../../services/tournament/ChatService');
const { asyncHandler } = require('../../utils/asyncHandler');

class ChatController {
    // 💬 Получение сообщений чата турнира
    static getChatMessages = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        const messages = await ChatService.getChatMessages(
            parseInt(id),
            req.user.id,
            { limit: parseInt(limit), offset: parseInt(offset) }
        );
        
        res.json(messages);
    });

    // 👥 Получение участников чата турнира
    static getChatParticipants = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const participants = await ChatService.getChatParticipants(
            parseInt(id),
            req.user.id
        );
        
        res.json(participants);
    });
}

module.exports = ChatController; 