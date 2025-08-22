import React from 'react';
import './Loader.css';

function Loader() {
  return (
    <div className="loader-container">
      <div className="loader-content">
        <img
          src="/images/1337%20white%20logo.svg"
          alt="1337"
          className="loader-logo"
        />
        <div className="loader-progress" aria-label="Загрузка">
          <div className="loader-bar" />
        </div>
      </div>
    </div>
  );
}

export default Loader;