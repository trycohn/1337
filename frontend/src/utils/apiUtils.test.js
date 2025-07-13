/**
 * 🧪 ТЕСТЫ ДЛЯ УТИЛИТ API
 */

import {
  extractTournamentId,
  getNestedValue,
  validateApiResponse,
  handleApiError,
  API_RESPONSE_STRUCTURES
} from './apiUtils';

// Мок для console.log/error
const originalConsole = console;
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

beforeEach(() => {
  global.console = mockConsole;
});

afterEach(() => {
  global.console = originalConsole;
  jest.clearAllMocks();
});

describe('apiUtils', () => {
  describe('getNestedValue', () => {
    test('должен извлекать вложенное значение', () => {
      const obj = { tournament: { id: 123 } };
      expect(getNestedValue(obj, 'tournament.id')).toBe(123);
    });

    test('должен возвращать undefined для несуществующего пути', () => {
      const obj = { tournament: { id: 123 } };
      expect(getNestedValue(obj, 'tournament.nonexistent')).toBeUndefined();
    });
  });

  describe('extractTournamentId', () => {
    test('должен извлекать ID турнира из ответа CREATE_TOURNAMENT', () => {
      const response = {
        data: {
          message: 'Турнир создан',
          tournament: { id: 123 }
        }
      };
      
      expect(extractTournamentId(response, 'CREATE_TOURNAMENT')).toBe(123);
    });

    test('должен возвращать null для некорректного ответа', () => {
      const response = {
        data: {
          message: 'Турнир создан',
          tournament: { id: 'invalid' }
        }
      };
      
      expect(extractTournamentId(response, 'CREATE_TOURNAMENT')).toBeNull();
    });

    test('должен возвращать null для отсутствующего response.data', () => {
      const response = {};
      expect(extractTournamentId(response, 'CREATE_TOURNAMENT')).toBeNull();
    });
  });

  describe('validateApiResponse', () => {
    test('должен валидировать корректную структуру CREATE_TOURNAMENT', () => {
      const response = {
        data: {
          message: 'Турнир создан',
          tournament: { id: 123 }
        }
      };
      
      const result = validateApiResponse(response, 'CREATE_TOURNAMENT');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('должен возвращать ошибки для некорректной структуры', () => {
      const response = {
        data: {
          message: 123, // должно быть строкой
          tournament: { id: 'invalid' } // должно быть числом
        }
      };
      
      const result = validateApiResponse(response, 'CREATE_TOURNAMENT');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('должен валидировать массив для GET_TOURNAMENTS', () => {
      const response = {
        data: [{ id: 1 }, { id: 2 }]
      };
      
      const result = validateApiResponse(response, 'GET_TOURNAMENTS');
      expect(result.isValid).toBe(true);
    });

    test('должен возвращать ошибку для неверного типа массива', () => {
      const response = {
        data: { notAnArray: true }
      };
      
      const result = validateApiResponse(response, 'GET_TOURNAMENTS');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Ожидался массив');
    });
  });

  describe('handleApiError', () => {
    test('должен извлекать сообщение об ошибке из response.data.error', () => {
      const error = {
        response: {
          data: { error: 'Тестовая ошибка' }
        }
      };
      
      const result = handleApiError(error, 'Тест');
      expect(result).toBe('Тестовая ошибка');
    });

    test('должен извлекать сообщение об ошибке из response.data.message', () => {
      const error = {
        response: {
          data: { message: 'Тестовое сообщение' }
        }
      };
      
      const result = handleApiError(error, 'Тест');
      expect(result).toBe('Тестовое сообщение');
    });

    test('должен использовать error.message как fallback', () => {
      const error = {
        message: 'Сообщение из error.message'
      };
      
      const result = handleApiError(error, 'Тест');
      expect(result).toBe('Сообщение из error.message');
    });

    test('должен вызывать onError callback', () => {
      const onError = jest.fn();
      const error = { message: 'Тест' };
      
      handleApiError(error, 'Тест', onError);
      expect(onError).toHaveBeenCalledWith('Тест');
    });
  });
});

// Экспорт для возможного использования в других тестах
export const mockApiResponse = {
  createTournament: {
    success: {
      data: {
        message: 'Турнир успешно создан',
        tournament: { id: 123, name: 'Тестовый турнир' }
      }
    },
    error: {
      response: {
        data: { error: 'Ошибка создания турнира' }
      }
    }
  },
  
  getTournaments: {
    success: {
      data: [
        { id: 1, name: 'Турнир 1' },
        { id: 2, name: 'Турнир 2' }
      ]
    }
  }
}; 