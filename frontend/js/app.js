document.addEventListener('DOMContentLoaded', () => {
    // При загрузке -> routeTo(location.pathname)
    routeTo(location.pathname);
  
    // Перехватываем клики по .nav-link
    document.querySelectorAll('a.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const path = link.getAttribute('href');       // e.g. "/admin"
        const screenKey = link.dataset.screen;        // e.g. "admin"
        pushNavigate(path, screenKey);
      });
    });
  
    // При нажатии Back/Forward
    window.onpopstate = function(event) {
      routeTo(location.pathname);
    };
  });
  
  /**
   * Делаем pushState без перезагрузки
   */
  function pushNavigate(path, screenKey) {
    history.pushState({ screenKey }, '', path);
    showScreen(screenKey);
  }
  
  /**
   * routeTo(path) -> определяем screenKey
   */
  function routeTo(path) {
    let screenKey = 'home'; // по умолчанию
  
    switch(path) {
      case '/':
      case '/home':
        screenKey = 'home';
        break;
      case '/tournaments':
        screenKey = 'tournaments';
        break;
      case '/admin':
        screenKey = 'admin';
        // Можно loadMyTournaments() тут
        break;
      case '/create':
        screenKey = 'create';
        break;
      default:
        // fallback
        screenKey = 'home';
        break;
    }
    showScreen(screenKey);
  }
  
  /**
   * Показываем нужное <section id="screen-...">, скрываем остальные
   */
  function showScreen(screenKey) {
    const screens = ['home','tournaments','admin','create'];
    screens.forEach(s => {
      const el = document.getElementById(`screen-${s}`);
      if (!el) return;
      el.style.display = (s===screenKey) ? 'block' : 'none';
    });
  
    // Дополнительно, при показе admin, 
    // вы можете вызывать loadMyTournaments() и т.п.
    // if (screenKey==='admin') { loadMyTournaments(); }
  }
  