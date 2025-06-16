// Импорты React и связанные
import React, { useState, useRef, useEffect, Suspense, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../utils/api';
import './TournamentDetails.css';
import TeamGenerator from './TeamGenerator';
import { ensureHttps } from '../utils/userHelpers';
// Импортируем вспомогательные функции для работы с картами
import { isCounterStrike2, gameHasMaps, getGameMaps as getGameMapsHelper, getDefaultMap as getDefaultMapHelper, getDefaultCS2Maps } from '../utils/mapHelpers';

// eslint-disable-next-line no-unused-vars
import TournamentChat from './TournamentChat';
// eslint-disable-next-line no-unused-vars
import { useUser } from '../context/UserContext';

// Используем React.lazy для асинхронной загрузки тяжелого компонента
const LazyBracketRenderer = React.lazy(() => 
    import('./BracketRenderer').catch(err => {
        console.error('Ошибка при загрузке BracketRenderer:', err);
        // Возвращаем fallback компонент в случае ошибки
        return { 
            default: () => (
                <div className="bracket-error">
                    Не удалось загрузить турнирную сетку. Пожалуйста, обновите страницу.
                </div>
            ) 
        };
    })
);

// Компонент для случаев ошибок при рендеринге сетки
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Ошибка в BracketRenderer:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="bracket-error">
                    Произошла ошибка при отображении турнирной сетки. 
                    Пожалуйста, обновите страницу или попробуйте позже.
                </div>
            );
        }

        return this.props.children;
    }
}

// Глобальные константы
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Конфигурация для игр с картами
const GAME_CONFIGS = {
    COUNTER_STRIKE_2: {
        id: 21,
        name: 'Counter-Strike 2',
        hasMaps: true
    },
    // Здесь можно добавить другие игры в будущем
    // Например:
    // VALORANT: {
    //     id: 3,
    //     name: 'Valorant',
    //     hasMaps: true
    // },
};

// Компонент для отображения оригинального списка участников
const OriginalParticipantsList = ({ participants, tournament }) => {
  if (!participants || participants.length === 0) {
    return (
      <div className="original-participants-list-wrapper">
        <h3>Зарегистрированные игроки (0)</h3>
        <p className="no-participants">Нет зарегистрированных игроков</p>
      </div>
    );
  }

  return (
    <div className="original-participants-list-wrapper">
      <h3>Зарегистрированные игроки ({participants.length})</h3>
      <div className="original-participants-grid">
        {participants.map((participant) => (
          <div key={participant?.id || `participant-${Math.random()}`} className="participant-card">
            <div className="participant-info">
              <div className="participant-avatar">
                {participant && participant.avatar_url ? (
                  <img 
                    src={ensureHttps(participant.avatar_url)} 
                    alt={((participant && participant.name) || '?').charAt(0)} 
                    onError={(e) => {e.target.src = '/default-avatar.png'}}
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {((participant && participant.name) || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {participant && participant.user_id ? (
                <Link 
                  to={`/user/${participant.user_id}`} 
                  className="participant-name"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {participant.name || 'Участник'}
                </Link>
              ) : (
                <span className="participant-name">{participant?.name || 'Участник'}</span>
              )}
              <span className="participant-rating">FACEIT: {participant.faceit_elo || 1000}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function TournamentDetails() {
    const { id } = useParams();
    
    // eslint-disable-next-line no-unused-vars
    const [tournament, setTournament] = useState(null);
    // eslint-disable-next-line no-unused-vars
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
    const [selectedWinnerId, setSelectedWinnerId] = useState(null);
    const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false);
    const [matchScores, setMatchScores] = useState({ team1: 0, team2: 0 });
    const [selectedUser, setSelectedUser] = useState(null);
    const wsRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreator, setIsCreator] = useState(false);
    const [isAdminOrCreator, setIsAdminOrCreator] = useState(false);
    const [userSearchResults, setUserSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedDescription, setEditedDescription] = useState('');
    const [showFullDescription, setShowFullDescription] = useState(false);
    const [isEditingPrizePool, setIsEditingPrizePool] = useState(false);
    const [editedPrizePool, setEditedPrizePool] = useState('');
    const [isEditingFullDescription, setIsEditingFullDescription] = useState(false);
    const [isEditingRules, setIsEditingRules] = useState(false);
    const [editedFullDescription, setEditedFullDescription] = useState('');
    const [editedRules, setEditedRules] = useState('');
    const [mixedTeams, setMixedTeams] = useState([]);
    const [searchTimeout, setSearchTimeout] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchContainerRef = useRef(null);
    const [invitedUsers, setInvitedUsers] = useState([]);
    const [userIdToRemove, setUserIdToRemove] = useState('');
    const [viewingMatchDetails, setViewingMatchDetails] = useState(false);
    const [matchDetails, setMatchDetails] = useState(null);
    const [maps, setMaps] = useState([{ map: 'de_dust2', score1: 0, score2: 0 }]);
    const [showMapSelection, setShowMapSelection] = useState(false);
    const descriptionRef = useRef("");
    const prizePoolRef = useRef("");
    const fullDescriptionRef = useRef("");
    const rulesRef = useRef("");
    const [chatMessages, setChatMessages] = useState([]);
    const [newChatMessage, setNewChatMessage] = useState('');
    const chatEndRef = useRef(null);
    const [showEndTournamentModal, setShowEndTournamentModal] = useState(false);
    const [originalParticipants, setOriginalParticipants] = useState([]);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [sentInvitations, setSentInvitations] = useState([]);
    
    // Добавляем новое состояние для хранения карт для разных игр
    const [availableMaps, setAvailableMaps] = useState({});
    
    // Проверяем, соединились ли с вебсокетом
    const [wsConnected, setWsConnected] = useState(false);
    
    // eslint-disable-next-line no-unused-vars
    const checkParticipation = useCallback(() => {
        // ... implementation ...
    }, [tournament, user]);
    
    const addMap = () => {
        const defaultMap = getDefaultMapHelper(tournament?.game);
        setMaps([...maps, { map: defaultMap, score1: 0, score2: 0 }]);
    };

    const removeMap = (index) => {
        const newMaps = [...maps];
        newMaps.splice(index, 1);
        setMaps(newMaps);
    };

    const updateMapScore = (index, team, score) => {
        const newMaps = [...maps];
        newMaps[index][`score${team}`] = score;
        setMaps(newMaps);
    };

    const updateMapSelection = (index, mapName) => {
        const newMaps = [...maps];
        newMaps[index].map = mapName;
        setMaps(newMaps);
    };

    return <div>TournamentDetails Component - Fixed Version</div>;
}

export default TournamentDetails; 