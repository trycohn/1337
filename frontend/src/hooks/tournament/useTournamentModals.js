import { useState, useCallback } from 'react';

const useTournamentModals = () => {
    // Состояния модальных окон
    const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
    const [showParticipantSearchModal, setShowParticipantSearchModal] = useState(false);
    const [showMatchResultModal, setShowMatchResultModal] = useState(false);
    
    // Данные для модальных окон
    const [newParticipantData, setNewParticipantData] = useState({
        display_name: '',
        email: '',
        faceit_elo: '',
        cs2_premier_rank: ''
    });
    
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [matchResultData, setMatchResultData] = useState({
        score1: 0,
        score2: 0,
        maps_data: []
    });

    // Управление модальным окном добавления участника
    const openAddParticipantModal = useCallback(() => {
        setNewParticipantData({
            display_name: '',
            email: '',
            faceit_elo: '',
            cs2_premier_rank: ''
        });
        setShowAddParticipantModal(true);
    }, []);

    const closeAddParticipantModal = useCallback(() => {
        setShowAddParticipantModal(false);
        setNewParticipantData({
            display_name: '',
            email: '',
            faceit_elo: '',
            cs2_premier_rank: ''
        });
    }, []);

    // Управление модальным окном поиска участников
    const openParticipantSearchModal = useCallback(() => {
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
        setShowParticipantSearchModal(true);
    }, []);

    const closeParticipantSearchModal = useCallback(() => {
        setShowParticipantSearchModal(false);
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
    }, []);

    // Управление поиском
    const updateSearchResults = useCallback((results) => {
        setSearchResults(results);
        setIsSearching(false);
    }, []);

    const setSearchLoading = useCallback((loading) => {
        setIsSearching(loading);
    }, []);

    // Управление модальным окном результатов матча
    const openMatchResultModal = useCallback((match) => {
        console.log('🔍 [useTournamentModals] openMatchResultModal вызван с параметрами:');
        console.log('🔍 [useTournamentModals] - match:', match);
        console.log('🔍 [useTournamentModals] - тип match:', typeof match);
        console.log('🔍 [useTournamentModals] - match является числом:', typeof match === 'number');
        console.log('🔍 [useTournamentModals] - match является объектом:', typeof match === 'object' && match !== null);
        
        if (typeof match === 'object' && match !== null) {
            console.log('🔍 [useTournamentModals] - ключи объекта match:', Object.keys(match));
            console.log('🔍 [useTournamentModals] - match.id:', match?.id);
        }
        
        // 🔧 TRACE СТЕКА ДЛЯ ОТЛАДКИ
        console.log('🔍 [useTournamentModals] Stack trace:');
        console.trace();

        if (!match && match !== 0) {
            console.error('❌ [useTournamentModals] КРИТИЧЕСКАЯ ОШИБКА: match не передан в openMatchResultModal!');
            return;
        }

        // 🔧 УНИВЕРСАЛЬНАЯ ОБРАБОТКА MATCH
        let matchData = null;
        let matchId = null;
        
        if (typeof match === 'number') {
            console.log('🔧 [useTournamentModals] Получен ID матча как число:', match);
            matchId = match;
            // Создаем минимальный объект матча
            matchData = {
                id: match,
                team1_name: 'Команда 1',
                team2_name: 'Команда 2',
                score1: 0,
                score2: 0,
                maps_data: []
            };
        } else if (typeof match === 'object' && match !== null) {
            console.log('🔧 [useTournamentModals] Получен объект матча:', match);
            matchData = match;
            matchId = match.id;
        } else {
            console.error('❌ [useTournamentModals] Неподдерживаемый тип match:', typeof match, match);
            return;
        }

        if (!matchId && matchId !== 0) {
            console.error('❌ [useTournamentModals] КРИТИЧЕСКАЯ ОШИБКА: не удалось определить ID матча!', {
                match,
                matchData,
                matchId
            });
            return;
        }

        console.log('✅ [useTournamentModals] Устанавливаем selectedMatch:', matchData);
        setSelectedMatch(matchData);
        setMatchResultData({
            score1: matchData.score1 || 0,
            score2: matchData.score2 || 0,
            maps_data: matchData.maps_data || []
        });
        setShowMatchResultModal(true);
        
        console.log('✅ [useTournamentModals] Модальное окно результатов настроено:', {
            selectedMatchId: matchData?.id,
            showModal: true,
            score1: matchData.score1 || 0,
            score2: matchData.score2 || 0,
            mapsCount: matchData.maps_data?.length || 0
        });
    }, []);

    const closeMatchResultModal = useCallback(() => {
        setShowMatchResultModal(false);
        setSelectedMatch(null);
        setMatchResultData({
            score1: 0,
            score2: 0,
            maps_data: []
        });
    }, []);

    // Сброс всех модальных окон
    const closeAllModals = useCallback(() => {
        setShowAddParticipantModal(false);
        setShowParticipantSearchModal(false);
        setShowMatchResultModal(false);
        
        setNewParticipantData({
            display_name: '',
            email: '',
            faceit_elo: '',
            cs2_premier_rank: ''
        });
        
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
        
        setSelectedMatch(null);
        setMatchResultData({
            score1: 0,
            score2: 0,
            maps_data: []
        });
    }, []);

    return {
        // Состояния модальных окон
        showAddParticipantModal,
        showParticipantSearchModal,
        showMatchResultModal,
        
        // Данные для добавления участника
        newParticipantData,
        setNewParticipantData,
        
        // Данные для поиска
        searchQuery,
        setSearchQuery,
        searchResults,
        isSearching,
        
        // Данные для результатов матча
        selectedMatch,
        matchResultData,
        setMatchResultData,
        
        // Методы управления модальными окнами
        openAddParticipantModal,
        closeAddParticipantModal,
        openParticipantSearchModal,
        closeParticipantSearchModal,
        openMatchResultModal,
        closeMatchResultModal,
        closeAllModals,
        
        // Методы управления поиском
        updateSearchResults,
        setSearchLoading
    };
};

export default useTournamentModals; 