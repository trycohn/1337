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
                <td data-label="Игрок">{p.name}</td>
                <td data-label="K">{p.kills}</td>
                <td data-label="D">{p.deaths}</td>
                <td data-label="A">{p.assists}</td>
                <td data-label="K/D">{fmt(p.kd, 2)}</td>
                <td data-label="ADR">{fmt(p.adr, 1)}</td>
                <td data-label="HS%">{pct(p.hs)}</td>
                <td data-label="Acc">{pct(p.acc)}</td>
                <td data-label="RWS*">{fmt(p.rws, 1)}</td>
                <td data-label="Entry%">{pct(p.entry)}</td>
                <td data-label="1v1%">{pct(p.clutch1)}</td>
                <td data-label="1v2%">{pct(p.clutch2)}</td>
                <td data-label="5k">{p.enemy5ks||0}</td>
                <td data-label="4k">{p.enemy4ks||0}</td>
                <td data-label="3k">{p.enemy3ks||0}</td>
                <td data-label="2k">{p.enemy2ks||0}</td>
                <td data-label="UtlDmg">{p.utility_damage||0}</td>
                <td data-label="Flashed">{p.enemies_flashed||0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


