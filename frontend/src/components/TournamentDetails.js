import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import api from '../axios';
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
  const [matches, setMatches] = useState([]); // Инициализация пустым массивом
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [inviteMethod, setInviteMethod] = useState('username');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedWinnerId, setSelectedWinnerId] = useState(null);
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false);
  const [matchScores, setMatchScores] = useState({ team1: 0, team2: 0 });

  // Загрузка данных пользователя и турнира
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
            .then((res) => setTeams(res.data || []))
            .catch((error) => console.error('Ошибка загрузки команд:', error));
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
        console.log('Loaded participants:', response.data.participants);
      } catch (error) {
        console.error('Ошибка загрузки турнира:', error);
      }
    };
    fetchTournament();
  }, [id]);

  // Проверка участия и статуса администратора
  useEffect(() => {
    if (tournament && user) {
      const participants = tournament.participants || [];
      const participating = participants.some(
        (p) =>
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

  // Функция для определения названия раунда
  const getRoundName = (round, totalRounds) => {
    if (round === -1) return 'Предварительный раунд';
    const roundsLeft = totalRounds - round - 1;
    if (roundsLeft === 0) return 'Финал';
    if (roundsLeft === 1) return 'Полуфинал';
    if (roundsLeft === 2) return 'Четвертьфинал';
    const stage = Math.pow(2, roundsLeft + 1);
    return `1/${stage} финала`;
  };

  // Подготовка данных матчей для сетки
  const games = useMemo(() => {
    if (!tournament || !Array.isArray(matches) || matches.length === 0) return [];

    const participantCount = tournament.participants?.length || 0;
    const totalRounds = Math.ceil(Math.log2(participantCount));

    return matches.map((match) => {
      const homeParticipant = match.team1_id
        ? (tournament.participants || []).find((p) => p.id === match.team1_id)
        : null;
      const visitorParticipant = match.team2_id
        ? (tournament.participants || []).find((p) => p.id === match.team2_id)
        : null;

      return {
        id: match.id.toString(),
        name: match.is_third_place_match ? 'Матч за 3-е место' : `Match ${match.match_number}`,
        tournamentRoundText: match.is_third_place_match
          ? 'Матч за 3-е место'
          : getRoundName(match.round, totalRounds),
        startTime: match.scheduled ? new Date(match.scheduled).toISOString() : new Date().toISOString(),
        state: match.winner_team_id ? 'DONE' : 'NO_PARTY',
        participants: [
          {
            id: match.team1_id ? match.team1_id.toString() : null,
            name: homeParticipant ? homeParticipant.name : 'TBD',
            isWinner: match.winner_team_id === match.team1_id,
            score: match.score1 || 0,
            resultText: null,
            status: null,
          },
          {
            id: match.team2_id ? match.team2_id.toString() : null,
            name: visitorParticipant ? visitorParticipant.name : 'TBD',
            isWinner: match.winner_team_id === match.team2_id,
            score: match.score2 || 0,
            resultText: null,
            status: null,
          },
        ],
        nextMatchId: match.next_match_id ? match.next_match_id.toString() : null,
        is_third_place_match: match.is_third_place_match || false,
      };
    });
    
  }, [matches, tournament]);

  // Участие в турнире
  const handleParticipate = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Пожалуйста, войдите, чтобы участвовать');
      return;
    }

    try {
      const payload =
        tournament.participant_type === 'solo'
          ? {}
          : { teamId: selectedTeam || null, newTeamName: selectedTeam ? null : newTeamName };
      const response = await api.post(`/api/tournaments/${id}/participate`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(response.data.message);
      const updatedTournament = await api.get(`/api/tournaments/${id}`);
      setTournament(updatedTournament.data);
      setIsParticipating(true);
      setNewTeamName('');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Ошибка при регистрации');
    }
  };

  // Отказ от участия
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

  // Добавление участника
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

  // Запрос прав администратора
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

  // Генерация сетки
  const handleGenerateBracket = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Пожалуйста, войдите, чтобы сгенерировать сетку');
      return;
    }

    if (!canGenerateBracket) {
      setMessage('У вас нет прав для генерации сетки или сетка уже сгенерирована');
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

  // Обновление данных матча
  const handleUpdateMatch = async (updatedMatch) => {
    const { matchId, winner_team_id, score1, score2 } = updatedMatch;
    console.log('Отправляемые данные:', { matchId, winner_team_id, score1, score2 });
  
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Пожалуйста, войдите, чтобы обновить результат');
      return;
    }
  
    try {
      const response = await api.post(
        `/api/tournaments/${id}/update-match`,
        { matchId, winner_team_id, score1, score2 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Ответ сервера:', response.data);
  
      const updatedTournament = await api.get(`/api/tournaments/${id}`);
      console.log('Обновлённый турнир:', updatedTournament.data);
  
      setTournament(updatedTournament.data);
      setMatches(updatedTournament.data.matches || []);
  
      setMessage(response.data.message);
      setSelectedMatch(null);
      setShowConfirmModal(false);
      setMatchScores({ team1: 0, team2: 0 });
    } catch (error) {
      setMessage(error.response?.data?.error || 'Ошибка при обновлении результата');
    }
  };

  const handleCloseModal = () => {
    setShowConfirmModal(false);
    setSelectedMatch(null);
    setSelectedWinnerId(null);
    setMatchScores({ team1: 0, team2: 0 });
  };

  // Подтверждение победителя
  const handleConfirmWinner = (action) => {
    if (action === 'yes') {
      const updatedMatch = {
        matchId: selectedMatch,
        winner_team_id: selectedWinnerId,
        score1: matchScores.team1,
        score2: matchScores.team2,
      };
      handleUpdateMatch(updatedMatch);
    }
    setSelectedMatch(null);
    setSelectedWinnerId(null);
    setShowConfirmModal(false);
    setMatchScores({ team1: 0, team2: 0 });
    handleCloseModal();
  };

  // Обработка клика по команде
  const handleTeamClick = (teamId, matchId) => {
    setSelectedMatch(matchId);
    setSelectedWinnerId(teamId);
    setShowConfirmModal(true);
  };

  // Отправка приглашения
  const handleInvite = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Пожалуйста, войдите, чтобы отправить приглашение');
      return;
    }
    try {
      const payload =
        inviteMethod === 'username' ? { username: inviteUsername } : { email: inviteEmail };
      const response = await api.post(`/api/tournaments/${id}/invite`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  // Определение победителей
  const finalMatch = matches.filter(
    (m) =>
      m.round === Math.max(...matches.map((m) => m.round)) &&
      m.match_number === Math.max(
        ...matches
          .filter(
            (m) => m.round === Math.max(...matches.map((m) => m.round)) && !m.is_third_place_match
          )
          .map((m) => m.match_number)
      )
  ).find((m) => m.match_number);
  const semiFinalMatches = matches.filter(
    (m) => m.round === Math.max(...matches.map((m) => m.round)) - 1
  );
  let winners = [];
  if (finalMatch && matches.length > 0) {
    const firstPlace = finalMatch.winner_team_id
      ? (tournament.participants || []).find((p) => p.id === finalMatch.winner_team_id)?.name
      : '';
    const secondPlace = finalMatch.winner_team_id
      ? (tournament.participants || []).find(
          (p) =>
            p.id !== finalMatch.winner_team_id &&
            (p.id === finalMatch.team1_id || p.id === finalMatch.team2_id)
        )?.name
      : '';
    winners = [[1, firstPlace], [2, secondPlace]];

    if (thirdPlaceMatch && semiFinalMatches.length >= 2) {
      const thirdPlaceMatchResult = matches.find((m) => m.is_third_place_match);
      const thirdPlace = thirdPlaceMatchResult?.winner_team_id
        ? (tournament.participants || []).find((p) => p.id === thirdPlaceMatchResult.winner_team_id)?.name
        : '';
      if (thirdPlace) winners.push([3, thirdPlace]);
    }
  }

  // Отрисовка турнирной сетки
  const renderBracket = (games) => {
    const rounds = {};
    games.forEach((match) => {
      const roundName = match.tournamentRoundText;
      if (!rounds[roundName]) rounds[roundName] = [];
      rounds[roundName].push(match);
    });

    return Object.entries(rounds).map(([roundName, roundMatches], index) => (
      <div key={index} className="round">
        <h4>{roundName}</h4>
        {roundMatches.map((match) => {
          const isSelected = selectedMatch === parseInt(match.id);
          return (
            <div
              key={match.id}
              className={`custom-seed ${isSelected ? 'selected' : ''}`}
              onClick={() =>
                canEditMatches &&
                match.state !== 'DONE' &&
                setSelectedMatch(isSelected ? null : parseInt(match.id))
              }
            >
              <div className="match-number">{match.name}</div>
              <div className="match-teams">
                <div
                  className={`team ${match.participants[0].isWinner ? 'winner' : 'loser'}`}
                  onClick={() => handleTeamClick(match.participants[0].id, match.id)}
                >
                  <span className="team-name">{match.participants[0].name.slice(0, 20)}</span>
                  <span className="team-score">
                    {match.participants[0].score > 0 ? match.participants[0].score : '-'}
                  </span>
                </div>
                <div
                  className={`team ${match.participants[1].isWinner ? 'winner' : 'loser'}`}
                  onClick={() => handleTeamClick(match.participants[1].id, match.id)}
                >
                  <span className="team-name">{match.participants[1].name.slice(0, 20)}</span>
                  <span className="team-score">
                    {match.participants[1].score > 0 ? match.participants[1].score : '-'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ));
  };

  return (
    <section className="tournament-details">
      <h2>
        {tournament.name} ({tournament.status === 'active' ? 'Активен' : 'Завершён'})
      </h2>
      <p>
        <strong>Описание:</strong> {tournament.description || 'Нет описания'}
      </p>
      <p>
        <strong>Формат:</strong> {tournament.format}
      </p>
      <p>
        <strong>Дата старта:</strong> {new Date(tournament.start_date).toLocaleDateString('ru-RU')}
      </p>
      {tournament.end_date && (
        <p>
          <strong>Дата окончания:</strong>{' '}
          {new Date(tournament.end_date).toLocaleDateString('ru-RU')}
        </p>
      )}
      <p>
        <strong>Участники ({tournament.participant_count || 0}):</strong>
      </p>
      <ul>
        {(tournament.participants || []).map((participant) => (
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
                  <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
                    <option value="">Создать новую команду</option>
                    {(teams || []).map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
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
            isParticipating &&
            matches.length === 0 && (
              <button onClick={handleWithdraw}>Отказаться от участия</button>
            )
          )}
          {isCreator && matches.length === 0 && (
            <div className="invite-participant">
              <h3>Выслать приглашение на турнир</h3>
              <select value={inviteMethod} onChange={(e) => setInviteMethod(e.target.value)}>
                <option value="username">По никнейму</option>
                <option value="email">По email</option>
              </select>
              {inviteMethod === 'username' ? (
                <input
                  type="text"
                  placeholder="Никнейм пользователя"
                  value={inviteUsername}
                  onChange={(e) => {
                    setInviteUsername(e.target.value);
                    setInviteEmail('');
                  }}
                />
              ) : (
                <input
                  type="email"
                  placeholder="Email пользователя"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setInviteUsername('');
                  }}
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
        <div className="custom-tournament-bracket">{renderBracket(games)}</div>
      ) : (
        <p>Сетка ещё не сгенерирована</p>
      )}
      {winners.length > 0 && (
        <div className="winners-list">
          <h3>Призёры турнира</h3>
          <ul>
            {winners.map(([place, name]) => (
              <li key={place}>
                {place} место: {name || 'Не определён'}
              </li>
            ))}
          </ul>
        </div>
      )}
{showConfirmModal && selectedMatch && (
  <div className="modal" onClick={handleCloseModal}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <h3>Подтверждение победителя</h3>
      <p>
        Победитель: <span className="winner-name">
          {games?.find((m) => m.id === selectedMatch.toString())?.participants?.find((p) => p.id === selectedWinnerId)?.name || 'Не определён'}
        </span>
      </p>
      <div className="score-inputs">
        <div className="score-container">
          <span className="participant-name">
            {games?.find((m) => m.id === selectedMatch.toString())?.participants[0]?.name || 'Участник 1'}
          </span>
          <input
            type="number"
            value={matchScores.team1}
            onChange={(e) => setMatchScores({ ...matchScores, team1: Number(e.target.value) })}
            className="score-input"
          />
        </div>
        <div className="score-container">
          <span className="participant-name">
            {games?.find((m) => m.id === selectedMatch.toString())?.participants[1]?.name || 'Участник 2'}
          </span>
          <input
            type="number"
            value={matchScores.team2}
            onChange={(e) => setMatchScores({ ...matchScores, team2: Number(e.target.value) })}
            className="score-input"
          />
        </div>
      </div>
      <div className="modal-buttons">
        <button onClick={() => handleConfirmWinner('yes')}>Подтвердить</button>
        <button onClick={handleCloseModal}>Отмена</button>
      </div>
    </div>
  </div>
)}

      {message && (
        <p className={message.includes('успешно') ? 'success' : 'error'}>{message}</p>
      )}
    </section>
  );
}

export default TournamentDetails;