// Импорты React и связанные
import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import api from '../utils/api';
import UserContext from '../context/UserContext';
import './TournamentDetails.css';
import BracketRenderer from './BracketRenderer';
import TeamGenerator from './TeamGenerator';
import { debounce } from 'lodash';
import { formatDate } from '../utils/dateHelpers';
import { ensureHttps } from '../utils/userHelpers';

// Импорт уведомлений и тостов
import { useNotification } from '../context/NotificationContext';
import { useToast } from './Notifications/ToastContext';

// Импортируем TournamentChat
import TournamentChat from './TournamentChat';

// Кастомные хуки контекстов - только один экземпляр каждого
import { useUser } from '../context/UserContext';
import { useTeam } from '../context/TeamContext';
import { useTournament } from '../context/TournamentContext';
import { useMatch } from '../context/MatchContext';
import { useParticipant } from '../context/ParticipantContext';
import { useInvitation } from '../context/InvitationContext';
import { useAdminRequest } from '../context/AdminRequestContext';
import { useRatingType } from '../context/RatingTypeContext';
import { useGame } from '../context/GameContext';
import { useStatus } from '../context/StatusContext';
import { useDescription } from '../context/DescriptionContext';
import { usePrizePool } from '../context/PrizePoolContext';
import { useRules } from '../context/RulesContext';
import { useFullDescription } from '../context/FullDescriptionContext';
import { useMixedTeams } from '../context/MixedTeamsContext';
import { useSearchResults } from '../context/SearchResultsContext';
import { useInvitedUsers } from '../context/InvitedUsersContext';
import { useViewingMatchDetails } from '../context/ViewingMatchDetailsContext';
import { useMatchDetails } from '../context/MatchDetailsContext';
import { useMaps } from '../context/MapsContext';
import { useShowMapSelection } from '../context/ShowMapSelectionContext';
import { useSearchQuery } from '../context/SearchQueryContext';
import { useAddParticipantName } from '../context/AddParticipantNameContext';
import { useAdminRequestStatus } from '../context/AdminRequestStatusContext';
import { useMatches } from '../context/MatchesContext';
import { useSelectedMatch } from '../context/SelectedMatchContext';
import { useSelectedWinnerId } from '../context/SelectedWinnerIdContext';
import { useThirdPlaceMatch } from '../context/ThirdPlaceMatchContext';
import { useMatchScores } from '../context/MatchScoresContext';
import { useSelectedUser } from '../context/SelectedUserContext';
import { useUserIdToRemove } from '../context/UserIdToRemoveContext';
import { useTournamentStatus } from '../context/TournamentStatusContext';
import { useTournamentFormat } from '../context/TournamentFormatContext';
import { useCanRequestAdmin } from '../context/CanRequestAdminContext';
import { useCanGenerateBracket } from '../context/CanGenerateBracketContext';
import { useCanEditMatches } from '../context/CanEditMatchesContext';
import { useUserSearchResults } from '../context/UserSearchResultsContext';
import { useIsSearching } from '../context/IsSearchingContext';
import { useSearchContainerRef } from '../context/SearchContainerRefContext';
import { useIsUserParticipant } from '../context/IsUserParticipantContext';
import { useIsInvitationSent } from '../context/IsInvitationSentContext';
import { useIsAdminOrCreator } from '../context/IsAdminOrCreatorContext';
import { useInviteMethod } from '../context/InviteMethodContext';
import { useInviteUsername } from '../context/InviteUsernameContext';
import { useInviteEmail } from '../context/InviteEmailContext';
import { useShowConfirmModal } from '../context/ShowConfirmModalContext';
import { useShowEndTournamentModal } from '../context/ShowEndTournamentModalContext';
import { useClearInvitationCache } from '../context/ClearInvitationCacheContext';
import { useClearAllInvitationsCache } from '../context/ClearAllInvitationsCacheContext';

// Кастомные хуки для обработчиков
import { useHandleClearMatchResults } from '../context/HandleClearMatchResultsContext';
import { useHandleUpdateMatch } from '../context/HandleUpdateMatchContext';
import { useHandleCloseModal } from '../context/HandleCloseModalContext';
import { useHandleTeamClick } from '../context/HandleTeamClickContext';
import { useHandleRegenerateBracket } from '../context/HandleRegenerateBracketContext';
import { useHandleEndTournament } from '../context/HandleEndTournamentContext';
import { useHandleConfirmEndTournament } from '../context/HandleConfirmEndTournamentContext';
import { useHandleRequestAdmin } from '../context/HandleRequestAdminContext';
import { useHandleAddParticipant } from '../context/HandleAddParticipantContext';
import { useHandleFormTeams } from '../context/HandleFormTeamsContext';
import { useHandleStartTournament } from '../context/HandleStartTournamentContext';
import { useHandleParticipate } from '../context/HandleParticipateContext';
import { useHandleWithdraw } from '../context/HandleWithdrawContext';
import { useHandleInvite } from '../context/HandleInviteContext';
import { useHandleInviteUser } from '../context/HandleInviteUserContext';
import { useHandleUserSearchWithDelay } from '../context/HandleUserSearchWithDelayContext';
import { useFormatLastOnline } from '../context/FormatLastOnlineContext';
import { useHandleAddParticipantName } from '../context/HandleAddParticipantNameContext';
import { useHandleGenerateBracket } from '../context/HandleGenerateBracketContext';
import { useHandleViewMatchDetails } from '../context/HandleViewMatchDetailsContext';
import { useHandleValidateInvitationCache } from '../context/HandleValidateInvitationCacheContext'; 