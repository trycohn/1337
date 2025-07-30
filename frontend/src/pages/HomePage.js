import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/HomePage.css';

function HomePage() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [animatedStats, setAnimatedStats] = useState({
    tournaments: 0,
    players: 0,
    matches: 0,
    prizePool: 0
  });

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Анимация счетчиков при появлении в viewport
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
        if (entry.isIntersecting && entry.target.id === 'stats-section') {
          animateValue(0, 150, 2000, 'tournaments');
          animateValue(0, 5000, 2000, 'players');
          animateValue(0, 10000, 2000, 'matches');
          animateValue(0, 100000, 2000, 'prizePool');
          observer.unobserve(entry.target);
        }
      });
    });

    const statsSection = document.getElementById('stats-section');
    if (statsSection) observer.observe(statsSection);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="homepage">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          <div className="geometric-pattern" style={{ transform: `translateY(${scrollY * 0.5}px)` }}></div>
          <div className="grid-overlay"></div>
        </div>
        
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              <span className="title-line">ДОМИНИРУЙ</span>
              <span className="title-line accent">В ТУРНИРАХ</span>
              <span className="title-line">ПОБЕЖДАЙ</span>
            </h1>
            <p className="hero-subtitle">
              Профессиональная платформа для организации и проведения киберспортивных турниров
            </p>
            <div className="hero-buttons">
              <button 
                className="cta-button primary"
                onClick={() => navigate('/register')}
              >
                Начать играть
              </button>
              <button 
                className="cta-button secondary"
                onClick={() => navigate('/tournaments')}
              >
                Смотреть турниры
              </button>
            </div>
          </div>
          
          <div className="hero-visual">
            <div className="tournament-bracket-preview">
              <svg viewBox="0 0 400 300" className="bracket-svg">
                {/* Анимированная турнирная сетка */}
                <g className="bracket-lines">
                  <path d="M50,50 L150,50 L150,100 L250,100" stroke="#ff0000" strokeWidth="2" fill="none" className="bracket-path" />
                  <path d="M50,150 L150,150 L150,100" stroke="#ff0000" strokeWidth="2" fill="none" className="bracket-path" />
                  <path d="M50,200 L150,200 L150,250 L250,250" stroke="#ff0000" strokeWidth="2" fill="none" className="bracket-path" />
                  <path d="M50,250 L150,250" stroke="#ff0000" strokeWidth="2" fill="none" className="bracket-path" />
                  <path d="M250,100 L250,175 L350,175" stroke="#ff0000" strokeWidth="2" fill="none" className="bracket-path" />
                  <path d="M250,250 L250,175" stroke="#ff0000" strokeWidth="2" fill="none" className="bracket-path" />
                </g>
                <g className="bracket-nodes">
                  <circle cx="50" cy="50" r="5" fill="#ff0000" className="bracket-node" />
                  <circle cx="50" cy="150" r="5" fill="#ff0000" className="bracket-node" />
                  <circle cx="50" cy="200" r="5" fill="#ff0000" className="bracket-node" />
                  <circle cx="50" cy="250" r="5" fill="#ff0000" className="bracket-node" />
                  <circle cx="350" cy="175" r="8" fill="#ff0000" className="bracket-node champion" />
                </g>
              </svg>
            </div>
          </div>
        </div>

        <div className="scroll-indicator">
          <div className="mouse">
            <div className="wheel"></div>
          </div>
          <span>Scroll</span>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">О платформе 1337</h2>
            <div className="title-underline"></div>
          </div>
          
          <div className="about-content">
            <div className="about-text">
              <p className="lead-text">
                1337 Community — это современная экосистема для киберспортсменов всех уровней. 
                От новичков до профессионалов, мы создаём равные возможности для всех.
              </p>
              <p>
                Наша платформа объединяет передовые технологии организации турниров, 
                систему рейтингов и активное сообщество игроков. Здесь каждый может 
                найти соперников своего уровня и начать путь к вершине киберспорта.
              </p>
            </div>
            
            <div className="about-features">
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>Быстрый старт</h3>
                <p>Регистрация за 30 секунд и сразу в бой</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🏆</div>
                <h3>Честная игра</h3>
                <p>Прозрачная система судейства и рейтингов</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">💰</div>
                <h3>Реальные призы</h3>
                <p>Денежные призы и ценные награды</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Возможности платформы</h2>
            <div className="title-underline"></div>
          </div>

          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-number">01</div>
              <h3>Форматы турниров</h3>
              <p>Single и Double Elimination, швейцарская система, микс-турниры для любых предпочтений</p>
            </div>
            <div className="feature-item">
              <div className="feature-number">02</div>
              <h3>Умная генерация сеток</h3>
              <p>Автоматическое распределение участников по силе игры для максимально честных матчей</p>
            </div>
            <div className="feature-item">
              <div className="feature-number">03</div>
              <h3>Live трансляции</h3>
              <p>Интеграция с Twitch и YouTube для стриминга матчей в реальном времени</p>
            </div>
            <div className="feature-item">
              <div className="feature-number">04</div>
              <h3>Система достижений</h3>
              <p>Зарабатывай уникальные награды и покажи всем свой прогресс</p>
            </div>
            <div className="feature-item">
              <div className="feature-number">05</div>
              <h3>Командные турниры</h3>
              <p>Создавай команду с друзьями или найди новых тиммейтов</p>
            </div>
            <div className="feature-item">
              <div className="feature-number">06</div>
              <h3>API для организаторов</h3>
              <p>Полный контроль над турнирами через удобную панель администратора</p>
            </div>
          </div>
        </div>
      </section>

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

      {/* Community Section */}
      <section className="community-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Присоединяйся к элите</h2>
            <div className="title-underline"></div>
          </div>

          <div className="community-content">
            <div className="community-text">
              <h3>Стань частью истории</h3>
              <p>
                Каждый чемпион начинал с первого матча. Твоя история побед начинается здесь и сейчас. 
                Докажи, что ты достоин носить звание лучшего.
              </p>
              <ul className="community-benefits">
                <li>🎯 Участвуй в турнирах любого уровня</li>
                <li>📈 Отслеживай свой прогресс и статистику</li>
                <li>🤝 Находи команду и новых друзей</li>
                <li>🏅 Зарабатывай репутацию в сообществе</li>
                <li>💪 Тренируйся с лучшими игроками</li>
              </ul>
            </div>

            <div className="testimonials">
              <div className="testimonial">
                <p>"1337 дал мне шанс показать себя. Теперь я играю на про-сцене!"</p>
                <div className="testimonial-author">— s1mple, про-игрок</div>
              </div>
              <div className="testimonial">
                <p>"Лучшая платформа для старта карьеры в киберспорте"</p>
                <div className="testimonial-author">— NaVi Manager</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Готов побеждать?</h2>
            <p className="cta-subtitle">Начни свой путь к вершине киберспорта прямо сейчас</p>
            <div className="cta-buttons">
              <button 
                className="cta-button large primary"
                onClick={() => navigate('/register')}
              >
                Создать аккаунт
              </button>
              <Link to="/tournaments" className="cta-link">
                или посмотри активные турниры →
              </Link>
            </div>
          </div>
          
          <div className="cta-visual">
            <div className="trophy-icon">🏆</div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage; 