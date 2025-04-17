import { useState, useCallback } from 'react';
import { useLoader } from '../context/LoaderContext';

/**
 * Хук для автоматического отображения прелоадера при выполнении асинхронных операций
 * @returns {Object} Объект с методами для управления прелоадером
 */
export const useLoaderAutomatic = () => {
  const { setLoading } = useLoader();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Выполняет асинхронную операцию с автоматическим отображением прелоадера
   * @param {Function} asyncFunction - Асинхронная функция для выполнения
   * @param {Object} options - Дополнительные опции
   * @param {number} options.minLoadingTime - Минимальное время отображения прелоадера в мс
   * @returns {Promise<any>} Результат выполнения asyncFunction
   */
  const runWithLoader = useCallback(
    async (asyncFunction, { minLoadingTime = 500 } = {}) => {
      setLoading(true);
      setIsLoading(true);
      
      const startTime = Date.now();
      
      try {
        const result = await asyncFunction();
        
        // Обеспечиваем минимальное время показа прелоадера
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < minLoadingTime) {
          await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime));
        }
        
        return result;
      } finally {
        setLoading(false);
        setIsLoading(false);
      }
    },
    [setLoading]
  );

  return {
    isLoading,
    runWithLoader,
  };
};

export default useLoaderAutomatic; 