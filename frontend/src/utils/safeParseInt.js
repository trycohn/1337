// Утилитарная функция для безопасного преобразования ID в число
export const safeParseInt = (id) => {
  if (id === undefined || id === null) return null;
  return typeof id === 'string' ? parseInt(id) : id;
};

export default safeParseInt; 