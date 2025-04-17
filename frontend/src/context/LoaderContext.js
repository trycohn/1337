import React, { createContext, useState, useContext } from 'react';

const LoaderContext = createContext({
  loading: false,
  setLoading: () => {},
});

export const LoaderProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);

  return (
    <LoaderContext.Provider value={{ loading, setLoading }}>
      {children}
    </LoaderContext.Provider>
  );
};

export const useLoader = () => useContext(LoaderContext);

export default LoaderContext; 