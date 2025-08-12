import React, { useMemo, useCallback, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
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
  const query = useQuery();
  const focusMatchId = query.get('match');
  const viewMode = (query.get('view') || 'classic').toLowerCase();
  const { tournament, matches, loading, error } = useTournamentData(id);

  const buildUrl = (next = {}) => {
    const params = new URLSearchParams(window.location.search);
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

  // Автопрокрутка к фокусному матчу
  useEffect(() => {
    if (!focusMatchId) return;
    const el = document.querySelector(`[data-match-id="${focusMatchId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [focusMatchId, viewMode]);

  return (
    <div className="2.0-bracket-share-page">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Хедер с меню уже рендерится в Layout */}
      <div className="2.0-bracket-share-header">
        {/* 1-2. Верхние две части (липкий глобальный хедер рендерится в Layout), здесь — страничный тулбар + блок инфо на одном фоне */}
        <div
          className="2.0-bracket-share-hero"
          style={{
            background: `#000 url(${process.env.PUBLIC_URL || ''}/images/figma/hero-bg-585a9d.png) center/cover no-repeat`
          }}
        >
          <div className="2.0-bracket-share-hero-inner">
            <div className="2.0-bracket-share-toolbar">
              <Link to={`/tournaments/${id}`} className="2.0-bracket-share-link">К турниру</Link>
              <button onClick={handleShare} className="2.0-bracket-share-button">Поделиться</button>
              <div className="2.0-bracket-share-segment" role="tablist" aria-label="Переключатель вида">
                <button
                  role="tab"
                  aria-selected={viewMode === 'classic'}
                  onClick={() => {
                    const url = buildUrl({ view: 'classic' });
                    window.history.replaceState(null, '', url);
                  }}
                  className={viewMode === 'classic' ? 'active' : ''}
                >
                  Классический
                </button>
                <button
                  role="tab"
                  aria-selected={viewMode === 'compact'}
                  onClick={() => {
                    const url = buildUrl({ view: 'compact' });
                    window.history.replaceState(null, '', url);
                  }}
                  className={viewMode === 'compact' ? 'active' : ''}
                >
                  Компактный
                </button>
              </div>
              <span className="2.0-bracket-share-url">{pageUrl}</span>
            </div>
            {tournament && (
              <div className="2.0-bracket-share-info">
                <div className="2.0-bracket-share-title">{tournament.name}</div>
                {tournament.start_date && <div>Старт: {new Date(tournament.start_date).toLocaleString()}</div>}
              </div>
            )}
          </div>
        </div>

        {/* 3. Нижний локальный хедер страницы турнира */}
        <div className="2.0-bracket-local-nav">
          <div className="2.0-bracket-local-nav-inner">
            <a href={`#/tournaments/${id}`} className="2.0-local-nav-link">Обзор</a>
            <a href={`#/tournaments/${id}/bracket`} className="2.0-local-nav-link active">Сетка</a>
            <a href={`#/tournaments/${id}/matches`} className="2.0-local-nav-link">Матчи</a>
            <a href={`#/tournaments/${id}/participants`} className="2.0-local-nav-link">Участники</a>
          </div>
        </div>
      </div>

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


