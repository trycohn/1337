<div className="tournament-layout">
    <div className="tournament-main">
        {/* ... existing content ... */}
    </div>
    
    <TournamentChat 
        messages={chatMessages}
        newMessage={newChatMessage}
        onInputChange={handleChatInputChange}
        onSubmit={handleChatSubmit}
        onKeyPress={handleChatKeyPress}
        chatEndRef={chatEndRef}
        user={user}
    />
</div> 