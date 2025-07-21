// 🔍 Система мониторинга WebSocket для турниров
const { getIO } = require('../../socketio-server');

class WebSocketMonitor {
    constructor() {
        this.eventHistory = new Map(); // История событий
        this.connectionStats = new Map(); // Статистика соединений
        this.deliveryConfirmations = new Map(); // Подтверждения доставки
        this.isEnabled = process.env.NODE_ENV !== 'production' || process.env.WEBSOCKET_MONITORING === 'enabled';
    }

    /**
     * 📡 Логирование отправки WebSocket события
     */
    logBroadcast(tournamentId, eventType, data, sourceFunction) {
        if (!this.isEnabled) return;

        const eventId = `${tournamentId}_${eventType}_${Date.now()}`;
        const eventInfo = {
            id: eventId,
            tournamentId: parseInt(tournamentId),
            eventType,
            sourceFunction,
            timestamp: new Date().toISOString(),
            dataSize: JSON.stringify(data).length,
            connectedClients: this._getConnectedClientsCount(),
            roomSize: this._getTournamentRoomSize(tournamentId)
        };

        // Сохраняем в историю
        this.eventHistory.set(eventId, eventInfo);

        // Очищаем старые события (храним только последние 100)
        if (this.eventHistory.size > 100) {
            const oldestKey = this.eventHistory.keys().next().value;
            this.eventHistory.delete(oldestKey);
        }

        console.log(`📡 [WebSocket Monitor] Событие отправлено:`, {
            id: eventId,
            tournament: tournamentId,
            event: eventType,
            source: sourceFunction,
            clients: eventInfo.connectedClients,
            roomSize: eventInfo.roomSize,
            dataSize: `${Math.round(eventInfo.dataSize / 1024 * 100) / 100}KB`
        });

        return eventId;
    }

    /**
     * ✅ Подтверждение доставки события
     */
    confirmDelivery(eventId, clientId, deliveryTime) {
        if (!this.isEnabled) return;

        if (!this.deliveryConfirmations.has(eventId)) {
            this.deliveryConfirmations.set(eventId, []);
        }

        this.deliveryConfirmations.get(eventId).push({
            clientId,
            deliveryTime,
            latency: deliveryTime - this._getEventTimestamp(eventId)
        });

        console.log(`✅ [WebSocket Monitor] Доставка подтверждена:`, {
            eventId,
            clientId,
            latency: `${deliveryTime - this._getEventTimestamp(eventId)}ms`
        });
    }

    /**
     * 🔄 Автоматическая проверка доставки событий
     */
    async verifyEventDelivery(eventId, expectedClientCount, timeoutMs = 5000) {
        if (!this.isEnabled) return { success: true };

        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const checkDelivery = () => {
                const confirmations = this.deliveryConfirmations.get(eventId) || [];
                const currentTime = Date.now();
                
                if (confirmations.length >= expectedClientCount) {
                    console.log(`✅ [WebSocket Monitor] Событие ${eventId} доставлено всем клиентам`);
                    resolve({
                        success: true,
                        deliveredTo: confirmations.length,
                        expected: expectedClientCount,
                        averageLatency: this._calculateAverageLatency(confirmations)
                    });
                } else if (currentTime - startTime > timeoutMs) {
                    console.warn(`⚠️ [WebSocket Monitor] Таймаут доставки события ${eventId}`, {
                        delivered: confirmations.length,
                        expected: expectedClientCount,
                        timeout: timeoutMs
                    });
                    resolve({
                        success: false,
                        deliveredTo: confirmations.length,
                        expected: expectedClientCount,
                        timeout: true
                    });
                } else {
                    setTimeout(checkDelivery, 100);
                }
            };

            setTimeout(checkDelivery, 100);
        });
    }

    /**
     * 📊 Получение статистики WebSocket
     */
    getStats() {
        if (!this.isEnabled) return { monitoring: false };

        const recentEvents = Array.from(this.eventHistory.values())
            .filter(event => Date.now() - new Date(event.timestamp).getTime() < 60000) // Последние 60 секунд
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return {
            monitoring: true,
            totalEvents: this.eventHistory.size,
            recentEvents: recentEvents.length,
            connectedClients: this._getConnectedClientsCount(),
            lastEvents: recentEvents.slice(0, 10).map(event => ({
                id: event.id,
                tournament: event.tournamentId,
                event: event.eventType,
                source: event.sourceFunction,
                timestamp: event.timestamp,
                roomSize: event.roomSize
            })),
            eventsByType: this._getEventsByType(recentEvents),
            averageLatency: this._getAverageLatencyForPeriod(recentEvents)
        };
    }

    /**
     * 🧹 Очистка старых данных мониторинга
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 минут

        // Очищаем старые события
        for (const [eventId, event] of this.eventHistory.entries()) {
            if (now - new Date(event.timestamp).getTime() > maxAge) {
                this.eventHistory.delete(eventId);
                this.deliveryConfirmations.delete(eventId);
            }
        }

        console.log(`🧹 [WebSocket Monitor] Очистка завершена, события в памяти: ${this.eventHistory.size}`);
    }

    // Приватные методы
    _getConnectedClientsCount() {
        try {
            const io = getIO();
            return io?.sockets?.sockets?.size || 0;
        } catch (error) {
            return 0;
        }
    }

    _getTournamentRoomSize(tournamentId) {
        try {
            const io = getIO();
            const room = io?.sockets?.adapter?.rooms?.get(`tournament_${tournamentId}`);
            return room?.size || 0;
        } catch (error) {
            return 0;
        }
    }

    _getEventTimestamp(eventId) {
        const event = this.eventHistory.get(eventId);
        return event ? new Date(event.timestamp).getTime() : Date.now();
    }

    _calculateAverageLatency(confirmations) {
        if (!confirmations.length) return 0;
        const totalLatency = confirmations.reduce((sum, conf) => sum + conf.latency, 0);
        return Math.round(totalLatency / confirmations.length);
    }

    _getEventsByType(events) {
        const counts = {};
        events.forEach(event => {
            counts[event.eventType] = (counts[event.eventType] || 0) + 1;
        });
        return counts;
    }

    _getAverageLatencyForPeriod(events) {
        const allConfirmations = events
            .map(event => this.deliveryConfirmations.get(event.id) || [])
            .flat();
        return this._calculateAverageLatency(allConfirmations);
    }
}

// Создаем singleton экземпляр
const websocketMonitor = new WebSocketMonitor();

// Автоматическая очистка каждые 5 минут
setInterval(() => {
    websocketMonitor.cleanup();
}, 5 * 60 * 1000);

module.exports = websocketMonitor; 