import React from 'react';

export function SkeletonLine({ width = '100%', height = 14 }) {
  return (
    <div style={{
      width,
      height,
      borderRadius: 4,
      background: 'linear-gradient(90deg, #0a0a0a 25%, #111 37%, #0a0a0a 63%)',
      backgroundSize: '400% 100%',
      animation: 'shimmer 1.2s ease-in-out infinite'
    }} />
  );
}

export function SkeletonTable({ rows = 6 }) {
  return (
    <div style={{overflowX:'auto'}}>
      <table className="table">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td colSpan={8}><SkeletonLine /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonCards({ count = 6 }) {
  return (
    <div style={{display:'flex', flexWrap:'wrap', gap:12}}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{border:'1px solid #333', borderRadius:6, padding:'12px', background:'#111', minWidth:180}}>
          <SkeletonLine width="60%" />
          <div style={{height:8}} />
          <SkeletonLine width="80%" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonMapTiles({ count = 3 }) {
  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12}}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{border:'1px solid #333', background:'#111', borderRadius:6, padding:12}}>
          <SkeletonLine width="100%" height={120} />
          <div style={{height:8}} />
          <SkeletonLine width="50%" />
        </div>
      ))}
    </div>
  );
}

// keyframes встраиваем один раз (можно переместить в css)
const style = document.createElement('style');
style.innerHTML = `@keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }`;
if (typeof document !== 'undefined') { document.head.appendChild(style); }


