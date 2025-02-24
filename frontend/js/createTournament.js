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
  
      // Формируем объект данных для отправки
      const data = {
        name: tournamentName,
        description: tournamentDescription,
        game: tournamentGame,
        type: tournamentType
      };
  
      try {
        // Получаем токен авторизации из localStorage по ключу "jwtToken"
        const token = localStorage.getItem("jwtToken");
        const headers = {
          "Content-Type": "application/json"
        };
  
        // Если токен найден, добавляем его в заголовки запроса
        if (token) {
          headers["Authorization"] = "Bearer " + token;
        } else {
          console.warn("Пользователь не авторизован. Токен отсутствует.");
        }
  
        // Отправляем POST-запрос для создания турнира с заголовками и опцией credentials для отправки cookie
        const response = await fetch("/api/tournaments", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(data)
        });
  
        // Если сервер вернул ошибку, выбрасываем исключение
        if (!response.ok) {
          throw new Error(`Ошибка создания турнира: ${response.status}`);
        }
  
        // Парсим ответ в формате JSON
        const result = await response.json();
  
        // Проверяем, что в ответе присутствуют необходимые данные (ID и имя турнира)
        if (!result.id || !result.name) {
          throw new Error("В ответе отсутствуют необходимые данные турнира");
        }
  
        // Обновляем детали турнира в DOM с сообщением и ссылкой на управление
        updateTournamentDetails(result.id, result.name);
  
        // Дополнительная логика: очистка формы
        createTournamentForm.reset();
  
      } catch (error) {
        console.error("Ошибка при создании турнира:", error);
      }
    });
  });
  
  /**
   * Функция для обновления деталей турнира в DOM.
   * Если необходимые элементы не найдены, они создаются динамически.
   * Теперь выводится сообщение:
   * «Поздравляем, Ваш турнир "название турнира" создан, перейти к управлению?»
   * где "перейти к управлению" – ссылка с data-screen="admin" на страницу управления турниром.
   *
   * @param {number|string} tournamentId - ID созданного турнира
   * @param {string} tournamentName - Название созданного турнира
   */
  function updateTournamentDetails(tournamentId, tournamentName) {
    // Получаем контейнер деталей турнира
    let detailsContainer = document.getElementById("tournamentDetails");
    if (!detailsContainer) {
      console.error("Контейнер tournamentDetails не найден. Создаем новый контейнер.");
      detailsContainer = document.createElement("div");
      detailsContainer.id = "tournamentDetails";
      // Добавляем контейнер в секцию "Мои турниры", если она существует, иначе в body
      const adminSection = document.getElementById("screen-admin");
      if (adminSection) {
        adminSection.appendChild(detailsContainer);
      } else {
        document.body.appendChild(detailsContainer);
      }
    }
  
    // Проверяем наличие элемента заголовка турнира внутри detailsContainer
    let title = detailsContainer.querySelector("#tournamentTitle");
    if (!title) {
      console.error("Элемент tournamentTitle не найден внутри tournamentDetails. Создаем его.");
      title = document.createElement("h3");
      title.id = "tournamentTitle";
      detailsContainer.appendChild(title);
    }
  
    // Проверяем наличие элемента сообщения об успешном создании турнира
    let successMessage = detailsContainer.querySelector("#creationSuccess");
    if (!successMessage) {
      console.error("Элемент creationSuccess не найден внутри tournamentDetails. Создаем его.");
      successMessage = document.createElement("div");
      successMessage.id = "creationSuccess";
      successMessage.style.color = "green";
      successMessage.style.marginBottom = "10px";
      detailsContainer.insertBefore(successMessage, detailsContainer.firstChild);
    }
  
    // Обновляем заголовок турнира (если требуется)
    title.textContent = tournamentName || "Неизвестный турнир";
  
    // Формируем сообщение с ссылкой на управление созданным турниром
    // Обратите внимание, что ссылка получает data-screen="admin", чтобы обработчик маршрутизации мог перехватить клик.
    successMessage.innerHTML = `Поздравляем, Ваш турнир "${tournamentName}" создан. <a href="/admin?tournamentId=${tournamentId}" data-screen="admin">Перейти к управлению</a>?`;
  
    // Сохраняем ID турнира в data-атрибуте контейнера
    detailsContainer.setAttribute("data-tournament-id", tournamentId);
  
    // Показываем контейнер деталей, если он скрыт
    detailsContainer.style.display = "block";
  
    console.log("Обновление деталей, DOM:", detailsContainer);
  }
  