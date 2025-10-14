/**
 * 🔒 Middleware для защиты доступа к конфигам матчей
 * Разрешает доступ только CS2 серверам по IP из .env
 */

/**
 * Получить список разрешенных IP адресов
 */
function getAllowedIPs() {
    // IP адреса из .env (через запятую)
    const envIPs = process.env.CS2_SERVER_IPS || '';
    const serverIPs = envIPs.split(',').map(ip => ip.trim()).filter(ip => ip);
    
    // Для локальной разработки
    const devIPs = ['127.0.0.1', '::1', 'localhost'];
    
    // Объединяем
    return [...serverIPs, ...devIPs];
}

/**
 * Middleware для защиты конфигов матчей
 * Пропускает только запросы с IP из .env (CS2_SERVER_IPS)
 */
function protectMatchConfigs(req, res, next) {
    // Получаем реальный IP (учитываем прокси Nginx)
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Получаем список разрешенных IP
    const allowedIPs = getAllowedIPs();
    
    console.log(`🔍 [ServerAuth] Проверка IP: ${clientIP}`);
    console.log(`🔍 [ServerAuth] Разрешенные IPs: ${allowedIPs.join(', ')}`);
    
    // Проверяем IP адрес
    if (allowedIPs.includes(clientIP)) {
        console.log(`✅ [ServerAuth] Доступ разрешен для IP: ${clientIP}`);
        return next();
    }
    
    // Доступ запрещен
    console.warn(`⛔ [ServerAuth] Доступ запрещен для IP: ${clientIP}`);
    return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only authorized CS2 servers can access match configs'
    });
}

module.exports = {
    protectMatchConfigs,
    getAllowedIPs
};

