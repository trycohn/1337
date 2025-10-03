// frontend/src/pages/create-tournament/CreateTournamentManual.js
// 
// ⚠️ ИНСТРУКЦИЯ ПО МИГРАЦИИ:
// 1. Скопируйте содержимое файла frontend/src/components/CreateTournament.js
// 2. Замените `function CreateTournament()` на `function CreateTournamentManual({ onBack })`
// 3. Добавьте кнопку возврата в начало компонента (см. ниже)
// 4. Измените export: `export default CreateTournamentManual;`
//

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import useLoaderAutomatic from '../../hooks/useLoaderAutomaticHook';
import { useAuth } from '../../context/AuthContext';
import { 
  safeNavigateToTournament, 
  validateApiResponse, 
  handleApiError
} from '../../utils/apiUtils';
import '../../components/CreateTournament.css'; // используем старые стили
import TournamentProgressBar from '../../components/tournament/TournamentProgressBar';

// Регистрируем русскую локаль
registerLocale('ru', ru);

/**
 * Ручная настройка турнира (старый интерфейс)
 * Для опытных организаторов
 */
function CreateTournamentManual({ onBack }) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  // ⚠️ TODO: Скопируйте весь код из CreateTournament.js сюда
  // Включая все useState, useEffect, handleInputChange и т.д.
  
  // Временная заглушка для демонстрации
  return (
    <div className="create-tournament">
      {/* Кнопка возврата к выбору режима */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          className="btn btn-secondary"
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          ← Назад к выбору режима
        </button>
      </div>

      <div style={{ 
        textAlign: 'center', 
        padding: '100px 20px',
        background: '#111',
        borderRadius: '12px',
        border: '1px solid #333'
      }}>
        <h2 style={{ color: '#fff', marginBottom: '20px' }}>
          🚧 Миграция в процессе
        </h2>
        <p style={{ color: '#888', marginBottom: '30px', maxWidth: '600px', margin: '0 auto 30px' }}>
          Для завершения миграции скопируйте содержимое <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: '4px' }}>CreateTournament.js</code> в этот файл.
        </p>
        <p style={{ color: '#ccc', fontSize: '14px' }}>
          Путь: <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: '4px' }}>
            frontend/src/pages/create-tournament/CreateTournamentManual.js
          </code>
        </p>
      </div>
    </div>
  );
}

export default CreateTournamentManual;

