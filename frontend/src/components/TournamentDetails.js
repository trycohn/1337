import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../axios';
import { Bracket } from 'react-brackets';
import './Home.css';

function TournamentDetails() {
  const { id } = useParams();
  const [tournament, setTournament] = useState(null);
  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [message, setMessage] = useState('');
  const [isParticipating, setIsParticipating] = useState(false);
  const [addParticipantName, setAddParticipantName] = useState('');
  const [adminRequestStatus, setAdminRequestStatus] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [inviteMethod, setInviteMethod] = useState('username');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedWinnerId, setSelectedWinnerId] = useState(null);
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api
        .get('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          setUser(response.data);
          api
            .get(`/api/teams?userId=${response.data.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .then((res) => setTeams(res.data));
        })
        .catch((error) => console.error('Ошибка загрузки пользователя:', error));
    }

    const fetchTournament = async () => {
      console.log('Fetching tournament data for id:', id);
      try {
        const response = await api.get(`/api/tournaments/${id}`);
        setTournament(response.data);
        setMatches(response.data.matches || []);
        console.log('Loaded matches:', response.data.matches);
      } catch (error) {
        console.error('Ошибка загрузки турнира:', error);
      }
    };
    fetchTournament();
  }, [id]);

  useEffect(() => {
    if (tournament && user) {
      const participants = tournament.participants;
      const participating = participants.some(p =>
        (tournament.participant_type === 'solo' && p.user_id === user.id) ||
        (tournament.participant_type === 'team' && p.creator_id === user.id)
      );
      setIsParticipating(participating);

      if (localStorage.getItem('token')) {
        api
          .get(`/api/tournaments/${id}/admin-request-status`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          })
          .then((response) => setAdminRequestStatus(response.data.status))
          .catch((error) => console.error('Ошибка загрузки статуса администратора:', error));
      }
    }
  }, [tournament, user, id]);

  const handleParticipate = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Пожалуйста, войдите, чтобы участвовать');
      return;
    }

    try {
      const payload = tournament.participant_type === 'solo'
        ? {}
        : { teamId: selectedTeam || null, newTeamName: selectedTeam ? null : newTeamName };
      const response = await api.post(
        `/api/tournaments/${id}/participate`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(response.data.message);
      const updatedTournament = await api.get(`/api/tournaments/${id}`);
      setTournament(updatedTournament.data);
      setIsParticipating(true);
      setNewTeamName('');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Ошибка при регистрации');
    }
  };

  const handleWithdraw = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await api.post(
        `/api/tournaments/${id}/withdraw`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(response.data.message);
      const updatedTournament = await api.get(`/api/tournaments/${id}`);
      setTournament(updatedTournament.data);
      setIsParticipating(false);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Ошибка при отказе');
    }
  };

  const handleAddParticipant = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Пожалуйста, войдите, чтобы добавить участника');
      return;
    }

    try {
      const response = await api.post(
        `/api/tournaments/${id}/add-participant`,
        { participantName: addParticipantName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(response.data.message);
      const updatedTournament = await api.get(`/api/tournaments/${id}`);
      setTournament(updatedTournament.data);
      setAddParticipantName('');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Ошибка при добавлении участника');
    }
  };

  const handleRequestAdmin = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Пожалуйста, войдите, чтобы запросить права администратора');
      return;
    }

    try {
      const response = await api.post(
        `/api/tournaments/${id}/request-admin`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(response.data.message);
      setAdminRequestStatus('pending');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Ошибка при запросе прав администратора');
    }
  };

  const handleGenerateBracket = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Пожалуйста, войдите, чтобы сгенерировать сетку');
      return;
    }

    try {
      const response = await api.post(
        `/api/tournaments/${id}/generate-bracket`,
        { thirdPlaceMatch },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(response.data.message);
      const updatedTournament = await api.get(`/api/tournaments/${id}`);
      setTournament(updatedTournament.data);
      setMatches(updatedTournament.data.matches || []);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Ошибка при генерации сетки');
    }
  };

  const handleUpdateMatch = async (matchId, winner_team_id) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Пожалуйста, войдите, чтобы обновить результат');
      return;
    }

    console.log(`Sending request to: /api/tournaments/${id}/update-match`);

    try {
      const response = await api.post(
        `/api/tournaments/${id}/update-match`,
        { matchId, winner_team_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(response.data.message);
      const updatedTournament = await api.get(`/api/tournaments/${id}`);
      setTournament(updatedTournament.data);
      setMatches(updatedTournament.data.matches || []);
      setSelectedMatch(null);
      setShowConfirmModal(false);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Ошибка при обновлении результата');
    }
  };

  const handleConfirmWinner = (answer) => {
    if (answer === 'yes' && selectedWinnerId) {
      handleUpdateMatch(selectedMatch, selectedWinnerId);
    } else {
      setShowConfirmModal(false);
      setSelectedWinnerId(null);
      setSelectedMatch(null);
    }
  };

  const handleTeamClick = (teamId, matchId) => {
    if (canEditMatches && selectedMatch === null && !matches.find(m => m.id === matchId)?.winner_team_id) {
      setSelectedMatch(matchId);
      setSelectedWinnerId(teamId);
      setShowConfirmModal(true);
    }
  };

  const handleInvite = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Пожалуйста, войдите, чтобы отправить приглашение');
      return;
    }
    try {
      const payload = inviteMethod === 'username' ? { username: inviteUsername } : { email: inviteEmail };
      const response = await api.post(
        `/api/tournaments/${id}/invite`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(response.data.message);
      setInviteUsername('');
      setInviteEmail('');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Ошибка при отправке приглашения');
    }
  };

  if (!tournament) return <p>Загрузка...</p>;

  const isCreator = user && tournament.created_by === user.id;
  const canRequestAdmin = user && !isCreator && !adminRequestStatus;
  const canGenerateBracket = user && (isCreator || adminRequestStatus === 'accepted') && matches.length === 0;
  const canEditMatches = user && (isCreator || adminRequestStatus === 'accepted');

  // Определение призёров
  const finalMatch = matches.filter(m => m.round === Math.max(...matches.map(m => m.round)) && m.match_number === Math.max(...matches.filter(m => m.round === Math.max(...matches.map(m => m.round)) && !m.is_third_place_match).map(m => m.match_number))).find(m => m.match_number);
  const semiFinalMatches = matches.filter(m => m.round === Math.max(...matches.map(m => m.round)) - 1);
  let winners = [];
  if (finalMatch && matches.length > 0) {
    const firstPlace = finalMatch.winner_team_id
      ? tournament.participants.find(p => p.id === finalMatch.winner_team_id)?.name
      : '';
    const secondPlace = finalMatch.winner_team_id
      ? tournament.participants.find(p => p.id !== finalMatch.winner_team_id && (p.id === finalMatch.team1_id || p.id === finalMatch.team2_id))?.name
      : '';
    winners = [[1, firstPlace], [2, secondPlace]];

    if (thirdPlaceMatch && semiFinalMatches.length >= 2) {
      const thirdPlaceMatchResult = matches.find(m => m.round === Math.max(...matches.map(m => m.round)) && m.is_third_place_match);
      const thirdPlace = thirdPlaceMatchResult?.winner_team_id
        ? tournament.participants.find(p => p.id === thirdPlaceMatchResult.winner_team_id)?.name
        : '';
      if (thirdPlace) winners.push([3, thirdPlace]);
    }
  }

  const rounds = [];
  const totalRounds = Math.max(...matches.map(m => m.round));
  const matchMap = new Map();
  matches.forEach(match => {
    matchMap.set(match.id, match);
  });

  for (let round = 0; round <= totalRounds; round++) {
    const roundMatches = matches.filter(match => match.round === round && !match.is_third_place_match).map(match => {
      const teams = [];
      if (round === 0) {
        teams.push({
          id: match.team1_id,
          name: match.team1_id ? tournament.participants.find(p => p.id === match.team1_id)?.name : 'TBD'
        });
        teams.push({
          id: match.team2_id,
          name: match.team2_id ? tournament.participants.find(p => p.id === match.team2_id)?.name : 'TBD'
        });
      } else {
        if (match.team1_id) {
          teams.push({
            id: match.team1_id,
            name: tournament.participants.find(p => p.id === match.team1_id)?.name
          });
        } else {
          const prevRound = round - 1;
          const prevMatches = matches.filter(m => m.round === prevRound);
          const matchIndex = matches.filter(m => m.round === round && !m.is_third_place_match).findIndex(m => m.id === match.id);
          const prevMatchIndex1 = matchIndex * 2;
          const prevMatch1 = prevMatches[prevMatchIndex1];
          if (prevMatch1) {
            teams.push({
              id: null,
              name: prevMatch1.winner_team_id
                ? tournament.participants.find(p => p.id === prevMatch1.winner_team_id)?.name
                : `Победитель матча ${prevMatch1.match_number}`
            });
          } else {
            teams.push({ id: null, name: '' });
          }
        }

        if (match.team2_id) {
          teams.push({
            id: match.team2_id,
            name: tournament.participants.find(p => p.id === match.team2_id)?.name
          });
        } else {
          const prevRound = round - 1;
          const prevMatches = matches.filter(m => m.round === prevRound);
          const matchIndex = matches.filter(m => m.round === round && !m.is_third_place_match).findIndex(m => m.id === match.id);
          const prevMatchIndex2 = matchIndex * 2 + 1;
          const prevMatch2 = prevMatches[prevMatchIndex2];
          if (prevMatch2) {
            teams.push({
              id: null,
              name: prevMatch2.winner_team_id
                ? tournament.participants.find(p => p.id === prevMatch2.winner_team_id)?.name
                : `Победитель матча ${prevMatch2.match_number}`
            });
          } else {
            teams.push({ id: null, name: '' });
          }
        }
      }

      return {
        id: match.id,
        teams,
        score: [match.score1 || 0, match.score2 || 0],
        winner: match.winner_team_id ? tournament.participants.find(p => p.id === match.winner_team_id)?.name : null,
        match_number: match.match_number,
      };
    });

    if (roundMatches.length > 0) {
      rounds.push({
        title: round === 0 ? 'Предварительный раунд' : `Раунд ${round}`,
        seeds: roundMatches,
      });
    }
  }

  const thirdPlaceMatchDisplay = thirdPlaceMatch && matches.length > 0 && semiFinalMatches.length >= 2
    ? matches.find(m => m.is_third_place_match)
    : null;

  const CustomSeed = ({ seed }) => {
    const isSelected = selectedMatch === seed.id;

    return (
      <div
        className={`custom-seed ${isSelected ? 'selected' : ''}`}
        onClick={() => canEditMatches && !seed.winner && setSelectedMatch(isSelected ? null : seed.id)}
      >
        <div className="match-number">{seed.match_number}</div>
        <div className="match-teams">
          <div
            className={`team ${seed.winner === seed.teams[0].name ? 'winner' : 'loser'}`}
            onClick={(e) => {
              e.stopPropagation();
              handleTeamClick(seed.teams[0].id, seed.id);
            }}
          >
            {seed.teams[0].name?.slice(0, 20) || ''} {seed.score[0] > 0 && `(${seed.score[0]})`}
          </div>
          <div
            className={`team ${seed.winner === seed.teams[1].name ? 'winner' : 'loser'}`}
            onClick={(e) => {
              e.stopPropagation();
              handleTeamClick(seed.teams[1].id, seed.id);
            }}
          >
            {seed.teams[1].name?.slice(0, 20) || ''} {seed.score[1] > 0 && `(${seed.score[1]})`}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="tournament-details">
      <h2>{tournament.name} ({tournament.status === 'active' ? 'Активен' : 'Завершён'})</h2>
      <p><strong>Описание:</strong> {tournament.description || 'Нет описания'}</p>
      <p><strong>Формат:</strong> {tournament.format}</p>
      <p><strong>Дата старта:</strong> {new Date(tournament.start_date).toLocaleDateString('ru-RU')}</p>
      {tournament.end_date && (
        <p><strong>Дата окончания:</strong> {new Date(tournament.end_date).toLocaleDateString('ru-RU')}</p>
      )}
      <p><strong>Участники ({tournament.participant_count}):</strong></p>
      <ul>
        {tournament.participants.map((participant) => (
          <li key={participant.id}>{participant.name || `Участник ${participant.id}`}</li>
        ))}
      </ul>
      {user && tournament.status === 'active' && (
        <div className="participation-controls">
          {!isParticipating && matches.length === 0 ? (
            <>
              {tournament.participant_type === 'team' && (
                <div className="team-selection">
                  <label>Выберите команду или создайте новую:</label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                  >
                    <option value="">Создать новую команду</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  {!selectedTeam && (
                    <input
                      type="text"
                      placeholder="Название новой команды"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                    />
                  )}
                </div>
              )}
              <button onClick={handleParticipate}>Участвовать в турнире</button>
            </>
          ) : (
            isParticipating && matches.length === 0 && <button onClick={handleWithdraw}>Отказаться от участия</button>
          )}
          {isCreator && matches.length === 0 && (
            <div className="invite-participant">
              <h3>Выслать приглашение на турнир</h3>
              <select
                value={inviteMethod}
                onChange={(e) => setInviteMethod(e.target.value)}
              >
                <option value="username">По никнейму</option>
                <option value="email">По email</option>
              </select>
              {inviteMethod === 'username' ? (
                <input
                  type="text"
                  placeholder="Никнейм пользователя"
                  value={inviteUsername}
                  onChange={(e) => { setInviteUsername(e.target.value); setInviteEmail(''); }}
                />
              ) : (
                <input
                  type="email"
                  placeholder="Email пользователя"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteUsername(''); }}
                />
              )}
              <button onClick={handleInvite}>Пригласить</button>
            </div>
          )}
          {(isCreator || adminRequestStatus === 'accepted') && matches.length === 0 && (
            <div className="add-participant">
              <h3>Добавить неавторизованного участника</h3>
              <input
                type="text"
                placeholder="Имя участника"
                value={addParticipantName}
                onChange={(e) => setAddParticipantName(e.target.value)}
              />
              <button onClick={handleAddParticipant}>Добавить</button>
            </div>
          )}
          {canRequestAdmin && (
            <button onClick={handleRequestAdmin}>Администрировать турнир</button>
          )}
          {canGenerateBracket && (
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={thirdPlaceMatch}
                  onChange={(e) => setThirdPlaceMatch(e.target.checked)}
                />{' '}
                Нужен матч за третье место?
              </label>
              <button onClick={handleGenerateBracket}>Сгенерировать сетку</button>
            </div>
          )}
        </div>
      )}
      <h3>Турнирная сетка</h3>
      {matches.length > 0 ? (
        <>
          <Bracket rounds={rounds} renderSeedComponent={CustomSeed} />
          {thirdPlaceMatch && thirdPlaceMatchDisplay && (
            <div>
              <h4>Матч за 3-е место</h4>
              <CustomSeed seed={{
                id: thirdPlaceMatchDisplay.id,
                teams: [
                  { id: thirdPlaceMatchDisplay.team1_id, name: thirdPlaceMatchDisplay.team1_id ? tournament.participants.find(p => p.id === thirdPlaceMatchDisplay.team1_id)?.name : 'Проигравший матч 2' },
                  { id: thirdPlaceMatchDisplay.team2_id, name: thirdPlaceMatchDisplay.team2_id ? tournament.participants.find(p => p.id === thirdPlaceMatchDisplay.team2_id)?.name : 'Проигравший матч 3' },
                ],
                score: [thirdPlaceMatchDisplay.score1 || 0, thirdPlaceMatchDisplay.score2 || 0],
                winner: thirdPlaceMatchDisplay.winner_team_id ? tournament.participants.find(p => p.id === thirdPlaceMatchDisplay.winner_team_id)?.name : null,
                match_number: thirdPlaceMatchDisplay.match_number,
              }} />
            </div>
          )}
        </>
      ) : (
        <p>Сетка ещё не сгенерирована</p>
      )}
      {winners.length > 0 && (
        <div className="winners-list">
          <h3>Призёры турнира</h3>
          <ul>
            {winners.map(([place, name]) => (
              <li key={place}>{place} место: {name || 'Не определён'}</li>
            ))}
          </ul>
        </div>
      )}
      {showConfirmModal && (
        <div className="modal" onClick={(e) => {
          if (e.target.className === 'modal') {
            setShowConfirmModal(false);
            setSelectedWinnerId(null);
            setSelectedMatch(null);
          }
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Победитель матча {matches.find(m => m.id === selectedMatch)?.match_number}?</h3>
            <p>Вы уверены, что победитель — {tournament.participants.find(p => p.id === selectedWinnerId)?.name || 'TBD'}?</p>
            <button onClick={() => handleConfirmWinner('yes')}>Да</button>
            <button onClick={() => handleConfirmWinner('no')}>Нет</button>
          </div>
        </div>
      )}
      {message && <p className={message.includes('успешно') ? 'success' : 'error'}>{message}</p>}
    </section>
  );
}

export default TournamentDetails;