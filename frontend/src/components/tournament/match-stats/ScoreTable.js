import React from 'react';
import { fmt, pct } from './formatters';

export function ScoreTable({ title, rows }) {
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


