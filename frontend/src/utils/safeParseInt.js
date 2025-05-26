// Утилитарная функция для безопасного преобразования ID в число - версия 2.0
export const safeParseBracketId = (id) => {
  // Проверяем на undefined и null
  if (id === undefined || id === null) return null;
  // Преобразуем строку в число или возвращаем как есть
  const result = typeof id === 'string' ? parseInt(id, 10) : id;
  return result;
};

// Для обратной совместимости
export const safeParseInt = safeParseBracketId;

export default safeParseBracketId; 