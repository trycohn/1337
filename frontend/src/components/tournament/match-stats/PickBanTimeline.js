import React from 'react';

export function PickBanTimeline({ steps }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  return (
    <div className="custom-match-mt-16">
      <h3>Порядок Pick/Ban</h3>
      <div className="list-row" style={{flexWrap:'wrap', gap:8}}>
        {steps.map((s) => {
          const action = (s.action || s.action_type || '').toLowerCase();
          const cls = action === 'ban' ? 'ban' : action === 'pick' ? 'pick' : 'decider';
          const icon = action === 'ban' ? '✖' : action === 'pick' ? '✓' : '●';
          return (
            <div key={`${s.step_index}-${s.mapname}-${s.map_name || ''}`} className={`badge ${cls}`} title={s.team_name || ''}>
              <span className="icon" aria-hidden>{icon}</span>
              {s.step_index}. {(action).toUpperCase()} {s.mapname || s.map_name}
            </div>
          );
        })}
      </div>
    </div>
  );
}


