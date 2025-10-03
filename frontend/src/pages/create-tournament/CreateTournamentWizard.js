// frontend/src/pages/create-tournament/CreateTournamentWizard.js
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import useLoaderAutomatic from '../../hooks/useLoaderAutomaticHook';
import { 
  safeNavigateToTournament, 
  validateApiResponse, 
  handleApiError
} from '../../utils/apiUtils';

// Компоненты Wizard
import WizardProgress from './components/WizardProgress';
import WizardNavigation from './components/WizardNavigation';

// Шаги Wizard (временно заглушки, реализуем позже)
import Step1_Template from './components/steps/Step1_Template';
import Step2_BasicInfo from './components/steps/Step2_BasicInfo';
import Step3_Format from './components/steps/Step3_Format';
import Step4_Rules from './components/steps/Step4_Rules';
import Step5_Branding from './components/steps/Step5_Branding';
import Step6_Preview from './components/steps/Step6_Preview';

import './styles/Wizard.css';

/**
 * Wizard-интерфейс создания турнира
 * Пошаговый процесс с автосохранением и предпросмотром
 */
function CreateTournamentWizard({ onBack }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { runWithLoader } = useLoaderAutomatic();

  // Текущий шаг (1-6)
  const [currentStep, setCurrentStep] = useState(1);

  // Данные всех шагов
  const [wizardData, setWizardData] = useState({
    // Шаг 1: Выбранный шаблон
    template: null,
    
    // Шаг 2: Базовая информация
    basicInfo: {
      name: '',
      description: '',
      game: '',
      start_date: '',
      prize_pool: '',
      tournament_type: 'open', // open | closed | hidden | final
    },
    
    // Шаг 3: Формат
    format: {
      format: '', // single | double | mix
      bracket_type: 'single_elimination',
      participant_type: 'team',
      team_size: 5,
      max_teams: 16,
      cs2_mode: '5v5', // для CS2: '5v5' | '2v2'
      // Для Mix турниров
      mix_type: 'classic', // classic | full
      mix_rating_type: 'faceit',
      wins_to_win: 4,
      require_faceit_linked: false,
      require_steam_linked: false,
    },
    
    // Шаг 4: Правила и карты
    rules: {
      rules: '',
      seeding_type: 'random',
      seeding_config: {},
      // Для CS2 лобби
      lobby_enabled: false,
      lobby_match_format: null,
      selected_maps: [],
      // 🆕 Особый формат для финалов
      enable_final_format: false,
      final_match_format: 'bo3',
    },
    
    // Шаг 5: Брендинг
    branding: {
      logo_url: null,
      banner_url: null,
      primary_color: '#ff0000',
      secondary_color: '#111111',
      sponsors: [],
      // Pro features
      custom_domain: '',
      hide_1337_branding: false,
    },
  });

  // Сохранение черновика (автосохранение каждые 30 секунд)
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      saveDraft();
    }, 30000);

    return () => clearInterval(autoSaveInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData]);

  // Функция сохранения черновика
  const saveDraft = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.post(
        '/api/tournaments/drafts',
        {
          draft_data: wizardData,
          current_step: currentStep,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('✅ Черновик автоматически сохранен');
    } catch (error) {
      console.error('❌ Ошибка автосохранения черновика:', error);
    }
  }, [wizardData, currentStep]);

  // Обновление данных конкретного шага
  const updateStepData = useCallback((step, data) => {
    setWizardData(prev => ({
      ...prev,
      [step]: data,
    }));
  }, []);

  // Валидация текущего шага
  const validateCurrentStep = useCallback(() => {
    switch (currentStep) {
      case 1: // Шаблон (опционален)
        return true;
      
      case 2: // Базовая информация
        return !!(
          wizardData.basicInfo.name &&
          wizardData.basicInfo.game &&
          wizardData.basicInfo.start_date
        );
      
      case 3: // Формат
        return !!(
          wizardData.format.format &&
          wizardData.format.bracket_type &&
          wizardData.format.team_size
        );
      
      case 4: // Правила (опционально)
        return true;
      
      case 5: // Брендинг (опционально)
        return true;
      
      case 6: // Предпросмотр
        return true;
      
      default:
        return false;
    }
  }, [currentStep, wizardData]);

  // Переход на следующий шаг
  const handleNext = useCallback(() => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 6));
      window.scrollTo(0, 0);
    } else {
      alert('Заполните все обязательные поля перед продолжением');
    }
  }, [validateCurrentStep]);

  // Переход на предыдущий шаг
  const handleBack = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo(0, 0);
  }, []);

  // Создание турнира (финальный шаг)
  const handleCreateTournament = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Необходима авторизация');
      return;
    }

    runWithLoader(async () => {
      try {
        console.log('🚀 Создание турнира из Wizard...');
        
        // Собираем все данные из wizard в один объект для API
        const tournamentData = {
          // Из basicInfo
          name: wizardData.basicInfo.name,
          description: wizardData.basicInfo.description,
          game: wizardData.basicInfo.game,
          start_date: wizardData.basicInfo.start_date,
          prize_pool: wizardData.basicInfo.prize_pool,
          tournament_type: wizardData.basicInfo.tournament_type,
          access_type: wizardData.basicInfo.tournament_type === 'closed' || 
                       wizardData.basicInfo.tournament_type === 'hidden' ? 'closed' : 'open',
          is_hidden: wizardData.basicInfo.tournament_type === 'hidden',
          is_series_final: wizardData.basicInfo.tournament_type === 'final',
          
          // Из format
          format: wizardData.format.format,
          bracket_type: wizardData.format.bracket_type,
          participant_type: wizardData.format.participant_type,
          team_size: wizardData.format.team_size,
          max_teams: wizardData.format.max_teams,
          
          // Mix специфичные
          mix_type: wizardData.format.format === 'mix' ? wizardData.format.mix_type : null,
          mix_rating_type: wizardData.format.format === 'mix' ? wizardData.format.mix_rating_type : null,
          wins_to_win: wizardData.format.format === 'mix' && wizardData.format.mix_type === 'full' 
            ? parseInt(wizardData.format.wins_to_win, 10) : null,
          require_faceit_linked: wizardData.format.format === 'mix' && 
                                 wizardData.format.mix_rating_type === 'faceit' 
            ? wizardData.format.require_faceit_linked : false,
          require_steam_linked: wizardData.format.format === 'mix' && 
                                wizardData.format.mix_rating_type === 'premier' 
            ? wizardData.format.require_steam_linked : false,
          
          // Из rules
          rules: wizardData.rules.rules,
          seeding_type: wizardData.rules.seeding_type,
          seeding_config: wizardData.rules.seeding_config,
          lobby_enabled: wizardData.rules.lobby_enabled,
          lobby_match_format: wizardData.rules.lobby_enabled ? wizardData.rules.lobby_match_format : null,
          selected_maps: wizardData.rules.lobby_enabled ? wizardData.rules.selected_maps : [],
          // 🆕 Особый формат для финалов
          final_match_format: wizardData.rules.enable_final_format ? wizardData.rules.final_match_format : null,
          
          // Из branding (сохраняем как JSONB в поле branding)
          branding: {
            logo_url: wizardData.branding.logo_url,
            banner_url: wizardData.branding.banner_url,
            primary_color: wizardData.branding.primary_color,
            secondary_color: wizardData.branding.secondary_color,
            sponsors: wizardData.branding.sponsors,
            custom_domain: wizardData.branding.custom_domain,
            hide_1337_branding: wizardData.branding.hide_1337_branding,
          },
        };

        const response = await axios.post(
          '/api/tournaments',
          tournamentData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        console.log('✅ Турнир создан через Wizard:', response.data);
        
        // Валидация ответа
        const validation = validateApiResponse(response, 'CREATE_TOURNAMENT');
        
        if (!validation.isValid) {
          console.error('❌ Некорректная структура ответа:', validation.errors);
          throw new Error(`Некорректная структура ответа сервера: ${validation.errors.join(', ')}`);
        }
        
        // Переход на страницу турнира
        const navigationSuccess = safeNavigateToTournament(
          navigate, 
          response, 
          'CREATE_TOURNAMENT',
          (error) => {
            console.error('❌ Ошибка навигации:', error);
            alert('Турнир создан, но возникла ошибка при переходе на страницу турнира');
          }
        );
        
        if (!navigationSuccess) {
          throw new Error('Не удалось перейти на страницу созданного турнира');
        }
        
      } catch (error) {
        handleApiError(
          error, 
          'Создание турнира',
          (message) => {
            console.error('❌ Обработанная ошибка:', message);
            alert(message);
          }
        );
      }
    });
  };

  // Рендер текущего шага
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1_Template
            data={wizardData.template}
            onChange={(template) => updateStepData('template', template)}
            onApplyTemplate={(templateData) => {
              // Применяем данные шаблона ко всем шагам
              setWizardData(prev => ({
                ...prev,
                format: { ...prev.format, ...templateData.format },
                rules: { ...prev.rules, ...templateData.rules },
              }));
            }}
          />
        );
      
      case 2:
        return (
          <Step2_BasicInfo
            data={wizardData.basicInfo}
            onChange={(data) => updateStepData('basicInfo', data)}
          />
        );
      
      case 3:
        return (
          <Step3_Format
            data={wizardData.format}
            basicInfo={wizardData.basicInfo}
            onChange={(data) => updateStepData('format', data)}
          />
        );
      
      case 4:
        return (
          <Step4_Rules
            data={wizardData.rules}
            format={wizardData.format}
            basicInfo={wizardData.basicInfo}
            onChange={(data) => updateStepData('rules', data)}
          />
        );
      
      case 5:
        return (
          <Step5_Branding
            data={wizardData.branding}
            user={user}
            onChange={(data) => updateStepData('branding', data)}
          />
        );
      
      case 6:
        return (
          <Step6_Preview
            wizardData={wizardData}
            onEdit={(step) => setCurrentStep(step)}
          />
        );
      
      default:
        return <div>Неизвестный шаг</div>;
    }
  };

  return (
    <div className="tournament-wizard">
      {/* Заголовок с кнопкой возврата */}
      <div className="wizard-header">
        <button className="btn-back" onClick={onBack}>
          ← Назад к выбору режима
        </button>
        <h1>Мастер создания турнира</h1>
        <div className="auto-save-indicator">
          💾 Автосохранение включено
        </div>
      </div>

      {/* Прогресс-бар */}
      <WizardProgress currentStep={currentStep} totalSteps={6} />

      {/* Контент текущего шага */}
      <div className="wizard-content">
        {renderStep()}
      </div>

      {/* Навигация */}
      <WizardNavigation
        currentStep={currentStep}
        totalSteps={6}
        canProceed={validateCurrentStep()}
        onBack={handleBack}
        onNext={handleNext}
        onCreate={handleCreateTournament}
      />
    </div>
  );
}

export default CreateTournamentWizard;

