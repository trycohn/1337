import React, { useMemo } from 'react';

// Variant A: Grid Timeline (2 rows = teams, N columns = steps)
export function PickBanTimeline({ steps }) {
  const cleanSteps = Array.isArray(steps) ? steps.filter(Boolean) : [];

  const normalized = useMemo(() => cleanSteps.map((s, i) => ({
    index: s.step_index || i + 1,
    action: String(s.action || s.action_type || '').toLowerCase(),
    teamId: Number(s.team_id || s.team || 0) || null,
    teamName: s.team_name || null,
    map: s.mapname || s.map_name || s.map || ''
  })), [cleanSteps]);

  // Определяем названия команд из шагов
  const team1Name = useMemo(() => {
    const byId = normalized.find(s => s.teamId === 1);
    if (byId?.teamName) return byId.teamName;
    const uniq = [...new Set(normalized.map(s => s.teamName).filter(Boolean))];
    return uniq[0] || 'Команда 1';
  }, [normalized]);
  const team2Name = useMemo(() => {
    const byId = normalized.find(s => s.teamId === 2);
    if (byId?.teamName) return byId.teamName;
    const uniq = [...new Set(normalized.map(s => s.teamName).filter(Boolean))];
    return uniq[1] || 'Команда 2';
  }, [normalized]);

  const stepsCount = normalized.length;
  const gridTemplateColumns = `180px repeat(${stepsCount}, minmax(60px, 1fr))`;

  if (stepsCount === 0) return null;

  function getMapLabel(raw) {
    const s = String(raw || '').toLowerCase().trim();
    return s.replace(/^de[_\-\s]?/, '').toUpperCase();
  }

  function Marker({ step }) {
    const cls = step.action === 'ban' ? 'ban' : step.action === 'pick' ? 'pick' : 'decider';
    const title = `${step.index}. ${step.action.toUpperCase()} ${step.map || ''}${step.teamName ? ` — ${step.teamName}` : ''}`.trim();
    return (
      <div className={`pb-marker ${cls}`} title={title} aria-label={title}>
        {getMapLabel(step.map)}
      </div>
    );
  }

  return (
    <div className="custom-match-pickban pickban-grid" style={{ gridTemplateColumns }}>
      {/* Team names column */}
      <div className="pb-team pb-team1">{team1Name}</div>
      {/* Row: team1 steps */}
      <div className="pb-steps pb-steps1" style={{ gridColumn: `2 / span ${stepsCount}` }}>
        {normalized.map((s) => (
          <div key={`t1-${s.index}`} className="pb-cell">
            {s.teamId === 1 ? <Marker step={s} /> : null}
          </div>
        ))}
      </div>

      {/* Axis row with triangle markers */}
      <div className="pb-axis" style={{ gridColumn: `2 / span ${stepsCount}` }}>
        <div className="pb-axis-cells">
          {normalized.map((s) => (
            <div key={`ax-${s.index}`} className="pb-axis-cell">
              <span className={`pb-tri ${s.teamId === 1 ? 'up' : 'down'} ${s.action}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Team 2 */}
      <div className="pb-team pb-team2">{team2Name}</div>
      {/* Row: team2 steps */}
      <div className="pb-steps pb-steps2" style={{ gridColumn: `2 / span ${stepsCount}` }}>
        {normalized.map((s) => (
          <div key={`t2-${s.index}`} className="pb-cell">
            {s.teamId === 2 ? <Marker step={s} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}


