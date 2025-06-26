const { getTournamentChatMessages, getTournamentChatParticipants } = require('../../utils/tournament/chatHelpers');

class ChatService {
    /**
     * Получение сообщений чата турнира
     */
    static async getChatMessages(tournamentId, userId, options = {}) {
        console.log(`💬 ChatService: Получение сообщений чата турнира ${tournamentId}`);
        
        return await getTournamentChatMessages(tournamentId, userId, options);
    }

    /**
     * Получение участников чата турнира
     */
    static async getChatParticipants(tournamentId, userId) {
        console.log(`👥 ChatService: Получение участников чата турнира ${tournamentId}`);
        
        return await getTournamentChatParticipants(tournamentId, userId);
    }
}

module.exports = ChatService; 