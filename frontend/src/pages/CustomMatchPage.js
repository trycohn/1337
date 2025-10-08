import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../axios';
import { PickBanTimeline } from '../components/tournament/match-stats/PickBanTimeline';
import { LeadersPanel } from '../components/tournament/match-stats/LeadersPanel';
import { ScoreTable } from '../components/tournament/match-stats/ScoreTable';
import { MapsAccordion } from '../components/tournament/match-stats/MapsAccordion';
import '../components/tournament/match-stats/match-stats.css';

function CustomMatchPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState(null);
    const [basic, setBasic] = useState(null);
    const [expandedMap, setExpandedMap] = useState(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const r = await api.get(`/api/matches/custom/${id}/stats`);
                if (!mounted) return;
                if (r?.data?.success) setStats(r.data);
                else {
                    // fallback: базовая инфа о матче и шагах пик/бан
                    try {
                        const fb = await api.get(`/api/matches/${id}`);
                        if (fb?.data?.match) setBasic(fb.data);
                        else setError('Матч не найден');
                    } catch (_) { setError('Матч не найден'); }
                }
            } catch (e) {
                try {
                    const fb = await api.get(`/api/matches/${id}`);
                    if (fb?.data?.match) setBasic(fb.data);
                    else setError('Матч не найден');
                } catch (_) {
                    setError('Не удалось загрузить статистику матча');
                }
            } finally {
                setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [id]);

    if (loading) return <div className="container"><h2>Загрузка матча…</h2></div>;
    if (error) return (
        <div className="container">
            <h2>Ошибка</h2>
            <p>{error}</p>
            <button className="btn" onClick={() => navigate(-1)}>Назад</button>
        </div>
    );

    const { match, maps, playersByTeam, playersByMap, leaders, pickban } = stats || {};
    const titleLeft = match?.team1_name || 'Команда 1';
    const titleRight = match?.team2_name || 'Команда 2';
    const score1 = match?.team1_score ?? '-';
    const score2 = match?.team2_score ?? '-';

    function fmt(v, d = 2) { return Number.isFinite(v) ? Number(v).toFixed(d) : '0.00'; }
    function pct(v) { return Number.isFinite(v) ? `${Math.round(v * 100)}%` : '0%'; }

    function ScoreTable({ title, rows }) {
        if (!Array.isArray(rows) || rows.length === 0) return null;
        return (
            <div className="custom-match-mt-16">
                <h3>{title}</h3>
                <div style={{overflowX:'auto'}}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Игрок</th>
                                <th>K</th>
                                <th>D</th>
                                <th>A</th>
                                <th>K/D</th>
                                <th>ADR</th>
                                <th>HS%</th>
                                <th>Acc</th>
                                <th>RWS*</th>
                                <th>Entry%</th>
                                <th>1v1%</th>
                                <th>1v2%</th>
                                <th>5k</th>
                                <th>4k</th>
                                <th>3k</th>
                                <th>2k</th>
                                <th>UtlDmg</th>
                                <th>Flashed</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((p) => (
                                <tr key={`${p.steamid64}-${p.name}`}>
                                    <td>{p.name}</td>
                                    <td>{p.kills}</td>
                                    <td>{p.deaths}</td>
                                    <td>{p.assists}</td>
                                    <td>{fmt(p.kd, 2)}</td>
                                    <td>{fmt(p.adr, 1)}</td>
                                    <td>{pct(p.hs)}</td>
                                    <td>{pct(p.acc)}</td>
                                    <td>{fmt(p.rws, 1)}</td>
                                    <td>{pct(p.entry)}</td>
                                    <td>{pct(p.clutch1)}</td>
                                    <td>{pct(p.clutch2)}</td>
                                    <td>{p.enemy5ks||0}</td>
                                    <td>{p.enemy4ks||0}</td>
                                    <td>{p.enemy3ks||0}</td>
                                    <td>{p.enemy2ks||0}</td>
                                    <td>{p.utility_damage||0}</td>
                                    <td>{p.enemies_flashed||0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    function LeadersPanel({ leaders }) {
        if (!leaders) return null;
        const Card = ({ title, value, name }) => (
            <div style={{border:'1px solid #333', borderRadius:6, padding:'8px 12px', background:'#111', minWidth:180}}>
                <div style={{opacity:.8, fontSize:12}}>{title}</div>
                <div style={{fontWeight:700, fontSize:18}}>{value}</div>
                <div style={{opacity:.9}}>{name || '-'}</div>
            </div>
        );
        return (
            <div className="custom-match-mt-16">
                <h3>Лидеры матча</h3>
                <div style={{display:'flex', flexWrap:'wrap', gap:12}}>
                    <Card title="MVP*" value={(leaders.mvpApprox?.damage ?? 0) + ' dmg'} name={leaders.mvpApprox?.name} />
                    <Card title="Most Kills" value={leaders.kills?.kills ?? 0} name={leaders.kills?.name} />
                    <Card title="Most Damage" value={leaders.damage?.damage ?? 0} name={leaders.damage?.name} />
                    <Card title="Highest ADR" value={(leaders.adr ? leaders.adr.adr?.toFixed(1) : '0.0')} name={leaders.adr?.name} />
                    <Card title="Highest HS%" value={`${Math.round((leaders.hsPercent?.hs || 0)*100)}%`} name={leaders.hsPercent?.name} />
                    <Card title="Best Entry%" value={`${Math.round((leaders.entryWinRate?.entry || 0)*100)}%`} name={leaders.entryWinRate?.name} />
                    <Card title="Clutch 1v1" value={`${Math.round((leaders.clutch1?.clutch1 || 0)*100)}%`} name={leaders.clutch1?.name} />
                    <Card title="Clutch 1v2" value={`${Math.round((leaders.clutch2?.clutch2 || 0)*100)}%`} name={leaders.clutch2?.name} />
                    <Card title="Accuracy" value={`${Math.round((leaders.accuracy?.acc || 0)*100)}%`} name={leaders.accuracy?.name} />
                    <Card title="5k / 4k / 3k" value={`${leaders.fiveKs?.enemy5ks||0} / ${leaders.fourKs?.enemy4ks||0} / ${leaders.threeKs?.enemy3ks||0}`} name={leaders.fiveKs?.name || leaders.fourKs?.name || leaders.threeKs?.name} />
                    <Card title="Flashed" value={leaders.flashed?.enemies_flashed || 0} name={leaders.flashed?.name} />
                    <Card title="Utility Dmg" value={leaders.utilityDamage?.utility_damage || 0} name={leaders.utilityDamage?.name} />
                </div>
                <div style={{opacity:.6, fontSize:12, marginTop:6}}>Показатели с * являются приблизительными до появления раунд‑логов.</div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className="custom-match-mt-16">
                <h2>Custom match — CS2</h2>
                <div className="list-row">
                    <div className="list-row-left">
                        <strong>{titleLeft}</strong> vs <strong>{titleRight}</strong>
                    </div>
                    <div className="list-row-right">
                        <span>Счёт: {score1}:{score2}</span>
                    </div>
                </div>
            </div>

            {(match?.connect || match?.server_ip) && (
                <div className="custom-match-mt-16">
                    <h3>Подключение</h3>
                    {match.connect && (
                        <div className="list-row">
                            <div className="list-row-left">
                                <span>Игроки:</span>
                                <code className="code-inline">{match.connect}</code>
                            </div>
                            <div className="list-row-right">
                                <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(match.connect)}>Копировать</button>
                            </div>
                        </div>
                    )}
                    {match.gotv && (
                        <div className="list-row custom-match-mt-8">
                            <div className="list-row-left">
                                <span>GOTV:</span>
                                <code className="code-inline">{match.gotv}</code>
                            </div>
                            <div className="list-row-right">
                                <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(match.gotv)}>Копировать</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <PickBanTimeline steps={pickban} />

            <LeadersPanel leaders={leaders} />
            <div className="custom-match-mt-12 compact-toggle">
                <label><input type="checkbox" onChange={(e)=>setExpandedMap(prev=>prev)} /> Компактный режим таблиц</label>
            </div>
            <ScoreTable title={`${titleLeft} — суммарно`} rows={playersByTeam?.team1 || []} compact={true} />
            <ScoreTable title={`${titleRight} — суммарно`} rows={playersByTeam?.team2 || []} compact={true} />

            <MapsAccordion titleLeft={titleLeft} titleRight={titleRight} maps={maps} playersByMap={playersByMap} />
        </div>
    );
}

export default CustomMatchPage;

