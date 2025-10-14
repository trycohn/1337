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
    console.log(`\n🔐 [ServerAuth] ========== ЗАПРОС К /lobby ==========`);
    console.log(`🔐 [ServerAuth] URL: ${req.originalUrl}`);
    console.log(`🔐 [ServerAuth] Метод: ${req.method}`);
    
    // Получаем реальный IP (учитываем прокси Nginx)
    const clientIP = req.ip || req.connection.remoteAddress;
    const realIP = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || clientIP;
    
    console.log(`🔐 [ServerAuth] Client IP: ${clientIP}`);
    console.log(`🔐 [ServerAuth] X-Real-IP: ${req.headers['x-real-ip'] || 'не указан'}`);
    console.log(`🔐 [ServerAuth] X-Forwarded-For: ${req.headers['x-forwarded-for'] || 'не указан'}`);
    
    // Получаем список разрешенных IP
    const allowedIPs = getAllowedIPs();
    
    console.log(`🔐 [ServerAuth] CS2_SERVER_IPS из .env: "${process.env.CS2_SERVER_IPS || 'НЕ УСТАНОВЛЕНА'}"`);
    console.log(`🔐 [ServerAuth] Разрешенные IPs: ${allowedIPs.join(', ')}`);
    
    // Проверяем все возможные IP
    const ipsToCheck = [clientIP, realIP, req.headers['x-real-ip'], req.headers['x-forwarded-for']?.split(',')[0]?.trim()].filter(Boolean);
    
    console.log(`🔐 [ServerAuth] Проверяем IPs: ${ipsToCheck.join(', ')}`);
    
    // Проверяем IP адрес
    const isAllowed = ipsToCheck.some(ip => allowedIPs.includes(ip));
    
    if (isAllowed) {
        console.log(`✅ [ServerAuth] Доступ РАЗРЕШЕН для IP: ${clientIP}`);
        console.log(`🔐 [ServerAuth] ===========================================\n`);
        return next();
    }
    
    // Доступ запрещен
    console.warn(`⛔ [ServerAuth] Доступ ЗАПРЕЩЕН для IP: ${clientIP}`);
    console.warn(`🔐 [ServerAuth] ===========================================\n`);
    return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only authorized CS2 servers can access match configs',
        debug: {
            your_ip: clientIP,
            allowed_ips: allowedIPs,
            env_set: !!process.env.CS2_SERVER_IPS
        }
    });
}

module.exports = {
    protectMatchConfigs,
    getAllowedIPs
};

