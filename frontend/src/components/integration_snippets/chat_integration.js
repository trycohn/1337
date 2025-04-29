import TournamentChat from './TournamentChat';

<TournamentChat 
    messages={chatMessages}
    newMessage={newChatMessage}
    onInputChange={handleChatInputChange}
    onSubmit={handleChatSubmit}
    onKeyPress={handleChatKeyPress}
    chatEndRef={chatEndRef}
    user={user}
/> 