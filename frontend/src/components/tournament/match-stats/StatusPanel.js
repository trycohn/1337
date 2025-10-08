import React, { useEffect, useRef, useState } from 'react';

export function StatusPanel({ completedAt, onRefresh }) {
  const [since, setSince] = useState(0);
  const [nextPollIn, setNextPollIn] = useState(5);
  const pollRef = useRef(null);
  useEffect(() => {
    const t0 = completedAt ? new Date(completedAt).getTime() : Date.now();
    const tick = () => {
      setSince(Math.floor((Date.now() - t0) / 1000));
      setNextPollIn((prev) => (prev > 0 ? prev - 1 : 5));
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [completedAt]);

  useEffect(() => {
    if (nextPollIn === 0 && onRefresh) {
      onRefresh();
      setNextPollIn(15); // увеличиваем интервал после первого запроса
    }
  }, [nextPollIn, onRefresh]);

  return (
    <div style={{border:'1px solid #333', borderRadius:6, padding:'10px 12px', background:'#111', color:'#ddd'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div>
          <strong>Ожидается завершение матча</strong>
          <div style={{opacity:.8, fontSize:13}}>с момента ожидания: {since}s • автообновление через {nextPollIn}s</div>
        </div>
        <button className="btn btn-secondary" onClick={onRefresh}>Обновить</button>
      </div>
    </div>
  );
}


