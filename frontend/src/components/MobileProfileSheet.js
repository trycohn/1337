import React, { useRef } from 'react';
import './MobileProfileSheet.css';

function MobileProfileSheet({ isOpen, onClose, activeTab, onSelectTab, tabs = [] }) {
  const panelRef = useRef(null);

  function handleOverlayClick(e) {
    if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
  }

  return (
    <div className={`profile-sheet-overlay ${isOpen ? 'open' : ''}`} onClick={handleOverlayClick}>
      <div ref={panelRef} className={`profile-sheet-panel ${isOpen ? 'open' : ''}`} role="dialog" aria-modal="true">
        <div className="profile-sheet-header">
          <h3>Меню профиля</h3>
          <button className="profile-sheet-close" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className="profile-sheet-content">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`profile-sheet-item ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => { onSelectTab(t.key); onClose(); }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MobileProfileSheet;


