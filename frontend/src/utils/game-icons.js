// Маппинг названий игр к файлам иконок из public/images/games_icons
// Путь начинается с корня public

function normalizeGameName(name) {
    if (!name) return '';
    return String(name).toLowerCase();
}

// Ключи соответствуют файлам в public/images/games_icons
const iconByKey = {
    'counter-strike 2': '/images/games_icons/counter-strike-seeklogo.png',
    'cs2': '/images/games_icons/counter-strike-seeklogo.png',
    'cs 1.6': '/images/games_icons/cs1.6.png',
    'dota 2': '/images/games_icons/dota2.png',
    'valorant': '/images/games_icons/valorant.png',
    'quake': '/images/games_icons/quake.png',
    'league of legends': '/images/games_icons/LoL.png',
    'lol': '/images/games_icons/LoL.png',
    'world of tanks': '/images/games_icons/Mir_Tankov.png',
    'hearthstone': '/images/games_icons/hearthstone.png',
    'ea fc 25': '/images/games_icons/fc25.png',
    'eafc25': '/images/games_icons/fc25.png',
    'apex legends': '/images/games_icons/apex_legends.png',
    'fortnite': '/images/games_icons/Fortnite.png',
    'pubg': '/images/games_icons/pubg.png',
    'rocket league': '/images/games_icons/rocket_legue.png',
    'overwatch 2': '/images/games_icons/Overwatch2.png',
    'rainbow six siege': '/images/games_icons/rainbow_six_siege.png'
};

const defaultIcon = '/images/1337%20black%20logo.svg';

function resolveKey(game) {
    const g = normalizeGameName(game);
    if (!g) return null;

    // Прямые ключи
    if (iconByKey[g]) return g;

    // Эвристики по подстрокам
    if (g.includes('counter') && (g.includes('2') || g.includes('cs2'))) return 'counter-strike 2';
    if (g.includes('counter') && g.includes('1.6')) return 'cs 1.6';
    if (g.includes('cs 1.6')) return 'cs 1.6';
    if (g.includes('cs2')) return 'cs2';
    if (g.includes('dota')) return 'dota 2';
    if (g.includes('valorant')) return 'valorant';
    if (g.includes('quake')) return 'quake';
    if (g.includes('league of legends') || g.includes('lol')) return 'league of legends';
    if (g.includes('танков') || g.includes('world of tanks') || g.includes('wot')) return 'world of tanks';
    if (g.includes('hearthstone')) return 'hearthstone';
    if (g.includes('ea') && g.includes('fc') && g.includes('25')) return 'ea fc 25';
    if (g.includes('eafc25')) return 'eafc25';
    if (g.includes('apex')) return 'apex legends';
    if (g.includes('fortnite')) return 'fortnite';
    if (g.includes('pubg')) return 'pubg';
    if (g.includes('rocket') && g.includes('league')) return 'rocket league';
    if (g.includes('overwatch')) return 'overwatch 2';
    if (g.includes('rainbow') || g.includes('r6')) return 'rainbow six siege';

    return null;
}

export function getGameIconSrc(game) {
    const key = resolveKey(game);
    if (key && iconByKey[key]) return iconByKey[key];
    return defaultIcon;
}

export function GameIcon({ game, size = 24, className = '' }) {
    const src = getGameIconSrc(game);
    const alt = game || 'game';
    const style = { width: `${size}px`, height: `${size}px`, objectFit: 'contain' };
    return (
        <img src={src} alt={alt} title={alt} className={className} style={style} onError={(e)=>{ e.currentTarget.src = defaultIcon; }} />
    );
}

export default getGameIconSrc;


