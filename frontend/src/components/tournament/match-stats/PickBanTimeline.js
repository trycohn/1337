import React from 'react';

export function PickBanTimeline({ steps }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  return (
    <div className="custom-match-mt-16">
      <h3>Порядок Pick/Ban</h3>
      <div className="list-row" style={{flexWrap:'wrap', gap:8}}>
        {steps.map((s) => (
          <div key={`${s.step_index}-${s.mapname}-${s.map_name || ''}`} className="badge" title={s.team_name || ''}>
            {s.step_index}. {(s.action || s.action_type || '').toUpperCase()} {s.mapname || s.map_name}
          </div>
        ))}
      </div>
    </div>
  );
}


