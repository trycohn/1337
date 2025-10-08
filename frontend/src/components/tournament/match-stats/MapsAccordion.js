import React, { useState } from 'react';
import { ScoreTable } from './ScoreTable';

function mapImage(name) {
  const n = String(name || '').toLowerCase();
  const map = n.replace(/^de[_\-\s]?/, '').trim();
  const imgs = {
    dust2: '/images/maps/dust2.jpg',
    mirage: '/images/maps/mirage.jpg',
    inferno: '/images/maps/inferno.jpg',
    nuke: '/images/maps/nuke.jpg',
    overpass: '/images/maps/overpass.jpg',
    vertigo: '/images/maps/vertigo.jpg',
    ancient: '/images/maps/ancient.jpg',
    anubis: '/images/maps/anubis.jpg',
    train: '/images/maps/train.jpg'
  };
  return imgs[map] || '/images/maps/mirage.jpg';
}

export function MapsAccordion({ titleLeft, titleRight, maps, playersByMap, compact = false }) {
  const [open, setOpen] = useState(null);
  if (!Array.isArray(maps) || maps.length === 0) return null;
  return (
    <div className="maps-accordion-container">
      <h3>Карты серии</h3>
      <div>
        {maps.map((m) => {
          const isOpen = open === m.mapnumber;
          const t1 = playersByMap?.[m.mapnumber]?.team1 || [];
          const t2 = playersByMap?.[m.mapnumber]?.team2 || [];
          return (
            <div key={m.mapnumber} className="match-accordion">
              <div className="list-row accordion-row" onClick={() => setOpen(isOpen?null:m.mapnumber)}>
                <div className="list-row-left">
                  <img src={mapImage(m.mapname)} alt={m.mapname} className="map-thumb" />
                  <strong>Map {m.mapnumber + 1}: {m.mapname}</strong>
                  <span className="custom-match-ml-8">{titleLeft} {m.team1_score} : {m.team2_score} {titleRight}</span>
                  {m.picked_by && (<span className="custom-match-ml-8">picked by {m.picked_by}</span>)}
                  {m.is_decider && (<span className="custom-match-ml-8">decider</span>)}
                </div>
                <div className="list-row-right">{isOpen ? '▲' : '▼'}</div>
              </div>
              {isOpen && (
                <div className="accordion-content">
                  <ScoreTable title={`${titleLeft} — ${m.mapname}`} rows={t1} compact={compact} />
                  <ScoreTable title={`${titleRight} — ${m.mapname}`} rows={t2} compact={compact} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


