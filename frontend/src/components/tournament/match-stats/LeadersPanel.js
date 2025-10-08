import React from 'react';

export function LeadersPanel({ leaders }) {
  if (!leaders) return null;

  const pct = (v) => `${Math.round((v || 0) * 100)}%`;
  const mvp = leaders.mvpApprox || null;

  const smallCards = [
    { key: 'kills', title: 'Most Kills', value: leaders.kills?.kills ?? 0, name: leaders.kills?.name },
    { key: 'hs', title: 'Highest HS%', value: pct(leaders.hsPercent?.hs || 0), name: leaders.hsPercent?.name },
    { key: 'acc', title: 'Accuracy', value: pct(leaders.accuracy?.acc || 0), name: leaders.accuracy?.name },
    { key: 'clutch1', title: 'Clutch 1v1', value: pct(leaders.clutch1?.clutch1 || 0), name: leaders.clutch1?.name }
  ];

  return (
    <div className="custom-match-leaders-panel">
      <h3 className="leaders-title">Лидеры матча</h3>
      <div className="leaders-grid">
        {/* MVP (2x2) */}
        <div className="leader-card leader-mvp">
          <div className="leader-title">MVP*</div>
          <div className="leader-name">{mvp?.name || '-'}</div>
          <div className="leader-metrics">
            <div><span className="leader-label">K/D/A:</span> <span className="leader-value">{(mvp?.kills ?? 0)}/{(mvp?.deaths ?? 0)}/{(mvp?.assists ?? 0)}</span></div>
            <div><span className="leader-label">HS:</span> <span className="leader-value">{mvp?.head_shot_kills ?? 0}</span></div>
            <div><span className="leader-label">HS%:</span> <span className="leader-value">{pct(mvp?.hs || 0)}</span></div>
          </div>
        </div>

        {/* Остальные карточки (фиксированный размер) */}
        {smallCards.map((c) => (
          <div key={c.key} className="leader-card">
            <div className="leader-title">{c.title}</div>
            <div className="leader-value leader-strong">{c.value}</div>
            <div className="leader-name">{c.name || '-'}</div>
          </div>
        ))}
      </div>
      <div className="leaders-footnote">Показатели с * являются приблизительными до появления раунд‑логов.</div>
    </div>
  );
}


