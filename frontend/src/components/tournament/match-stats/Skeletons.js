import React from 'react';

export function SkeletonLine({ width = '100%', height = 14 }) {
  const style = { width, height };
  const className = `skeleton-line ${width==='100%'?'s-w-100':width==='80%'?'s-w-80':'s-w-60'} ${height===14?'s-h-14':'s-h-120'}`;
  return <div className={className} style={style} />;
}

export function SkeletonTable({ rows = 6 }) {
  return (
    <div className="skeleton-table">
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
    <div className="skeleton-cards">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <SkeletonLine width="60%" />
          <div className="s-h-14" style={{height:8}} />
          <SkeletonLine width="80%" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonMapTiles({ count = 3 }) {
  return (
    <div className="skeleton-map-tiles">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-tile">
          <SkeletonLine width="100%" height={120} />
          <div className="s-h-14" style={{height:8}} />
          <SkeletonLine width="50%" />
        </div>
      ))}
    </div>
  );
}

// keyframes вынесены в CSS (match-stats.css)


