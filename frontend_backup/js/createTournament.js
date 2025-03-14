/**
 * createTournament.js
 *
 * Этот файл отвечает за создание турнира.
 * При успешном создании турнира обновляются детали турнира в DOM.
 *
 * После создания турнира выводится сообщение:
 * «Поздравляем, Ваш турнир "название турнира" создан, перейти к управлению?»
 * с ссылкой на страницу управления турниром (с data-screen="admin").
 */
import { generateBracket } from './bracketUtils.js';

document.addEventListener("DOMContentLoaded", () => {
    const createTournamentForm = document.getElementById("createTournamentForm");
    if (!createTournamentForm) {
      console.error("Форма создания турнира не найдена");
      return;
    }
  
    // Обработчик отправки формы создания турнира
    createTournamentForm.addEventListener("submit", async (event) => {
      event.preventDefault(); // предотвращаем стандартное поведение формы
  
      // Получаем данные из формы
      const tournamentName = document.getElementById("tournamentName").value.trim();
      const tournamentDescription = document.getElementById("tournamentDescription").value.trim();
      const tournamentGame = document.getElementById("tournamentGame").value;
      const tournamentType = document.getElementById("tournamentType").value;
      const userId = localStorage.getItem("userId");
  
      // Формируем объект данных для отправки
      const data = {
        name: tournamentName,
        description: tournamentDescription,
        game: tournamentGame,
        type: tournamentType,
        created_by: userId,
      };
  
      try {
        // Получаем токен авторизации из localStorage
        const token = localStorage.getItem("jwtToken");
        const headers = {
          "Content-Type": "application/json",
        };
  
        if (token) {
          headers["Authorization"] = "Bearer " + token;
        } else {
          console.warn("Пользователь не авторизован. Токен отсутствует.");
        }
  
        // Отправляем POST-запрос для создания турнира
        const response = await fetch("/api/tournaments", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(data),
        });
  
        if (!response.ok) {
          throw new Error(`Ошибка создания турнира: ${response.status}`);
        }
  
        const result = await response.json();
  
        if (!result.id || !result.name) {
          throw new Error("В ответе отсутствуют необходимые данные турнира");
        }
  
        // Обновляем детали турнира в DOM
        updateTournamentDetails(result.id, result.name, userId);
  
        // Очистка формы
        createTournamentForm.reset();
      } catch (error) {
        console.error("Ошибка при создании турнира:", error);
      }
    });
  });
  
  /**
   * Функция для обновления деталей турнира в DOM.
   * Добавляет кнопку "Сформировать сетку" с проверкой прав пользователя.
   *
   * @param {number|string} tournamentId - ID созданного турнира
   * @param {string} tournamentName - Название созданного турнира
   * @param {string} userId - ID текущего пользователя
   */
  function updateTournamentDetails(tournamentId, tournamentName, userId) {
    let detailsContainer = document.getElementById("tournamentDetails");
    if (!detailsContainer) {
      console.error("Контейнер tournamentDetails не найден. Создаем новый контейнер.");
      detailsContainer = document.createElement("div");
      detailsContainer.id = "tournamentDetails";
      const adminSection = document.getElementById("screen-admin");
      if (adminSection) {
        adminSection.appendChild(detailsContainer);
      } else {
        document.body.appendChild(detailsContainer);
      }
    }
  
    let title = detailsContainer.querySelector("#tournamentTitle");
    if (!title) {
      title = document.createElement("h3");
      title.id = "tournamentTitle";
      detailsContainer.appendChild(title);
    }
  
    let successMessage = detailsContainer.querySelector("#creationSuccess");
    if (!successMessage) {
      successMessage = document.createElement("div");
      successMessage.id = "creationSuccess";
      successMessage.style.color = "green";
      successMessage.style.marginBottom = "10px";
      detailsContainer.insertBefore(successMessage, detailsContainer.firstChild);
    }
  
    title.textContent = tournamentName || "Неизвестный турнир";
  
    successMessage.innerHTML = `Поздравляем, Ваш турнир "${tournamentName}" создан. <a href="/admin?tournamentId=${tournamentId}" data-screen="admin">Перейти к управлению</a>?`;
  
    // Добавляем кнопку "Сформировать сетку"
    let generateBracketButton = detailsContainer.querySelector("#generateBracketButton");
    if (!generateBracketButton) {
      generateBracketButton = document.createElement("button");
      generateBracketButton.id = "generateBracketButton";
      generateBracketButton.textContent = "Сформировать сетку";
      generateBracketButton.addEventListener("click", () => {
        console.log('tournamentId:', tournamentId); // Проверяем значение
        generateBracket(tournamentId); // Передаем tournamentId
      });
      detailsContainer.appendChild(generateBracketButton);
    }
  
    // Проверка прав пользователя
    const isAdmin = localStorage.getItem("isAdmin") === "true"; // Предполагаем, что роль хранится в localStorage
    const isCreator = userId === userId; // Всегда true, так как это создатель при создании турнира
    const canGenerateBracket = isCreator || isAdmin;
  
    // Управление видимостью кнопки
    generateBracketButton.style.display = canGenerateBracket ? "block" : "none";
  
    detailsContainer.setAttribute("data-tournament-id", tournamentId);
    detailsContainer.style.display = "block";
  
    console.log("Обновление деталей, DOM:", detailsContainer);

    async function createTournament() {

        try {
            await generateBracket(tournamentId);
            alert('Сетка успешно сгенерирована!');
        } catch (error) {
            alert(error.message);
        }
    }
  }
  
  /**
   * Функция-заглушка для генерации сетки.
   * Здесь можно добавить логику генерации сетки турнира.
   *
   * @param {number|string} tournamentId - ID турнира
   */
  // Функция генерации сетки
 

