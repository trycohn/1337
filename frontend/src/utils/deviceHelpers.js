// Импорты для React
import { useState, useEffect } from 'react';

/**
 * Утилиты для определения типа устройства и экрана
 */

// Брейкпоинты для разных устройств
export const BREAKPOINTS = {
  mobileXs: 320,    // iPhone SE, маленькие Android
  mobileSm: 375,    // iPhone 12/13/14/15
  mobileMd: 390,    // iPhone 14 Pro/15 Pro
  mobileLg: 428,    // iPhone 14 Plus/Pro Max
  tablet: 768,      // iPad, планшеты
  laptop: 1024,     // Маленькие ноутбуки
  desktop: 1280,    // Десктопы
  wide: 1536        // Широкие экраны
};

// Определение типа устройства
export const getDeviceType = () => {
  const width = window.innerWidth;
  
  if (width < BREAKPOINTS.tablet) {
    return 'mobile';
  } else if (width < BREAKPOINTS.laptop) {
    return 'tablet';
  } else if (width < BREAKPOINTS.desktop) {
    return 'desktop';
  } else {
    return 'wide';
  }
};

// Проверка мобильного устройства
export const isMobileDevice = () => {
  return window.innerWidth < BREAKPOINTS.tablet;
};

// Проверка планшета
export const isTabletDevice = () => {
  const width = window.innerWidth;
  return width >= BREAKPOINTS.tablet && width < BREAKPOINTS.laptop;
};

// Проверка десктопа
export const isDesktopDevice = () => {
  return window.innerWidth >= BREAKPOINTS.laptop;
};

// Определение ориентации экрана
export const getOrientation = () => {
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
};

// Проверка поддержки touch
export const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// Определение операционной системы
export const getOS = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  if (/android/i.test(userAgent)) {
    return 'Android';
  }
  
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return 'iOS';
  }
  
  if (/Windows/.test(userAgent)) {
    return 'Windows';
  }
  
  if (/Mac/.test(userAgent)) {
    return 'MacOS';
  }
  
  if (/Linux/.test(userAgent)) {
    return 'Linux';
  }
  
  return 'Unknown';
};

// Определение браузера
export const getBrowser = () => {
  const userAgent = navigator.userAgent;
  
  if (userAgent.indexOf('Chrome') > -1) {
    return 'Chrome';
  }
  if (userAgent.indexOf('Safari') > -1) {
    return 'Safari';
  }
  if (userAgent.indexOf('Firefox') > -1) {
    return 'Firefox';
  }
  if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident/') > -1) {
    return 'IE';
  }
  if (userAgent.indexOf('Edge') > -1) {
    return 'Edge';
  }
  
  return 'Unknown';
};

// Проверка поддержки safe area (для iPhone X и новее)
export const hasSafeArea = () => {
  const iOS = getOS() === 'iOS';
  const ratio = window.devicePixelRatio || 1;
  const screen = {
    width: window.screen.width * ratio,
    height: window.screen.height * ratio
  };
  
  // iPhone X и новее имеют соотношение сторон примерно 19.5:9
  return iOS && screen.height / screen.width >= 2;
};

// Хук для отслеживания изменения размера экрана
export const useDeviceType = () => {
  const [deviceType, setDeviceType] = useState(getDeviceType());
  const [orientation, setOrientation] = useState(getOrientation());
  
  useEffect(() => {
    const handleResize = () => {
      setDeviceType(getDeviceType());
      setOrientation(getOrientation());
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);
  
  return { deviceType, orientation };
};

// Медиа-запросы для CSS-in-JS
export const mediaQueries = {
  mobile: `@media (max-width: ${BREAKPOINTS.tablet - 1}px)`,
  tablet: `@media (min-width: ${BREAKPOINTS.tablet}px) and (max-width: ${BREAKPOINTS.laptop - 1}px)`,
  desktop: `@media (min-width: ${BREAKPOINTS.laptop}px)`,
  landscape: '@media (orientation: landscape)',
  portrait: '@media (orientation: portrait)',
  retina: '@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)'
};

// Утилита для адаптивных значений
export const responsive = (mobile, tablet = mobile, desktop = tablet) => {
  const width = window.innerWidth;
  
  if (width < BREAKPOINTS.tablet) {
    return mobile;
  } else if (width < BREAKPOINTS.laptop) {
    return tablet;
  } else {
    return desktop;
  }
}; 