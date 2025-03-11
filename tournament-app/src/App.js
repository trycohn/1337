import React, { useState } from 'react';
import TournamentAdmin from './TournamentAdmin';

function App() {
    const [selectedTournamentId, setSelectedTournamentId] = useState(null);

    return (
        <div className="App">
            <h1>Tournament Admin Dashboard</h1>
            <button onClick={() => setSelectedTournamentId(1)}>
                Выбрать турнир 1
            </button>
            <TournamentAdmin tournamentId={selectedTournamentId} />
        </div>
    );
}

export default App;