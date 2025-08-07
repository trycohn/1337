import React from 'react';
import { Helmet } from 'react-helmet';

/**
 * 🔍 MatchMetaTags - Компонент для SEO метатегов матчей
 * Создает Open Graph метатеги для шейринга в социальных сетях
 * 
 * @version 1.0
 * @features Open Graph, Twitter Cards, VK метатеги
 */
const MatchMetaTags = ({ match, tournament }) => {
    if (!match || !tournament) return null;

    // Определяем команды и результат
    const team1 = match.team1_name || 'Команда 1';
    const team2 = match.team2_name || 'Команда 2';
    const winner = match.winner_team_id === match.team1_id ? team1 : team2;
    
    // Формируем счет
    let score = `${match.score1 || 0}:${match.score2 || 0}`;
    if (match.maps_data && Array.isArray(match.maps_data) && match.maps_data.length === 1) {
        const mapData = match.maps_data[0];
        if (mapData.team1_score !== undefined && mapData.team2_score !== undefined) {
            score = match.winner_team_id === match.team1_id 
                ? `${mapData.team1_score}:${mapData.team2_score}`
                : `${mapData.team2_score}:${mapData.team1_score}`;
        }
    }

    // Формируем данные для метатегов
    const title = `🏆 ${winner} победила ${score} | ${tournament.name}`;
    const description = `Результат матча #${match.match_number || match.id} в турнире "${tournament.name}" на 1337 Community. ${team1} vs ${team2} - ${score}`;
    const url = `${window.location.origin}/tournaments/${tournament.id}/match/${match.id}`;
    const siteName = '1337 Community';
    const imageUrl = `${window.location.origin}/api/tournaments/${tournament.id}/match/${match.id}/share-image`;

    return (
        <Helmet>
            {/* Основные метатеги */}
            <title>{title}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={`esports, турнир, ${tournament.name}, ${team1}, ${team2}, киберспорт`} />
            
            {/* Open Graph метатеги */}
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:type" content="article" />
            <meta property="og:url" content={url} />
            <meta property="og:site_name" content={siteName} />
            <meta property="og:image" content={imageUrl} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={`Результат матча ${team1} vs ${team2}`} />
            <meta property="og:locale" content="ru_RU" />
            
            {/* Twitter Card метатеги */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={imageUrl} />
            <meta name="twitter:image:alt" content={`Результат матча ${team1} vs ${team2}`} />
            <meta name="twitter:site" content="@1337Community" />
            
            {/* VK метатеги */}
            <meta property="vk:title" content={title} />
            <meta property="vk:description" content={description} />
            <meta property="vk:image" content={imageUrl} />
            
            {/* Telegram метатеги */}
            <meta property="telegram:channel" content="@1337community" />
            
            {/* Дополнительные метатеги */}
            <meta name="robots" content="index, follow" />
            <meta name="author" content="1337 Community" />
            <meta property="article:author" content="1337 Community" />
            <meta property="article:section" content="Esports" />
            <meta property="article:tag" content="Tournament" />
            <meta property="article:tag" content="Esports" />
            <meta property="article:tag" content={tournament.name} />
            
            {/* Canonical URL */}
            <link rel="canonical" href={url} />
            
            {/* JSON-LD структурированные данные */}
            <script type="application/ld+json">
                {JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "SportsEvent",
                    "name": `Матч #${match.match_number || match.id}: ${team1} vs ${team2}`,
                    "description": description,
                    "url": url,
                    "image": imageUrl,
                    "startDate": match.match_date || tournament.created_at,
                    "location": {
                        "@type": "VirtualLocation",
                        "name": "1337 Community",
                        "url": "https://1337community.com"
                    },
                    "organizer": {
                        "@type": "Organization",
                        "name": "1337 Community",
                        "url": "https://1337community.com"
                    },
                    "competitor": [
                        {
                            "@type": "SportsTeam",
                            "name": team1
                        },
                        {
                            "@type": "SportsTeam", 
                            "name": team2
                        }
                    ],
                    "winner": {
                        "@type": "SportsTeam",
                        "name": winner
                    }
                })}
            </script>
        </Helmet>
    );
};

export default MatchMetaTags;