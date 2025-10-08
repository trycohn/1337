import React from 'react';

export function LeadersPanel({ leaders }) {
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


