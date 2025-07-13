/**
 * 🔧 УТИЛИТЫ ДЛЯ БЕЗОПАСНОЙ РАБОТЫ С API
 * 
 * Набор функций для валидации и безопасного извлечения данных из API ответов
 */

/**
 * Структуры ответов API
 */
export const API_RESPONSE_STRUCTURES = {
  CREATE_TOURNAMENT: {
    path: 'tournament.id',
    structure: { message: 'string', tournament: { id: 'number' } }
  },
  GET_TOURNAMENT: {
    path: 'id',
    structure: { id: 'number', name: 'string' }
  },
  GET_TOURNAMENTS: {
    path: null,
    structure: 'array'
  },
  UPDATE_TOURNAMENT: {
    path: 'tournament.id',
    structure: { message: 'string', tournament: { id: 'number' } }
  }
};

/**
 * Безопасное извлечение ID турнира из ответа API
 * @param {Object} response - Ответ от API
 * @param {string} responseType - Тип ответа (ключ из API_RESPONSE_STRUCTURES)
 * @returns {number|null} - ID турнира или null
 */
export const extractTournamentId = (response, responseType = 'CREATE_TOURNAMENT') => {
  try {
    if (!response || !response.data) {
      console.error('❌ [extractTournamentId] Некорректный ответ API:', response);
      return null;
    }

    const structure = API_RESPONSE_STRUCTURES[responseType];
    if (!structure) {
      console.error('❌ [extractTournamentId] Неизвестный тип ответа:', responseType);
      return null;
    }

    const { path } = structure;
    if (!path) {
      console.error('❌ [extractTournamentId] Нет пути для извлечения ID:', responseType);
      return null;
    }

    // Извлекаем ID по пути
    const id = getNestedValue(response.data, path);
    
    if (!id || typeof id !== 'number' || id <= 0) {
      console.error('❌ [extractTournamentId] Некорректный ID турнира:', {
        id,
        type: typeof id,
        path,
        responseType,
        responseData: response.data
      });
      return null;
    }

    console.log('✅ [extractTournamentId] ID турнира успешно извлечен:', {
      id,
      responseType,
      path
    });

    return id;
  } catch (error) {
    console.error('❌ [extractTournamentId] Ошибка при извлечении ID:', error);
    return null;
  }
};

/**
 * Получение вложенного значения из объекта по пути
 * @param {Object} obj - Объект
 * @param {string} path - Путь к значению (например, 'tournament.id')
 * @returns {any} - Значение или undefined
 */
export const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
};

/**
 * Безопасная навигация к турниру
 * @param {Function} navigate - Функция навигации от react-router
 * @param {Object} response - Ответ от API
 * @param {string} responseType - Тип ответа
 * @param {Function} onError - Callback при ошибке
 */
export const safeNavigateToTournament = (navigate, response, responseType = 'CREATE_TOURNAMENT', onError = null) => {
  try {
    const tournamentId = extractTournamentId(response, responseType);
    
    if (!tournamentId) {
      const error = new Error('Не удалось извлечь ID турнира для навигации');
      console.error('❌ [safeNavigateToTournament]', error.message);
      
      if (onError) {
        onError(error);
      }
      return false;
    }

    console.log('✅ [safeNavigateToTournament] Навигация к турниру:', tournamentId);
    navigate(`/tournaments/${tournamentId}`);
    return true;
  } catch (error) {
    console.error('❌ [safeNavigateToTournament] Ошибка навигации:', error);
    
    if (onError) {
      onError(error);
    }
    return false;
  }
};

/**
 * Валидация структуры ответа API
 * @param {Object} response - Ответ от API
 * @param {string} responseType - Тип ответа для валидации
 * @returns {Object} - Результат валидации { isValid: boolean, errors: string[] }
 */
export const validateApiResponse = (response, responseType) => {
  const errors = [];
  
  if (!response || !response.data) {
    errors.push('Отсутствует response.data');
    return { isValid: false, errors };
  }

  const structure = API_RESPONSE_STRUCTURES[responseType];
  if (!structure) {
    errors.push(`Неизвестный тип ответа: ${responseType}`);
    return { isValid: false, errors };
  }

  // Валидация для массивов
  if (structure.structure === 'array') {
    if (!Array.isArray(response.data)) {
      errors.push('Ожидался массив');
    }
    return { isValid: errors.length === 0, errors };
  }

  // Валидация для объектов
  if (typeof structure.structure === 'object') {
    for (const [key, expectedType] of Object.entries(structure.structure)) {
      const value = getNestedValue(response.data, key);
      
      if (expectedType === 'string' && typeof value !== 'string') {
        errors.push(`Поле ${key} должно быть строкой`);
      } else if (expectedType === 'number' && typeof value !== 'number') {
        errors.push(`Поле ${key} должно быть числом`);
      } else if (typeof expectedType === 'object' && typeof value !== 'object') {
        errors.push(`Поле ${key} должно быть объектом`);
      }
    }
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Обработчик ошибок API с улучшенным логированием
 * @param {Error} error - Ошибка
 * @param {string} context - Контекст операции
 * @param {Function} onError - Callback при ошибке
 */
export const handleApiError = (error, context = 'API операция', onError = null) => {
  console.error(`❌ [${context}] Ошибка:`, error);
  
  let errorMessage = 'Произошла ошибка при выполнении операции';
  
  if (error.response?.data?.error) {
    errorMessage = error.response.data.error;
  } else if (error.response?.data?.message) {
    errorMessage = error.response.data.message;
  } else if (error.message) {
    errorMessage = error.message;
  }
  
  console.error(`❌ [${context}] Сообщение об ошибке: ${errorMessage}`);
  
  if (onError) {
    onError(errorMessage);
  }
  
  return errorMessage;
};

/**
 * Создание стандартного объекта ошибки для API
 * @param {string} message - Сообщение об ошибке
 * @param {string} code - Код ошибки
 * @param {Object} details - Дополнительные детали
 */
export const createApiError = (message, code = 'API_ERROR', details = {}) => {
  return {
    error: true,
    message,
    code,
    details,
    timestamp: new Date().toISOString()
  };
}; 