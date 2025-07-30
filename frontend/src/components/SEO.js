import React from 'react';
import { Helmet } from 'react-helmet';

function SEO({ 
  title = '1337 Community - Киберспортивная платформа', 
  description = 'Профессиональная платформа для организации и проведения киберспортивных турниров. Участвуй в турнирах, создавай команды, побеждай!',
  keywords = 'киберспорт, турниры, esports, CS2, Dota 2, игровые турниры, соревнования, 1337, community',
  image = '/og-image.jpg',
  url = 'https://1337community.com',
  type = 'website'
}) {
  const siteTitle = title.includes('1337') ? title : `${title} | 1337 Community`;
  
  return (
    <Helmet>
      {/* Основные мета-теги */}
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="1337 Community" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      
      {/* Open Graph мета-теги для социальных сетей */}
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="1337 Community" />
      <meta property="og:locale" content="ru_RU" />
      
      {/* Twitter Card мета-теги */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:site" content="@1337community" />
      
      {/* Дополнительные мета-теги */}
      <meta name="robots" content="index, follow" />
      <meta name="language" content="Russian" />
      <meta name="revisit-after" content="7 days" />
      <link rel="canonical" href={url} />
      
      {/* Структурированные данные для поисковиков */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "1337 Community",
          "url": "https://1337community.com",
          "logo": "https://1337community.com/logo.png",
          "description": "Профессиональная платформа для организации и проведения киберспортивных турниров",
          "sameAs": [
            "https://twitter.com/1337community",
            "https://www.facebook.com/1337community",
            "https://www.instagram.com/1337community",
            "https://discord.gg/1337community"
          ]
        })}
      </script>
    </Helmet>
  );
}

export default SEO; 