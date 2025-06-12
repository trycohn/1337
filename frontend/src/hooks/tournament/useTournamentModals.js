import { useState, useCallback } from 'react';

const useTournamentModals = () => {
    // Состояния модальных окон
    const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
    const [showParticipantSearchModal, setShowParticipantSearchModal] = useState(false);
    const [showMatchResultModal, setShowMatchResultModal] = useState(false);
    // 🆕 НОВОЕ СОСТОЯНИЕ ДЛЯ АДМИНСКОГО ПОИСКА
    const [showAdminSearchModal, setShowAdminSearchModal] = useState(false);
    
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

    // 🆕 СОСТОЯНИЯ ДЛЯ АДМИНСКОГО РЕЖИМА
    const [adminSearchQuery, setAdminSearchQuery] = useState('');
    const [adminSearchResults, setAdminSearchResults] = useState([]);
    const [isAdminSearching, setIsAdminSearching] = useState(false);

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

    // 🆕 УПРАВЛЕНИЕ МОДАЛЬНЫМ ОКНОМ ПОИСКА АДМИНИСТРАТОРОВ
    const openAdminSearchModal = useCallback(() => {
        setAdminSearchQuery('');
        setAdminSearchResults([]);
        setIsAdminSearching(false);
        setShowAdminSearchModal(true);
    }, []);

    const closeAdminSearchModal = useCallback(() => {
        setShowAdminSearchModal(false);
        setAdminSearchQuery('');
        setAdminSearchResults([]);
        setIsAdminSearching(false);
    }, []);

    // Управление модальным окном результатов матча
    const openMatchResultModal = useCallback((match) => {
        console.log('🔍 [useTournamentModals] openMatchResultModal вызван с параметрами:', {
            match: match,
            matchId: match?.id,
            matchType: typeof match,
            hasId: !!match?.id,
            matchKeys: match ? Object.keys(match) : 'нет объекта'
        });

        if (!match) {
            console.error('❌ [useTournamentModals] КРИТИЧЕСКАЯ ОШИБКА: match не передан в openMatchResultModal!');
            return;
        }

        if (!match.id && match.id !== 0) {
            console.error('❌ [useTournamentModals] КРИТИЧЕСКАЯ ОШИБКА: match.id отсутствует или равен undefined/null!', {
                match,
                id: match.id,
                hasId: !!match.id
            });
            return;
        }

        console.log('✅ [useTournamentModals] Все проверки пройдены, открываем модальное окно');
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

    // Закрытие всех модальных окон
    const closeAllModals = useCallback(() => {
        setShowAddParticipantModal(false);
        setShowParticipantSearchModal(false);
        setShowMatchResultModal(false);
        setShowAdminSearchModal(false); // 🆕 Добавляем админское модальное окно
        
        // Сброс всех данных
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
        
        // 🆕 Сброс админских данных
        setAdminSearchQuery('');
        setAdminSearchResults([]);
        setIsAdminSearching(false);
    }, []);

    // Утилиты для поиска
    const updateSearchResults = useCallback((results) => {
        setSearchResults(results);
    }, []);

    const setSearchLoading = useCallback((loading) => {
        setIsSearching(loading);
    }, []);

    // 🆕 УТИЛИТЫ ДЛЯ АДМИНСКОГО ПОИСКА
    const updateAdminSearchResults = useCallback((results) => {
        setAdminSearchResults(results);
    }, []);

    const setAdminSearchLoading = useCallback((loading) => {
        setIsAdminSearching(loading);
    }, []);

    return {
        // Состояния модальных окон
        showAddParticipantModal,
        showParticipantSearchModal,
        showMatchResultModal,
        showAdminSearchModal, // 🆕 Новое состояние
        
        // Данные для добавления участника
        newParticipantData,
        setNewParticipantData,
        
        // Данные для поиска участников
        searchQuery,
        setSearchQuery,
        searchResults,
        isSearching,
        
        // 🆕 ДАННЫЕ ДЛЯ ПОИСКА АДМИНИСТРАТОРОВ
        adminSearchQuery,
        setAdminSearchQuery,
        adminSearchResults,
        isAdminSearching,
        
        // Данные для результатов матча
        selectedMatch,
        matchResultData,
        setMatchResultData,
        
        // Методы управления модальными окнами
        openAddParticipantModal,
        closeAddParticipantModal,
        openParticipantSearchModal,
        closeParticipantSearchModal,
        openAdminSearchModal, // 🆕 Новый метод
        closeAdminSearchModal, // 🆕 Новый метод
        openMatchResultModal,
        closeMatchResultModal,
        closeAllModals,
        
        // Методы управления поиском участников
        updateSearchResults,
        setSearchLoading,
        
        // 🆕 МЕТОДЫ УПРАВЛЕНИЯ ПОИСКОМ АДМИНИСТРАТОРОВ
        updateAdminSearchResults,
        setAdminSearchLoading
    };
};

export default useTournamentModals; 