import React from 'react';
import { fmt, pct } from './formatters';

export function ScoreTable({ title, rows, compact = false }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const best = {
    kills: Math.max(...rows.map(p => Number(p.kills) || 0)),
    assists: Math.max(...rows.map(p => Number(p.assists) || 0)),
    kd: Math.max(...rows.map(p => Number(p.kd) || 0)),
    adr: Math.max(...rows.map(p => Number(p.adr) || 0)),
    hs: Math.max(...rows.map(p => Number(p.hs) || 0)),
    acc: Math.max(...rows.map(p => Number(p.acc) || 0)),
    rws: Math.max(...rows.map(p => Number(p.rws) || 0)),
    entry: Math.max(...rows.map(p => Number(p.entry) || 0)),
    clutch1: Math.max(...rows.map(p => Number(p.clutch1) || 0)),
    clutch2: Math.max(...rows.map(p => Number(p.clutch2) || 0)),
    enemy5ks: Math.max(...rows.map(p => Number(p.enemy5ks) || 0)),
    enemy4ks: Math.max(...rows.map(p => Number(p.enemy4ks) || 0)),
    enemy3ks: Math.max(...rows.map(p => Number(p.enemy3ks) || 0)),
    enemy2ks: Math.max(...rows.map(p => Number(p.enemy2ks) || 0)),
    utility_damage: Math.max(...rows.map(p => Number(p.utility_damage) || 0)),
    enemies_flashed: Math.max(...rows.map(p => Number(p.enemies_flashed) || 0))
  };
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
              {!compact && (<th>Acc</th>)}
              {!compact && (<th>RWS*</th>)}
              {!compact && (<th>Entry%</th>)}
              {!compact && (<th>1v1%</th>)}
              {!compact && (<th>1v2%</th>)}
              {!compact && (<th>5k</th>)}
              {!compact && (<th>4k</th>)}
              {!compact && (<th>3k</th>)}
              {!compact && (<th>2k</th>)}
              {!compact && (<th>UtlDmg</th>)}
              {!compact && (<th>Flashed</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={`${p.steamid64}-${p.name}`}>
                <td data-label="Игрок">{p.name}</td>
                <td data-label="K" className={p.kills === best.kills ? 'best-cell' : undefined}>{p.kills}</td>
                <td data-label="D">{p.deaths}</td>
                <td data-label="A" className={p.assists === best.assists ? 'best-cell' : undefined}>{p.assists}</td>
                <td data-label="K/D" className={(Number(p.kd)||0) === best.kd ? 'best-cell' : undefined}>{fmt(p.kd, 2)}</td>
                <td data-label="ADR" className={(Number(p.adr)||0) === best.adr ? 'best-cell' : undefined}>{fmt(p.adr, 1)}</td>
                <td data-label="HS%" className={(Number(p.hs)||0) === best.hs ? 'best-cell' : undefined}>{pct(p.hs)}</td>
                {!compact && (<td data-label="Acc" className={(Number(p.acc)||0) === best.acc ? 'best-cell' : undefined}>{pct(p.acc)}</td>)}
                {!compact && (<td data-label="RWS*" className={(Number(p.rws)||0) === best.rws ? 'best-cell' : undefined}>{fmt(p.rws, 1)}</td>)}
                {!compact && (<td data-label="Entry%" className={(Number(p.entry)||0) === best.entry ? 'best-cell' : undefined}>{pct(p.entry)}</td>)}
                {!compact && (<td data-label="1v1%" className={(Number(p.clutch1)||0) === best.clutch1 ? 'best-cell' : undefined}>{pct(p.clutch1)}</td>)}
                {!compact && (<td data-label="1v2%" className={(Number(p.clutch2)||0) === best.clutch2 ? 'best-cell' : undefined}>{pct(p.clutch2)}</td>)}
                {!compact && (<td data-label="5k" className={(Number(p.enemy5ks)||0) === best.enemy5ks ? 'best-cell' : undefined}>{p.enemy5ks||0}</td>)}
                {!compact && (<td data-label="4k" className={(Number(p.enemy4ks)||0) === best.enemy4ks ? 'best-cell' : undefined}>{p.enemy4ks||0}</td>)}
                {!compact && (<td data-label="3k" className={(Number(p.enemy3ks)||0) === best.enemy3ks ? 'best-cell' : undefined}>{p.enemy3ks||0}</td>)}
                {!compact && (<td data-label="2k" className={(Number(p.enemy2ks)||0) === best.enemy2ks ? 'best-cell' : undefined}>{p.enemy2ks||0}</td>)}
                {!compact && (<td data-label="UtlDmg" className={(Number(p.utility_damage)||0) === best.utility_damage ? 'best-cell' : undefined}>{p.utility_damage||0}</td>)}
                {!compact && (<td data-label="Flashed" className={(Number(p.enemies_flashed)||0) === best.enemies_flashed ? 'best-cell' : undefined}>{p.enemies_flashed||0}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


