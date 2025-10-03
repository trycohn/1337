import React, { useState, useCallback, useEffect } from 'react';
import Joyride, { STATUS, ACTIONS, EVENTS } from 'react-joyride';
import './CustomMatchTour.css';

const TOUR_STORAGE_KEY = 'customMatch_tourCompleted';
const STEP_SKIP_PREFIX = 'customMatch_skipStep_';

const CustomMatchTour = ({ run, onTourEnd }) => {
    const [stepIndex, setStepIndex] = useState(0);
    const [skippedSteps, setSkippedSteps] = useState(() => {
        const skipped = {};
        for (let i = 0; i < 5; i++) {
            skipped[i] = localStorage.getItem(`${STEP_SKIP_PREFIX}${i}`) === 'true';
        }
        return skipped;
    });

    // Debug логирование
    useEffect(() => {
        if (run) {
            console.log('[TOUR] Starting tour, run:', run);
            console.log('[TOUR] Target elements check:');
            console.log('  .custom-match-format-tabs:', document.querySelector('.custom-match-format-tabs'));
            console.log('  .custom-match-team-column:', document.querySelector('.custom-match-team-column'));
        }
    }, [run]);

    const steps = [
        {
            target: 'body',
            content: (
                <div className="tour-step-content">
                    <h4>Добро пожаловать в кастомный матч!</h4>
                    <p>Этот короткий тур поможет вам разобраться с функциями страницы.</p>
                    <p className="tour-tip">💡 Вы можете пропустить любой шаг галочкой ниже</p>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '.custom-match-format-tabs',
            content: (
                <div className="tour-step-content">
                    <h4>Выбор формата матча</h4>
                    <p>Выберите формат игры:</p>
                    <ul>
                        <li><strong>BO1</strong> — одна карта</li>
                        <li><strong>BO3</strong> — до 2 побед (макс. 3 карты)</li>
                        <li><strong>BO5</strong> — до 3 побед (макс. 5 карт)</li>
                    </ul>
                    <p className="tour-tip">💡 При смене формата процедура BAN/PICK сбросится</p>
                </div>
            ),
            placement: 'bottom',
            disableBeacon: true,
        },
        {
            target: '.custom-match-team-column',
            content: (
                <div className="tour-step-content">
                    <h4>Формирование команд</h4>
                    <p>Добавьте игроков в команды:</p>
                    <ul>
                        <li>Нажмите <strong>+</strong> в пустом слоте для приглашения</li>
                        <li>Перетащите игроков между командами (Drag & Drop)</li>
                        <li>Используйте панель справа для поиска друзей</li>
                    </ul>
                    <p className="tour-tip">👑 Первый игрок в команде — капитан (золотая рамка)</p>
                </div>
            ),
            placement: 'right',
        },
        {
            target: '.custom-match-ready-toggle',
            content: (
                <div className="tour-step-content">
                    <h4>Готовность игроков</h4>
                    <p>Перед началом матча:</p>
                    <ul>
                        <li>Каждый игрок отмечает свою готовность</li>
                        <li>Команда готова, когда готовы все участники</li>
                        <li>Админ может принудительно отметить команду готовой</li>
                    </ul>
                    <p className="tour-tip">⚠️ Формат должен быть выбран до начала BAN/PICK</p>
                </div>
            ),
            placement: 'left',
        },
        {
            target: '.custom-match-format-actions button',
            content: (
                <div className="tour-step-content">
                    <h4>Процедура Pick/Ban</h4>
                    <p>После готовности команд:</p>
                    <ul>
                        <li><strong>Капитаны</strong> по очереди банят и пикают карты</li>
                        <li>Последовательность зависит от формата</li>
                        <li>После завершения появятся ссылки подключения</li>
                    </ul>
                    <p className="tour-tip">🎮 Выбранные карты будут подсвечены зелёным</p>
                </div>
            ),
            placement: 'top',
        },
    ];

    const handleJoyrideCallback = useCallback((data) => {
        const { action, index, status, type, lifecycle } = data;

        // Сохраняем пропуск конкретного шага
        if (action === ACTIONS.NEXT || action === ACTIONS.SKIP) {
            const currentStepSkipped = skippedSteps[index];
            if (currentStepSkipped) {
                localStorage.setItem(`${STEP_SKIP_PREFIX}${index}`, 'true');
            }
        }

        // Завершение или пропуск тура
        if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
            localStorage.setItem(TOUR_STORAGE_KEY, 'true');
            if (onTourEnd) onTourEnd();
        }

        // Обновление текущего шага
        if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
            setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
        }
    }, [skippedSteps, onTourEnd]);

    const handleSkipStepToggle = (stepIdx) => {
        setSkippedSteps(prev => {
            const newSkipped = { ...prev, [stepIdx]: !prev[stepIdx] };
            // Сразу сохраняем в localStorage
            if (newSkipped[stepIdx]) {
                localStorage.setItem(`${STEP_SKIP_PREFIX}${stepIdx}`, 'true');
            } else {
                localStorage.removeItem(`${STEP_SKIP_PREFIX}${stepIdx}`);
            }
            return newSkipped;
        });
    };

    // Кастомный Tooltip с галочкой
    const CustomTooltip = ({
        continuous,
        index,
        step,
        backProps,
        closeProps,
        primaryProps,
        tooltipProps,
        skipProps,
    }) => {
        const isLastStep = index === steps.length - 1;
        const isSkipped = skippedSteps[index];

        return (
            <div {...tooltipProps} className="joyride-tooltip">
                <div className="joyride-content">
                    {step.content}
                </div>
                
                <div className="joyride-skip-checkbox">
                    <label>
                        <input
                            type="checkbox"
                            checked={isSkipped}
                            onChange={() => handleSkipStepToggle(index)}
                        />
                        <span>Больше не показывать этот шаг</span>
                    </label>
                </div>

                <div className="joyride-footer">
                    <button {...skipProps} className="joyride-btn joyride-btn-skip">
                        Пропустить тур
                    </button>
                    <div className="joyride-nav">
                        {index > 0 && (
                            <button {...backProps} className="joyride-btn joyride-btn-back">
                                Назад
                            </button>
                        )}
                        {!isLastStep ? (
                            <button {...primaryProps} className="joyride-btn joyride-btn-next">
                                Далее ({index + 1}/{steps.length})
                            </button>
                        ) : (
                            <button {...closeProps} className="joyride-btn joyride-btn-finish">
                                Завершить
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Фильтруем шаги, которые пользователь пометил как "не показывать"
    const activeSteps = steps.filter((step, idx) => !skippedSteps[idx]);

    return (
        <Joyride
            steps={activeSteps.length > 0 ? activeSteps : steps}
            run={run}
            continuous
            showProgress={false}
            showSkipButton={false}
            disableOverlayClose
            disableCloseOnEsc={false}
            stepIndex={stepIndex}
            callback={handleJoyrideCallback}
            tooltipComponent={CustomTooltip}
            styles={{
                options: {
                    primaryColor: '#ff0000',
                    backgroundColor: '#111',
                    textColor: '#fff',
                    overlayColor: 'rgba(0, 0, 0, 0.7)',
                    zIndex: 10000,
                    arrowColor: '#111',
                },
                tooltip: {
                    borderRadius: '8px',
                    padding: 0,
                },
                tooltipContainer: {
                    textAlign: 'left',
                },
                buttonNext: {
                    backgroundColor: '#ff0000',
                    borderRadius: '4px',
                    color: '#fff',
                },
                buttonBack: {
                    color: '#999',
                    marginRight: '10px',
                },
                buttonSkip: {
                    color: '#999',
                },
            }}
            locale={{
                back: 'Назад',
                close: 'Закрыть',
                last: 'Завершить',
                next: 'Далее',
                skip: 'Пропустить',
            }}
        />
    );
};

export default CustomMatchTour;

