import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../axios';
import SEO from '../components/SEO';
import '../styles/HomePage.css';
import { useMemo } from 'react';

function HomePage() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [animatedStats, setAnimatedStats] = useState({
    tournaments: 0,
    players: 0,
    matches: 0,
    prizePool: 0
  });
  const [realStats, setRealStats] = useState({
    tournaments: 0,
    players: 0,
    matches: 0,
    prizePool: 0
  });
  const [recentTournaments, setRecentTournaments] = useState([]);
  const [winners, setWinners] = useState([]);
  const [currentWinnerIndex, setCurrentWinnerIndex] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const aboutPhotos = useMemo(() => ([
    '/images/home%20photos%20tournament/1337%20league%201.jpg',
    '/images/home%20photos%20tournament/raznoe%202.jpg',
    '/images/home%20photos%20tournament/raznoe.jpg',
    '/images/home%20photos%20tournament/shuffle%20showdown%201.jpg',
    '/images/home%20photos%20tournament/shuffle%20showdown%202.jpg',
    '/images/home%20photos%20tournament/shuffle%20showdown%203.jpg',
    '/images/home%20photos%20tournament/shuffle%20showdown%204.jpg'
  ]), []);
  const [aboutPhotoIndex, setAboutPhotoIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Загрузка реальной статистики
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/api/stats/platform');
        const stats = response.data;
        setRealStats({
          tournaments: stats.total_tournaments || 0,
          players: stats.total_players || 0,
          matches: stats.total_matches || 0,
          prizePool: stats.total_prize_pool || 0
        });
      } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        // Используем дефолтные значения если API недоступен
        setRealStats({
          tournaments: 150,
          players: 5000,
          matches: 10000,
          prizePool: 100000
        });
      }
    };

    fetchStats();
  }, []);

  // Загрузка последних турниров
  useEffect(() => {
    const fetchRecentTournaments = async () => {
      try {
        // Берём турниры всех статусов, затем сортируем по дате старта
        const response = await api.get('/api/tournaments?limit=40');
        const data = Array.isArray(response.data) ? response.data : (response.data?.tournaments || []);
        const sorted = [...data].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        setRecentTournaments(sorted);
      } catch (error) {
        console.error('Ошибка загрузки турниров:', error);
      }
    };

    fetchRecentTournaments();
  }, []);

  // Загрузка победителей турниров
  useEffect(() => {
    const fetchWinners = async () => {
      try {
        const response = await api.get('/api/tournaments/winners?limit=5');
        setWinners(response.data || []);
      } catch (error) {
        console.error('Ошибка загрузки победителей:', error);
        // Заглушка для демонстрации
        setWinners([
          { 
            tournament_name: 'CS2 Major Championship',
            winner_name: 'NaVi Team',
            prize: '$50,000',
            date: '2024-12-15'
          },
          { 
            tournament_name: 'Dota 2 International',
            winner_name: 'Team Spirit',
            prize: '$25,000',
            date: '2024-11-28'
          },
          { 
            tournament_name: 'Valorant Masters',
            winner_name: 'Sentinels',
            prize: '$30,000',
            date: '2024-10-20'
          }
        ]);
      }
    };

    fetchWinners();
  }, []);

  // Анимация счетчиков при появлении в viewport с реальными данными
  useEffect(() => {
    const animateValue = (start, end, duration, key) => {
      const range = end - start;
      const increment = end > start ? 1 : -1;
      const stepTime = Math.abs(Math.floor(duration / range));
      let current = start;

      const timer = setInterval(() => {
        current += increment * Math.ceil(range / 50);
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
          current = end;
          clearInterval(timer);
        }
        setAnimatedStats(prev => ({ ...prev, [key]: current }));
      }, stepTime);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.target.id === 'stats-section' && !statsLoaded) {
          animateValue(0, realStats.tournaments, 2000, 'tournaments');
          animateValue(0, realStats.players, 2000, 'players');
          animateValue(0, realStats.matches, 2000, 'matches');
          animateValue(0, realStats.prizePool, 2000, 'prizePool');
          setStatsLoaded(true);
          observer.unobserve(entry.target);
        }
      });
    });

    const statsSection = document.getElementById('stats-section');
    if (statsSection && realStats.tournaments > 0) observer.observe(statsSection);

    return () => observer.disconnect();
  }, [realStats, statsLoaded]);

  // Автопереключение слайдера победителей
  useEffect(() => {
    if (winners.length > 0) {
      const interval = setInterval(() => {
        setCurrentWinnerIndex((prev) => (prev + 1) % winners.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [winners.length]);

  // Скрываем начальную анимацию загрузки
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Автокарусель фото в about-section
  useEffect(() => {
    if (!aboutPhotos.length) return;
    const timer = setInterval(() => {
      setAboutPhotoIndex((i) => (i + 1) % aboutPhotos.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [aboutPhotos.length]);

  return (
    <>
      <SEO 
        title="1337 Community - Профессиональная киберспортивная платформа"
        description="Участвуй в турнирах по CS2, Dota 2, Valorant и другим играм. Создавай команды, находи соперников, выигрывай призы. Присоединяйся к лучшему киберспортивному сообществу!"
        keywords="киберспорт, esports, турниры, CS2, Dota 2, Valorant, игровые соревнования, призовые турниры, 1337 community"
      />
      
      {/* Анимация загрузки при первом посещении */}
      {isInitialLoading && (
        <div className="initial-loader">
          <div className="loader-content">
            <img src="/images/1337%20white%20logo.svg" alt="1337" className="loader-logo" />
            <div className="loader-dots" aria-label="Загрузка">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        </div>
      )}

      <div className={`homepage ${isInitialLoading ? 'loading' : ''}`}>
        {/* About Section */}
        <section className="about-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">О платформе 1337</h2>
              <div className="title-underline"></div>
            </div>
            
            <div className="about-content about-grid">
              <div className="about-text">
                <p className="lead-text">
                  1337 Community — это современная экосистема для киберспортсменов всех уровней. 
                  От новичков до профессионалов, мы создаём равные возможности для всех.
                </p>
              </div>
              <div className="about-photos">
                <img
                  className="about-photo"
                  src={aboutPhotos[aboutPhotoIndex] || '/images/1337%20black%20logo.svg'}
                  alt="1337 tournament"
                  onError={(e) => { e.currentTarget.src = '/images/1337%20black%20logo.svg'; }}
                />
                <div className="about-photo-overlay"></div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA: Create your own tournaments */}
        <section className="create-tournaments-cta">
          <div className="cta-bg" aria-hidden="true" />
          <div className="container cta-inner">
            <div className="cta-copy">
              <h3 className="cta-head">Создавай свои турниры</h3>
              <p className="cta-sub">Профессиональные инструменты, монохромный стиль, результаты в реальном времени.</p>
              <div className="cta-actions">
                <a href="/create" className="btn btn-primary">Создать турнир</a>
                <a href="/tournaments" className="btn btn-secondary">Смотреть турниры</a>
              </div>
            </div>
          </div>
        </section>

        {/* Steam-like Carousel Section (замена hero) */}
        <section className="tournaments-carousel-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">Последние турниры</h2>
              <div className="title-underline"></div>
            </div>
          </div>
          <TournamentSteamCarousel recentTournaments={recentTournaments} onOpen={(id) => navigate(`/tournaments/${id}`)} />
        </section>

        {/* Recent Tournaments Section удалён: оставляем только карусель */}

        {/* Winners Steam-like Carousel */}
        {winners.length > 0 && (
          <section className="winners-carousel-section">
            <div className="container">
              <div className="section-header">
                <h2 className="section-title">Чемпионы 1337</h2>
                <div className="title-underline"></div>
              </div>
            </div>
            <WinnersSteamCarousel winners={winners} />
          </section>
        )}

        

        

        {/* Stats Section */}
        <section className="stats-section" id="stats-section">
          <div className="container">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-number">{animatedStats.tournaments}+</div>
                <div className="stat-label">Турниров проведено</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{animatedStats.players.toLocaleString()}+</div>
                <div className="stat-label">Активных игроков</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{animatedStats.matches.toLocaleString()}+</div>
                <div className="stat-label">Матчей сыграно</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">${animatedStats.prizePool.toLocaleString()}</div>
                <div className="stat-label">Общий призовой фонд</div>
              </div>
            </div>
          </div>
        </section>

        {/* community-section и cta-section удалены по требованию */}
      </div>
    </>
  );
}

export default HomePage; 

// 🆕 Карусель турниров в стиле Steam
function TournamentSteamCarousel({ recentTournaments, onOpen }) {
  const items = useMemo(() => (Array.isArray(recentTournaments) ? recentTournaments : []), [recentTournaments]);
  const [index, setIndex] = React.useState(0);
  const next = () => setIndex((i) => (i + 1) % Math.max(items.length, 1));
  const prev = () => setIndex((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));

  React.useEffect(() => {
    if (!items.length) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [items.length]);

  const gameIcon = (game) => {
    const g = String(game || '').toLowerCase();
    if (g.includes('counter') || g.includes('cs')) return '🎯';
    if (g.includes('dota')) return '🛡️';
    if (g.includes('valorant')) return '🎯';
    if (g.includes('league')) return '🧿';
    return '🎮';
  };

  function getTournamentArtwork(t) {
    // Приоритет: banner_url → logo_url → game image → fallback
    const banner = t?.banner_url || t?.banner || t?.cover_url || t?.cover;
    if (banner && typeof banner === 'string' && banner.trim()) return banner;
    const logo = t?.logo_url || t?.logo;
    if (logo && typeof logo === 'string' && logo.trim()) return logo;
    const g = String(t?.game || '').toLowerCase();
    if (g.includes('counter') || g.includes('cs')) return '/images/games/counter%20strike%202.jpg';
    return '/images/1337%20black%20logo.svg';
  }

  const statusText = (s) => {
    if (s === 'active') return 'Идёт';
    if (s === 'registration') return 'Регистрация';
    if (s === 'completed') return 'Завершён';
    return s || '—';
  };

  const visible = useMemo(() => {
    if (!items.length) {
      return [
        { id: 0, name: 'Нет турниров', game: '—', status: '—', format: '—', participant_type: '—', start_date: new Date().toISOString() }
      ];
    }
    const win = [];
    for (let k = 0; k < 4; k++) win.push(items[(index + k) % items.length]);
    return win;
  }, [items, index]);

  return (
    <section className="steam-carousel steam-carousel--tournaments">
      <div className="steam-carousel-inner">
        <button className="steam-nav left" onClick={prev} aria-label="Предыдущий">
          <img src={'/images/icons/Play white left.png'} alt="prev" onMouseOver={(e)=>{ e.currentTarget.src='/images/icons/Play red left.png'; }} onMouseOut={(e)=>{ e.currentTarget.src='/images/icons/Play white left.png'; }} />
        </button>
        <div className="steam-track">
          <div className="steam-slide">
            <div className="steam-slide-grid">
              {visible.map((t) => (
                <div key={t.id} className="steam-card-carousel tournament-card-carousel" onClick={() => t.id && onOpen && onOpen(t.id)}>
                  <div className="steam-card-inner-carousel tournament-card-inner-carousel">
                    {/* FRONT */}
                    <div className="steam-card-front">
                      <div className="steam-card-header">
                        <h3 className="steam-title steam-title--tournament" title={t.name}>{t.name}</h3>
                      </div>
                      <div className="steam-art-wrap">
                        <img className="steam-game-art" src={getTournamentArtwork(t)} alt={t.game || 'tournament'} onError={(e)=>{ e.currentTarget.src='/images/1337%20black%20logo.svg'; }} />
                      </div>
                      <div className="steam-status-strip">
                        <span className={`steam-status-pill ${t.status || 'unknown'}`}>
                          {statusText(t.status)}
                        </span>
                      </div>
                    </div>
                    {/* BACK */}
                    <div className="steam-card-back">
                      <div className="steam-meta-row">
                        <span className="steam-meta-label">Дата</span>
                        <span className="steam-meta-value">{new Date(t.start_date).toLocaleDateString('ru-RU')}</span>
                      </div>
                      <div className="steam-meta-row">
                        <span className="steam-meta-label">Статус</span>
                        <span className="steam-meta-value">{t.status === 'active' ? 'Идёт' : t.status === 'registration' ? 'Регистрация' : t.status === 'completed' ? 'Завершён' : (t.status || '—')}</span>
                      </div>
                      <div className="steam-meta-row">
                        <span className="steam-meta-label">Участников</span>
                        <span className="steam-meta-value">{Number.isInteger(t.participant_count) ? t.participant_count : (t.players_count || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button className="steam-nav right" onClick={next} aria-label="Следующий">
          <img src={'/images/icons/Play white right.png'} alt="next" onMouseOver={(e)=>{ e.currentTarget.src='/images/icons/Play red right.png'; }} onMouseOut={(e)=>{ e.currentTarget.src='/images/icons/Play white right.png'; }} />
        </button>
      </div>
      <div className="steam-dots">
        {Array.from({ length: Math.max(items.length, 1) }).map((_, i) => (
          <button key={i} className={`steam-dot ${i === index ? 'active' : ''}`} onClick={() => setIndex(i)} />
        ))}
      </div>
    </section>
  );
}

function WinnersSteamCarousel({ winners }) {
  const items = useMemo(() => (Array.isArray(winners) ? winners : []), [winners]);
  const shuffled = useMemo(() => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [items]);
  const [index, setIndex] = React.useState(0);
  const next = () => setIndex((i) => (i + 1) % Math.max(shuffled.length, 1));
  const prev = () => setIndex((i) => (i - 1 + Math.max(shuffled.length, 1)) % Math.max(shuffled.length, 1));

  React.useEffect(() => {
    if (!shuffled.length) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [shuffled.length]);

  const getWinnerImage = (w) => {
    const src = w.winner_avatar_url || null;
    if (src && typeof src === 'string' && src.trim().length > 0) return src;
    const g = String(w.game || w.tournament_game || '').toLowerCase();
    if (g.includes('counter') || g.includes('cs')) return '/images/games/counter%20strike%202.jpg';
    return '/images/1337%20black%20logo.svg';
  };

  const visible = useMemo(() => {
    if (!shuffled.length) {
      return [
        { tournament_name: '—', winner_name: '—', prize: '—', date: new Date().toISOString() }
      ];
    }
    const win = [];
    for (let k = 0; k < 4; k++) win.push(shuffled[(index + k) % shuffled.length]);
    return win;
  }, [shuffled, index]);

  return (
    <section className="steam-carousel steam-carousel--winners">
      <div className="steam-carousel-inner">
        <button className="steam-nav left" onClick={prev} aria-label="Предыдущий">
          <img src={'/images/icons/Play white left.png'} alt="prev" onMouseOver={(e)=>{ e.currentTarget.src='/images/icons/Play red left.png'; }} onMouseOut={(e)=>{ e.currentTarget.src='/images/icons/Play white left.png'; }} />
        </button>
        <div className="steam-track">
          <div className="steam-slide">
            <div className="steam-slide-grid">
              {visible.map((w, idx) => (
                <div key={`${w.tournament_name}-${idx}`} className="steam-card-carousel winner-card-carousel">
                  <div className="steam-card-front" style={{height:'100%'}}>
                    <div className="steam-card-header">
                      <h3 className="winner-name-fit" title={w.winner_name}>{w.winner_name}</h3>
                    </div>
                    <div className="steam-art-wrap">
                      <img className="steam-game-art" src={getWinnerImage(w)} alt="winner" onError={(e)=>{ e.currentTarget.src='/images/1337%20black%20logo.svg'; }} />
                    </div>
                    <div className="winner-tournament-bottom" title={w.tournament_name}>{w.tournament_name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button className="steam-nav right" onClick={next} aria-label="Следующий">
          <img src={'/images/icons/Play white right.png'} alt="next" onMouseOver={(e)=>{ e.currentTarget.src='/images/icons/Play red right.png'; }} onMouseOut={(e)=>{ e.currentTarget.src='/images/icons/Play white right.png'; }} />
        </button>
      </div>
      <div className="steam-dots">
        {Array.from({ length: Math.max(shuffled.length, 1) }).map((_, i) => (
          <button key={i} className={`steam-dot ${i === index ? 'active' : ''}`} onClick={() => setIndex(i)} />
        ))}
      </div>
    </section>
  );
}