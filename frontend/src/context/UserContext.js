import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

// Создаем контекст пользователя, который просто использует AuthContext внутри
const UserContext = createContext({
  user: null,
  isAuthenticated: false
});

// Провайдер для UserContext, который использует AuthContext
export const UserProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  
  return (
    <UserContext.Provider
      value={{
        user,
        isAuthenticated
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

// Хук для использования контекста пользователя
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser должен использоваться внутри UserProvider');
  }
  return context;
};

export default UserContext; 