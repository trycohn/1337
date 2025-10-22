import React, { useCallback, useEffect, useState, useMemo } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import MixTeamCard from './MixTeamCard';
import api from '../../../utils/api';
import { getSocketInstance } from '../../../services/socketClient_v5_simplified';

function MixTeamsView({ tournament, teams = [], isLoading = false, isAdminOrCreator = false }) {
    const tournamentId = tournament?.id;
    const formatNorm = (tournament?.format || '').toString().trim().toLowerCase();
    const mixTypeNorm = (tournament?.mix_type || '').toString().trim().toLowerCase();
    const isFullMix = formatNorm === 'full_mix' || (formatNorm === 'mix' && mixTypeNorm === 'full');
    const [rounds, setRounds] = useState([]);
    const [currentRound, setCurrentRound] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadRounds = useCallback(async () => {
        if (!isFullMix) return;
        try {
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/snapshots`);
            const items = (res.data?.items || []).sort((a,b) => a.round_number - b.round_number);
            setRounds(items);
            if (items.length > 0) setCurrentRound(items[items.length - 1].round_number);
        } catch (e) {
            console.warn('[FullMix] Не удалось загрузить список раундов:', e?.message || e);
            setRounds([]);
        }
    }, [tournamentId, isFullMix]);

    const loadSnapshot = useCallback(async (round) => {
        if (!isFullMix) return;
        setLoading(true);
        try {
            await api.get(`/api/tournaments/${tournamentId}/fullmix/rounds/${round}`);
            // Снапшот загружен, но нам не нужно сохранять его в state
            // teams приходят из пропса и обновляются через useMixTeams
        } catch (e) {
            console.warn('[FullMix] Не удалось загрузить снапшот раунда:', e?.message || e);
        } finally {
            setLoading(false);
        }
    }, [tournamentId, isFullMix]);

    useEffect(() => {
        if (!isFullMix || !tournamentId) return;
        loadRounds();
    }, [isFullMix, tournamentId, loadRounds]);

    useEffect(() => {
        if (!isFullMix || !tournamentId) return;
        if (!currentRound || rounds.length === 0) return;
        loadSnapshot(currentRound);
    }, [isFullMix, tournamentId, currentRound, rounds.length, loadSnapshot]);

    useEffect(() => {
        if (!isFullMix) return;
        const socket = getSocketInstance && getSocketInstance();
        if (!socket || !tournamentId) return;
        const onRoundCompleted = (payload) => {
            if (!payload || payload.round == null) return;
            loadRounds();
            loadSnapshot(payload.round);
        };
        socket.on('fullmix_round_completed', onRoundCompleted);
        return () => {
            socket.off && socket.off('fullmix_round_completed', onRoundCompleted);
        };
    }, [isFullMix, tournamentId, loadRounds, loadSnapshot]);

    // 🆕 УПРОЩЕННАЯ ЛОГИКА: Используем teams из пропса
    // Backend уже правильно:
    // 1. Проверяет подтверждение (rosters_confirmed для SE/DE, approved_teams для Swiss)
    // 2. Фильтрует команды (только текущий раунд для SE/DE, все команды для Swiss)
    // 3. Возвращает пустой массив если не подтверждено
    const teamsToRender = teams;
    
    console.log(`📊 [MixTeamsView] Турнир ${tournamentId}: format=${formatNorm}, mix_type=${mixTypeNorm}, команд=${teams.length}`);
    
    // 🆕 Определяем тип сетки (ПЕРЕД любыми return!)
    const isSEorDE = useMemo(() => {
        const bracketType = (tournament?.bracket_type || '').toLowerCase();
        return bracketType === 'single_elimination' || bracketType === 'double_elimination';
    }, [tournament?.bracket_type]);

    const [actionMessage, setActionMessage] = useState('');
    const [busy, setBusy] = useState(false);

    // Убираем подтверждение/переформирование из этого компонента — всё на странице черновика

    const openDraftPage = useCallback(() => {
        const id = tournament?.id;
        if (!id) return;
        window.open(`/tournaments/${id}/fullmix/draft`, '_blank');
    }, [tournament?.id]);

    const startFirstRound = useCallback(async () => {
        if (!isFullMix) return;
        setBusy(true);
        setActionMessage('Формируем команды для 1 раунда...');
        try {
            await api.post(`/api/tournaments/${tournamentId}/fullmix/start`, {});
            await loadRounds();
            const res = await api.get(`/api/tournaments/${tournamentId}/fullmix/snapshots`);
            const items = (res.data?.items || []).sort((a,b) => a.round_number - b.round_number);
            const last = items.length > 0 ? items[items.length - 1].round_number : 1;
            setCurrentRound(last);
            await loadSnapshot(last);
            setActionMessage('Команды первого раунда созданы');
        } catch (_) {
            setActionMessage('Ошибка формирования команд');
        } finally {
            setBusy(false);
            setTimeout(() => setActionMessage(''), 2500);
        }
    }, [isFullMix, tournamentId, loadRounds, loadSnapshot]);
    if (isLoading || loading) {
        return (
            <SkeletonTheme baseColor="#2a2a2a" highlightColor="#3a3a3a">
                <div className="teams-display-mixteams">
                    <div className="mixed-teams-grid-mixteams">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="mixteam-card-skeleton" style={{ padding: 16, border: '1px solid #1f1f1f', borderRadius: 8, background: '#0a0a0a' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                    <Skeleton circle width={32} height={32} />
                                    <Skeleton width={160} height={16} />
                                </div>
                                <div style={{ display: 'grid', gap: 8 }}>
                                    {[...Array(4)].map((__, j) => (
                                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Skeleton circle width={24} height={24} />
                                            <Skeleton width={160} height={16} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </SkeletonTheme>
        );
    }

    // Для Full Mix не делаем ранний return, чтобы показывать панель управления даже без команд
    if (!isFullMix && (!Array.isArray(teams) || teams.length === 0)) {
        return (
            <div className="no-teams-message-mixteams">
                <h4>Команды еще не сформированы</h4>
                <p>Как только организатор сформирует команды, они появятся здесь.</p>
            </div>
        );
    }
    
    return (
        <div className="teams-display-mixteams">
            {isFullMix && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    {/* 🆕 ДЛЯ SE/DE показываем только информацию о текущем раунде БЕЗ переключения */}
                    {isSEorDE ? (
                        <>
                            <span style={{ color: '#ccc', fontSize: 13 }}>
                                Отображаются команды текущего раунда{currentRound ? ` (Раунд ${currentRound})` : ''}
                            </span>
                            <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>
                                Составы других раундов доступны во вкладке "Сетка"
                            </span>
                        </>
                    ) : (
                        <>
                            {/* ДЛЯ SWISS оставляем переключение раундов */}
                            <span style={{ color: '#ccc', fontSize: 13 }}>Раунды:</span>
                            <div className="fullmixdraft-rounds" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {rounds.map(r => (
                                    <button key={r.round_number} className={`fullmix-round-btn ${r.round_number === currentRound ? 'is-active' : ''}`} disabled={r.round_number === currentRound} onClick={() => setCurrentRound(r.round_number)}>
                                        {r.round_number}
                                    </button>
                                ))}
                                {rounds.length === 0 && <span style={{ color: '#888' }}>Нет раундов</span>}
                            </div>
                        </>
                    )}
                    
                    {isAdminOrCreator && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
                            {rounds.length === 0 && (
                                <button className="btn btn-primary" disabled={busy} onClick={startFirstRound}>Сформировать команды для 1 раунда</button>
                            )}
                            <button className="btn btn-secondary" onClick={openDraftPage}>Открыть черновик</button>
                            {actionMessage && <span style={{ color: '#aaa', fontSize: 12 }}>{actionMessage}</span>}
                        </div>
                    )}
                </div>
            )}

            {teamsToRender.length === 0 ? (
                <div className="no-teams-message-mixteams">
                    <h4>Команды {isFullMix ? 'еще не подтверждены' : 'еще не сформированы'}</h4>
                    <p>
                        {isFullMix 
                            ? 'Для подтверждения составов используйте кнопку «Открыть черновик».' 
                            : 'Как только организатор сформирует команды, они появятся здесь.'}
                    </p>
                </div>
            ) : (
                <div className="mixed-teams-grid-mixteams">
                    {teamsToRender.map((team, idx) => (
                        <MixTeamCard key={team.id || idx} team={team} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default MixTeamsView;


