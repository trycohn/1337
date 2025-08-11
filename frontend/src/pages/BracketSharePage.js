import React, { useMemo, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import BracketRenderer from '../components/BracketRenderer';
import { useTournamentData } from '../hooks/tournament/useTournamentData';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function BracketSharePage() {
  const { id } = useParams();
  const query = useQuery();
  const focusMatchId = query.get('match');
  const { tournament, matches, loading, error } = useTournamentData(id);

  const pageUrl = `${window.location.origin}/tournaments/${id}/bracket${focusMatchId ? `?match=${focusMatchId}` : ''}`;

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
    return matches.map((m) => ({
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
          resultText: m.score1 !== null ? String(m.score1) : null,
          isWinner: m.winner_team_id === m.team1_id,
          status: m.team1_id ? 'PLAYED' : 'NO_SHOW',
          name: m.team1_name || 'TBD',
          score: m.score1,
          avatarUrl: null
        },
        {
          id: m.team2_id ? String(m.team2_id) : 'tbd',
          resultText: m.score2 !== null ? String(m.score2) : null,
          isWinner: m.winner_team_id === m.team2_id,
          status: m.team2_id ? 'PLAYED' : 'NO_SHOW',
          name: m.team2_name || 'TBD',
          score: m.score2,
          avatarUrl: null
        }
      ]
    }));
  }, [matches]);

  const title = tournament?.name ? `${tournament.name} — Турнирная сетка` : 'Турнирная сетка';
  const description = tournament?.description ? String(tournament.description).slice(0, 180) : 'Смотри турнирную сетку на 1337community.com';

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh' }}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Хедер с меню уже рендерится в Layout */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #111', background: '#000' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to={`/tournaments/${id}`} style={{ color: '#fff', textDecoration: 'none', border: '1px solid #ff0000', padding: '8px 12px', borderRadius: 8, background: '#111' }}>К турниру</Link>
          <button onClick={handleShare} style={{ color: '#fff', border: '1px solid #ff0000', padding: '8px 12px', borderRadius: 8, background: '#111' }}>Поделиться</button>
          <span style={{ color: '#999' }}>{pageUrl}</span>
        </div>
        {tournament && (
          <div style={{ marginTop: 12, color: '#ccc' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{tournament.name}</div>
            {tournament.start_date && <div>Старт: {new Date(tournament.start_date).toLocaleString()}</div>}
          </div>
        )}
      </div>

      <div style={{ background: '#000' }}>
        {loading && (
          <div style={{ padding: 24 }}>Загрузка…</div>
        )}
        {error && (
          <div style={{ padding: 24, color: '#ff6b6b' }}>{String(error)}</div>
        )}
        {!loading && !error && Array.isArray(games) && games.length > 0 && (
          <div style={{ padding: 20 }}>
            <BracketRenderer 
              games={games}
              tournament={tournament}
              onEditMatch={null}
              canEditMatches={false}
              onMatchClick={null}
              readOnly
              focusMatchId={focusMatchId}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default BracketSharePage;


