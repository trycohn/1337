import React, { useMemo, useCallback, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import BracketRenderer from '../components/BracketRenderer';
import BracketCompactView from '../components/BracketCompactView';
import { useTournamentData } from '../hooks/tournament/useTournamentData';
import './BracketSharePage.css';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function BracketSharePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const query = useQuery();
  const focusMatchId = query.get('match');
  const viewMode = (query.get('view') || 'classic').toLowerCase();
  const { tournament, matches, loading, error } = useTournamentData(id);

  // Разрешаем имена участников/команд из данных турнира, если в match.*_name отсутствуют
  const idToDisplayName = useMemo(() => {
    const map = new Map();
    if (tournament?.participants && Array.isArray(tournament.participants)) {
      tournament.participants.forEach((p) => {
        if (p && p.id != null) {
          const name = (p.name || p.username || '').trim();
          map.set(Number(p.id), name || 'TBD');
        }
      });
    }
    if (tournament?.teams && Array.isArray(tournament.teams)) {
      tournament.teams.forEach((t) => {
        if (t && t.id != null) {
          const name = (t.name || '').trim();
          map.set(Number(t.id), name || 'TBD');
        }
      });
    }
    return map;
  }, [tournament]);

  const buildUrl = (next = {}) => {
    const params = new URLSearchParams(location.search);
    if (focusMatchId) params.set('match', focusMatchId);
    params.set('view', next.view || viewMode);
    const qs = params.toString();
    return `${window.location.origin}/tournaments/${id}/bracket${qs ? `?${qs}` : ''}`;
  };
  const pageUrl = buildUrl();

  const handleShare = useCallback(async () => {
    const title = tournament?.name ? `${tournament.name} — Турнирная сетка` : 'Турнирная сетка';
    const text = tournament?.description ? tournament.description : 'Смотри турнирную сетку на 1337community.com';

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: pageUrl });
      } catch (e) {
        /* noop */
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(pageUrl);
      alert('Ссылка скопирована в буфер обмена');
    } catch (e) {
      alert('Не удалось скопировать ссылку');
    }
  }, [pageUrl, tournament]);

  const games = useMemo(() => {
    if (!Array.isArray(matches)) return [];
    return matches.map((m) => {
      const team1Name = (m.team1_name && m.team1_name.trim()) || (m.team1_id != null ? idToDisplayName.get(Number(m.team1_id)) : null) || 'TBD';
      const team2Name = (m.team2_name && m.team2_name.trim()) || (m.team2_id != null ? idToDisplayName.get(Number(m.team2_id)) : null) || 'TBD';

      return {
        id: String(m.id),
        nextMatchId: m.next_match_id ? String(m.next_match_id) : null,
        tournamentRoundText: `Раунд ${m.round || '?'}`,
        startTime: m.scheduled_time || '',
        state: m.status === 'completed' || m.winner_team_id ? 'DONE' : (m.team1_id && m.team2_id ? 'READY' : 'SCHEDULED'),
        status: m.status,
        name: m.name || `Матч ${m.tournament_match_number || m.match_number || m.id}`,
        bracket_type: m.bracket_type || 'winner',
        round: m.round !== undefined ? m.round : 0,
        is_third_place_match: (m.bracket_type && m.bracket_type === 'placement') || false,
        tournament_match_number: m.tournament_match_number,
        match_number: m.match_number,
        maps_data: m.maps_data || [],
        participants: [
          {
            id: m.team1_id ? String(m.team1_id) : 'tbd',
            resultText: m.score1 !== null && m.score1 !== undefined ? String(m.score1) : null,
            isWinner: m.winner_team_id === m.team1_id,
            status: m.team1_id ? 'PLAYED' : 'NO_SHOW',
            name: team1Name,
            score: m.score1,
            avatarUrl: null
          },
          {
            id: m.team2_id ? String(m.team2_id) : 'tbd',
            resultText: m.score2 !== null && m.score2 !== undefined ? String(m.score2) : null,
            isWinner: m.winner_team_id === m.team2_id,
            status: m.team2_id ? 'PLAYED' : 'NO_SHOW',
            name: team2Name,
            score: m.score2,
            avatarUrl: null
          }
        ]
      };
    });
  }, [matches, idToDisplayName]);

  const title = tournament?.name ? `${tournament.name} — Турнирная сетка` : 'Турнирная сетка';
  const description = tournament?.description ? String(tournament.description).slice(0, 180) : 'Смотри турнирную сетку на 1337community.com';

  // Автопрокрутка к фокусному матчу
  useEffect(() => {
    if (!focusMatchId) return;
    const el = document.querySelector(`[data-match-id="${focusMatchId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [focusMatchId, viewMode]);

  return (
    <div className="2.0-bracket-share-page" style={{ background: '#000', minHeight: '100vh' }}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
      </Helmet>
      {/* Чистый режим: убраны все локальные хедеры/герои/навигация */}

      <div className="2.0-bracket-share-content">
        {loading && (
          <div style={{ padding: 24 }}>Загрузка…</div>
        )}
        {error && (
          <div style={{ padding: 24, color: '#ff6b6b' }}>{String(error)}</div>
        )}
        {!loading && !error && Array.isArray(games) && games.length > 0 && (
          <div>
            {viewMode === 'compact' ? (
              <BracketCompactView games={games} tournament={tournament} focusMatchId={focusMatchId} />
            ) : (
              <BracketRenderer 
                games={games}
                tournament={tournament}
                onEditMatch={null}
                canEditMatches={false}
                onMatchClick={null}
                readOnly
                focusMatchId={focusMatchId}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BracketSharePage;


