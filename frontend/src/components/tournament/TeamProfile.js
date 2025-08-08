import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import './TeamProfile.css';

function formatPercent(n) { return Number.isFinite(n) ? `${n}%` : '—'; }

export default function TeamProfile() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapStats, setMapStats] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/teams/${teamId}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Ошибка загрузки');
        setTeam(json.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    fetch(`/api/teams/${teamId}/maps-stats`).then(r=>r.json()).then(j=>setMapStats(j.data||[])).catch(()=>{});
  }, [teamId]);

  if (loading) return <div className="teamprof-wrap">Загрузка...</div>;
  if (error) return <div className="teamprof-wrap">Ошибка: {error}</div>;
  if (!team) return <div className="teamprof-wrap">Команда не найдена</div>;

  const logo = team.logo_url || (team.manager?.avatar_url) || null;
  const fallbackLetter = team.name?.[0]?.toUpperCase() || 'T';

  return (
    <div className="teamprof-page">
      <div className="teamprof-header">
        <div className="teamprof-logo">
          {logo ? (
            <img src={logo} alt={team.name} />
          ) : (
            <div className="teamprof-logo-fallback">{fallbackLetter}</div>
          )}
        </div>
        <div className="teamprof-title">
          <h1 className="teamprof-name">{team.name}</h1>
          <div className="teamprof-sub">Полное название: {team.short_name || team.name}</div>
        </div>
        <div className="teamprof-stats">
          <div className="teamprof-stat"><span>Матчи</span><strong>{team.stats?.total_matches || 0}</strong></div>
          <div className="teamprof-stat"><span>Винрейт</span><strong>{formatPercent(team.stats?.winrate || 0)}</strong></div>
          <div className="teamprof-stat"><span>FACEIT ELO (ср.)</span><strong>{avgFaceit(team.roster)}</strong></div>
        </div>
      </div>

      <div className="teamprof-manager">
        Менеджер: {team.manager ? (
          <a href={`/profile?userId=${team.manager.id}`} target="_blank" rel="noreferrer">{team.manager.username}</a>
        ) : '—'}
      </div>

      <div className="teamprof-tabs">
        <section className="teamprof-section">
          <h2>Ростер</h2>
          <div className="teamprof-roster">
            {team.manager && (
              <div className="roster-row">
                <div className="role">Менеджер</div>
                <div className="nick"><a href={`/profile?userId=${team.manager.id}`} target="_blank" rel="noreferrer">{team.manager.username}</a></div>
                <div className="games">—</div>
                <div className="winrate">—</div>
              </div>
            )}
            {team.roster?.map((m, i) => (
              <div key={i} className="roster-row">
                <div className="role">{m.is_captain ? 'Капитан' : 'Игрок'}</div>
                <div className="nick">{m.id ? <a href={`/profile?userId=${m.id}`} target="_blank" rel="noreferrer">{m.username || m.name}</a> : <span title="Игрок был добавлен единоразова в рамках турнира и не проходил авторизацию">{m.username || m.name}</span>}</div>
                <div className="games">—</div>
                <div className="winrate">—</div>
              </div>
            ))}
          </div>
        </section>

        <section className="teamprof-section">
          <h2>История матчей</h2>
          <TeamMatches teamId={teamId} />
        </section>

        <section className="teamprof-section">
          <h2>Турниры</h2>
          <ul className="teamprof-list">
            {team.tournaments?.map(t => (
              <li key={t.tournament_id}><a href={`/tournaments/${t.tournament_id}`} target="_blank" rel="noreferrer">{t.name}</a></li>
            ))}
          </ul>
        </section>

        <section className="teamprof-section">
          <h2>Достижения</h2>
          <ul className="teamprof-list">
            {team.achievements?.length ? team.achievements.map((a, idx) => (
              <li key={idx}>{a.place}-е место — {a.tournament} — {formatDate(a.date)}</li>
            )) : <li>Пока нет достижений</li>}
          </ul>
        </section>

        <section className="teamprof-section">
          <h2>Новости</h2>
          <div className="teamprof-news-placeholder">Скоро здесь будут новости команды</div>
        </section>

        <section className="teamprof-section">
          <h2>Статистика по картам</h2>
          <div className="teamprof-maps">
            {mapStats.length ? (
              <table className="maps-table">
                <thead>
                  <tr>
                    <th>Карта</th><th>Игр</th><th>Побед</th><th>Поражений</th><th>Винрейт</th>
                  </tr>
                </thead>
                <tbody>
                  {mapStats.map((m,i)=>(
                    <tr key={i}>
                      <td>{m.display_name}</td>
                      <td>{m.total}</td>
                      <td>{m.wins}</td>
                      <td>{m.losses}</td>
                      <td>{m.winrate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-rows">Нет данных по картам</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function avgFaceit(roster = []) {
  const elos = roster.map(m => m.faceit_elo).filter(Boolean);
  if (!elos.length) return '—';
  return Math.round(elos.reduce((a,b)=>a+b,0)/elos.length);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

function TeamMatches({ teamId }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    fetch(`/api/teams/${teamId}/matches?limit=20`).then(r=>r.json()).then(j=>setRows(j.data||[])).catch(()=>{});
  }, [teamId]);
  return (
    <div className="teamprof-matches">
      {rows.map((m,i) => (
        <div key={i} className={`tmr ${m.result}`}>
          <div className="col tour"><a href={`/tournaments/${m.tournament_id}`} target="_blank" rel="noreferrer">{m.tournament_name}</a></div>
          <div className="col score">{m.score}</div>
          <div className="col res">{m.result === 'win' ? 'W' : 'L'}</div>
        </div>
      ))}
      {!rows.length && <div className="no-rows">Нет матчей</div>}
    </div>
  );
}


