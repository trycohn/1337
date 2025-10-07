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
import AutoSaveIndicator from './components/AutoSaveIndicator';

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
function CreateTournamentWizard({ onBack, initialDraft }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { runWithLoader } = useLoaderAutomatic();

  // Текущий шаг (1-6)
  const [currentStep, setCurrentStep] = useState(
    initialDraft?.current_step || 1 // 🆕 Восстанавливаем шаг из черновика
  );

  // 🆕 Статус автосохранения
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [lastSavedAt, setLastSavedAt] = useState(
    initialDraft?.last_saved_at ? new Date(initialDraft.last_saved_at) : null
  );

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
      logo_file: null, // 🆕 Файл логотипа для загрузки
    },
    
    // Шаг 3: Формат
    format: {
      format: '', // single | double | mix
      bracket_type: 'single_elimination',
      participant_type: 'team', // ✅ Всегда 'team' для Single/Double, 'solo' для Mix
      team_size: 5, // 5 для 5v5, 2 для 2v2
      max_teams: null, // null = не ограничено
      // Для Mix турниров
      mix_type: 'classic', // classic | full
      mix_rating_type: 'faceit',
      wins_to_win: 4,
      require_faceit_linked: false,
      require_steam_linked: false,
      // 🆕 Лист ожидания для командных турниров
      waiting_list_enabled: false,
      waiting_list_require_faceit: false,
      waiting_list_require_steam: false,
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
      logo_file: null,      // Файл для загрузки
      logo_preview: null,   // URL предпросмотра
      logo_url: null,       // URL после загрузки на сервер
      banner_file: null,    // Файл баннера
      banner_preview: null, // URL предпросмотра баннера
      banner_url: null,     // URL баннера после загрузки
      primary_color: '#ff0000',
      secondary_color: '#111111',
      sponsors: [],
      // Pro features
      custom_domain: '',
      hide_1337_branding: false,
    },
  });

  // 🆕 Загрузка данных из черновика при инициализации
  useEffect(() => {
    if (initialDraft && initialDraft.draft_data) {
      console.log('📋 Восстанавливаем черновик:', initialDraft);
      setWizardData(initialDraft.draft_data);
      
      // Показываем уведомление
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [initialDraft]);

  // Сохранение черновика (автосохранение каждые 30 секунд)
  useEffect(() => {
    // Не сохраняем если данные пустые (первая загрузка)
    if (!wizardData.basicInfo.name && !wizardData.format.format) {
      return;
    }

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

      // Показываем индикатор сохранения
      setSaveStatus('saving');

      await axios.post(
        '/api/tournaments/drafts',
        {
          draft_data: wizardData,
          current_step: currentStep,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('✅ Черновик автоматически сохранен');
      
      // Успешное сохранение
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      
      // Через 3 секунды скрываем индикатор "Сохранено"
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
      
    } catch (error) {
      console.error('❌ Ошибка автосохранения черновика:', error);
      
      // Показываем ошибку
      setSaveStatus('error');
      
      // Через 5 секунд скрываем ошибку
      setTimeout(() => {
        setSaveStatus('idle');
      }, 5000);
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
      
      case 4: // Правила
        // Если лобби включено, проверяем карты
        if (wizardData.rules.lobby_enabled) {
          const selectedMaps = wizardData.rules.selected_maps || [];
          if (selectedMaps.length !== 7) {
            return false; // Нужно ровно 7 карт
          }
        }
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
          
          // Лист ожидания для командных турниров (из шага Формат, но может быть переопределено в Правилах)
          waiting_list_enabled: wizardData.format.participant_type === 'team' && 
                               (wizardData.format.format === 'single' || wizardData.format.format === 'double')
            ? (wizardData.format.waiting_list_enabled || false) : false,
          waiting_list_require_faceit: wizardData.format.waiting_list_enabled 
            ? (wizardData.format.waiting_list_require_faceit || false) : false,
          waiting_list_require_steam: wizardData.format.waiting_list_enabled 
            ? (wizardData.format.waiting_list_require_steam || false) : false,
          
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

        // TODO: Обработка загрузки логотипа через FormData
        // Если есть logo_file, нужно сначала загрузить файл, получить URL,
        // затем добавить его в tournamentData.branding.logo_url
        // Пока пропускаем, реализуем в следующей итерации

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

  // Применение шаблона ко всем шагам Wizard
  const applyTemplate = useCallback((templateConfig) => {
    console.log('📋 Применяем шаблон:', templateConfig);
    
    setWizardData(prev => ({
      ...prev,
      // Обновляем basicInfo
      basicInfo: {
        ...prev.basicInfo,
        game: templateConfig.game || prev.basicInfo.game,
        tournament_type: templateConfig.tournament_type || prev.basicInfo.tournament_type,
      },
      // Обновляем format
      format: {
        ...prev.format,
        format: templateConfig.format || prev.format.format,
        bracket_type: templateConfig.bracket_type || prev.format.bracket_type,
        participant_type: templateConfig.participant_type || prev.format.participant_type,
        team_size: templateConfig.team_size || prev.format.team_size,
        max_teams: templateConfig.max_teams || prev.format.max_teams,
        mix_type: templateConfig.mix_type || prev.format.mix_type,
        mix_rating_type: templateConfig.mix_rating_type || prev.format.mix_rating_type,
      },
      // Обновляем rules
      rules: {
        ...prev.rules,
        seeding_type: templateConfig.seeding_type || prev.rules.seeding_type,
        lobby_enabled: templateConfig.lobby_enabled !== undefined 
          ? templateConfig.lobby_enabled 
          : prev.rules.lobby_enabled,
        lobby_match_format: templateConfig.lobby_match_format || prev.rules.lobby_match_format,
        final_match_format: templateConfig.final_match_format || prev.rules.final_match_format,
        enable_final_format: !!templateConfig.final_match_format,
      },
    }));
    
    console.log('✅ Шаблон применен ко всем шагам');
  }, []);

  // Рендер текущего шага
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1_Template
            data={wizardData.template}
            onChange={(template) => updateStepData('template', template)}
            onApplyTemplate={applyTemplate}
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
            onChange={(updatedData) => {
              // Step4 теперь может обновлять и format (для листа ожидания)
              if (updatedData.waiting_list_enabled !== undefined || 
                  updatedData.waiting_list_require_faceit !== undefined ||
                  updatedData.waiting_list_require_steam !== undefined) {
                // Это обновление format (опции листа ожидания)
                updateStepData('format', updatedData);
              } else {
                // Это обновление rules
                updateStepData('rules', updatedData);
              }
            }}
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
        <h1>
          Мастер создания турнира
          {initialDraft && (
            <span style={{ 
              fontSize: '14px', 
              fontWeight: 'normal', 
              color: '#888', 
              marginLeft: '12px' 
            }}>
              (восстановлено из черновика)
            </span>
          )}
        </h1>
        <AutoSaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
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

