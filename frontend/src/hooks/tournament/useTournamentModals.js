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
        setSelectedMatch(match);
        setMatchResultData({
            score1: match.score1 || 0,
            score2: match.score2 || 0,
            maps_data: match.maps_data || []
        });
        setShowMatchResultModal(true);
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