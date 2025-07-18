/**
 * 🎯 ТУРНИРНЫЕ УТИЛИТЫ
 * Центральная точка экспорта всех утилит для работы с турнирами
 */

import { formatManager } from './bracketFormats';
import { SingleEliminationFormat } from './formats/SingleEliminationFormat';
import { DoubleEliminationFormat } from './formats/DoubleEliminationFormat';

// Экспортируем менеджер форматов
export { formatManager };

// Экспортируем базовые классы
export { TournamentFormat } from './bracketFormats';

// Экспортируем конкретные форматы
export { SingleEliminationFormat } from './formats/SingleEliminationFormat';
export { DoubleEliminationFormat } from './formats/DoubleEliminationFormat';

// Регистрируем все доступные форматы
const registerFormats = () => {
  // Очищаем существующие форматы
  formatManager.formats.clear();
  
  // Регистрируем Single Elimination
  formatManager.register(new SingleEliminationFormat());
  
  // Регистрируем Double Elimination
  formatManager.register(new DoubleEliminationFormat());
  
  console.log('✅ Зарегистрированы форматы турниров:', {
    formats: formatManager.getAvailableFormats(),
    count: formatManager.formats.size
  });
};

// Автоматически регистрируем форматы при импорте
registerFormats();

// Утилита для получения формата по типу турнира
export const getTournamentFormat = (formatType) => {
  return formatManager.getFormat(formatType);
};

// Утилита для проверки поддержки формата
export const isFormatSupported = (formatType) => {
  return formatManager.getFormat(formatType) !== null;
}; 