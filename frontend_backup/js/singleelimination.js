document.addEventListener("DOMContentLoaded", function() {

    /***** Регистрация команд *****/
    let registeredTeams = [];
    document.getElementById("registerTeamButton").addEventListener("click", function() {
      const teamNameInput = document.getElementById("teamNameInput");
      const teamCityInput = document.getElementById("teamCityInput");
      let teamName = teamNameInput.value.trim();
      let teamCity = teamCityInput.value.trim();
      if (teamName === "" || teamCity === "") {
        alert("Пожалуйста, введите название команды и город.");
        return;
      }
      registeredTeams.push({ name: teamName, city: teamCity });
      updateRegisteredTeamsList();
      teamNameInput.value = "";
      teamCityInput.value = "";
    });
    function updateRegisteredTeamsList() {
      const list = document.getElementById("registeredTeamsList");
      list.innerHTML = "";
      registeredTeams.forEach(function(team) {
        const li = document.createElement("li");
        li.textContent = team.name + " (" + team.city + ")";
        list.appendChild(li);
      });
    }

    /***** Конструктор и построение сетки *****/
    let bracketRounds = [];
    let thirdPlaceMatch = null; // матч за 3-е место (если проводится)
    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }
    function Match(round, index, team1, team2) {
      this.round = round;
      this.index = index;
      this.team1 = team1;
      this.team2 = team2;
      this.winner = null;
      this.nextMatch = null;
      this.nextMatchSlot = null;
      this.score1 = null;
      this.score2 = null;
      this.scoreConfirmed = false;
    }
    function buildBracket(teams) {
      let n = teams.length;
      if (n < 2) throw new Error("Необходимо минимум 2 команды для проведения турнира.");
      let rounds = [];
      let shuffledTeams = teams.slice();
      shuffleArray(shuffledTeams);
      let p = Math.pow(2, Math.floor(Math.log2(n)));
      let preliminaryRound = null;
      let mainRound1Teams = [];
      if (n === p) {
        mainRound1Teams = shuffledTeams;
      } else {
        let numPrelimMatches = n - p;
        let numPrelimTeams = 2 * numPrelimMatches;
        let prelimTeams = shuffledTeams.slice(0, numPrelimTeams);
        let byeTeams = shuffledTeams.slice(numPrelimTeams);
        preliminaryRound = [];
        for (let i = 0; i < numPrelimMatches; i++) {
          let match = new Match(0, i, prelimTeams[2 * i], prelimTeams[2 * i + 1]);
          preliminaryRound.push(match);
        }
        rounds.push(preliminaryRound);
        let byeCount = byeTeams.length;
        mainRound1Teams = [];
        for (let i = 0; i < p; i++) {
          if (i < byeCount) {
            mainRound1Teams.push(byeTeams[i]);
          } else {
            mainRound1Teams.push(null);
          }
        }
      }
      let mainRound1Matches = [];
      for (let i = 0; i < mainRound1Teams.length; i += 2) {
        let roundNum = preliminaryRound ? 1 : 0;
        let match = new Match(roundNum, mainRound1Matches.length, mainRound1Teams[i], mainRound1Teams[i + 1]);
        mainRound1Matches.push(match);
      }
      rounds.push(mainRound1Matches);
      if (preliminaryRound) {
        let byeCountVal = mainRound1Teams.length - preliminaryRound.length;
        for (let j = 0; j < preliminaryRound.length; j++) {
          let slot = byeCountVal + j;
          let matchIndex = Math.floor(slot / 2);
          let slotName = (slot % 2 === 0) ? 'team1' : 'team2';
          preliminaryRound[j].nextMatch = mainRound1Matches[matchIndex];
          preliminaryRound[j].nextMatchSlot = slotName;
        }
      }
      let mainRoundMatches = rounds[rounds.length - 1];
      let totalMainTeams = n === p ? n : mainRound1Teams.length;
      let mainRoundsCount = Math.log2(totalMainTeams);
      let remainingRounds = mainRoundsCount - 1;
      while (remainingRounds > 0) {
        let prevRound = mainRoundMatches;
        let nextRoundMatches = [];
        for (let i = 0; i < prevRound.length; i += 2) {
          let match = new Match(rounds.length, nextRoundMatches.length, null, null);
          nextRoundMatches.push(match);
          prevRound[i].nextMatch = match;
          prevRound[i].nextMatchSlot = 'team1';
          if (i + 1 < prevRound.length) {
            prevRound[i + 1].nextMatch = match;
            prevRound[i + 1].nextMatchSlot = 'team2';
          }
        }
        rounds.push(nextRoundMatches);
        mainRoundMatches = nextRoundMatches;
        remainingRounds--;
      }
      // Если n>=4 и чекбокс отмечен, добавляем отдельный раунд для матча за 3-е место
      const needThirdMatch = document.getElementById("thirdPlaceCheckbox").checked;
      if (needThirdMatch && n >= 4) {
        const thirdPlaceRound = [];
        const thirdMatch = new Match(rounds.length, 0, null, null);
        thirdPlaceRound.push(thirdMatch);
        rounds.push(thirdPlaceRound);
      }
      return rounds;
    }

    /***** Распространение результата *****/
    function propagate(match) {
      if (match.nextMatch) {
        let next = match.nextMatch;
        if (match.nextMatchSlot === 'team1') {
          next.team1 = match.winner;
        } else {
          next.team2 = match.winner;
        }
        if (next.winner && next.winner !== next.team1 && next.winner !== next.team2) {
          next.winner = null;
          propagate(next);
        }
      }
    }

    /***** Установка победителя *****/
    function setMatchWinner(match, winner) {
      if (match.winner === winner) return;
      if (match.nextMatch && ((match.nextMatch.score1 !== null && match.nextMatch.score1 !== "") ||
          (match.nextMatch.score2 !== null && match.nextMatch.score2 !== ""))) {
        alert("Невозможно изменить победителя, так как результаты следующего матча уже введены.");
        return;
      }
      if (match.winner && match.winner !== winner) {
        if (!confirm(`Вы уверены, что хотите изменить победителя с ${match.winner} на ${winner}?`))
          return;
        match.scoreConfirmed = false;
      }
      match.winner = winner;
      propagate(match);
      renderBracket();
    }

    /***** Создание элемента команды с обновлёнными цветами *****/
    function createTeamElem(match, team, slot) {
      const teamDiv = document.createElement("div");
      teamDiv.className = "team";
      teamDiv.textContent = team ? team : "TBD";
      if (!team) teamDiv.classList.add("tbd");
      // Если победитель определён, задаём фон: победитель – #212121, проигравший – #151515.
      if (match.winner) {
        if (team === match.winner) {
          teamDiv.style.backgroundColor = "#212121";
          teamDiv.style.color = "#fff";
        } else if (team && team !== "TBD") {
          teamDiv.style.backgroundColor = "#151515";
          teamDiv.style.color = "#fff";
        }
      }
      teamDiv.addEventListener("click", function() {
        setMatchWinner(match, team);
      });
      if (match.winner === team && team) teamDiv.classList.add("winner");
      return teamDiv;
    }

    /***** Отрисовка сетки *****/
    function renderBracket() {
      const container = document.getElementById("bracketContainer");
      container.innerHTML = "";
      const prizeListContainer = document.getElementById("podiumContainer");
      prizeListContainer.innerHTML = "";
      const needThirdMatch = document.getElementById("thirdMatchCheckbox").checked;
      
      // Скрываем последний раунд из основной сетки.
      // Если чекбокс отмечен, выводим раунды с 0 до (bracketRounds.length - 2)
      // Если не отмечен, выводим раунды с 0 до (bracketRounds.length - 1)
      let roundsToShow = needThirdMatch ? bracketRounds.length - 2 : bracketRounds.length - 1;
      for (let r = 0; r < roundsToShow; r++) {
        const roundDiv = document.createElement("div");
        roundDiv.className = "round-column";
        const roundTitle = document.createElement("h2");
        roundTitle.style.textAlign = "center";
        roundTitle.style.color = "#fff";
        if (r === 0 && bracketRounds[0][0].round === 0) {
          roundTitle.textContent = "Предварительный раунд";
        } else {
          roundTitle.textContent = `Раунд ${r + 1}`;
        }
        roundDiv.appendChild(roundTitle);
        bracketRounds[r].forEach(match => {
          const matchDiv = document.createElement("div");
          matchDiv.className = "match";
          const matchLabel = document.createElement("div");
          matchLabel.textContent = `Матч ${match.round}-${match.index + 1}`;
          matchDiv.appendChild(matchLabel);
          const team1Elem = createTeamElem(match, match.team1, 'team1');
          const team2Elem = createTeamElem(match, match.team2, 'team2');
          matchDiv.appendChild(team1Elem);
          matchDiv.appendChild(team2Elem);
          if (match.team1 && match.team2) {
            const scoreContainer = document.createElement("div");
            scoreContainer.className = "score-container";
            const score1Input = document.createElement("input");
            score1Input.type = "number";
            score1Input.placeholder = "Счет 1";
            score1Input.style.width = "40%";
            score1Input.value = match.score1 !== null ? match.score1 : "";
            if (match.scoreConfirmed) score1Input.disabled = true;
            scoreContainer.appendChild(score1Input);
            scoreContainer.appendChild(document.createTextNode(" - "));
            const score2Input = document.createElement("input");
            score2Input.type = "number";
            score2Input.placeholder = "Счет 2";
            score2Input.style.width = "40%";
            score2Input.value = match.score2 !== null ? match.score2 : "";
            if (match.scoreConfirmed) score2Input.disabled = true;
            scoreContainer.appendChild(score2Input);
            const confirmButton = document.createElement("button");
            confirmButton.textContent = "✔";
            confirmButton.className = "confirm-btn";
            confirmButton.style.marginLeft = "5px";
            confirmButton.addEventListener("click", function() {
              if (match.nextMatch && ((match.nextMatch.score1 !== null && match.nextMatch.score1 !== "") ||
                  (match.nextMatch.score2 !== null && match.nextMatch.score2 !== ""))) {
                alert("Невозможно изменить счёт, так как в следующем матче уже введены результаты.");
                return;
              }
              let newScore1 = score1Input.value;
              let newScore2 = score2Input.value;
              match.score1 = newScore1;
              match.score2 = newScore2;
              match.scoreConfirmed = true;
              if (parseInt(newScore1) > parseInt(newScore2)) {
                setMatchWinner(match, match.team1);
              } else if (parseInt(newScore2) > parseInt(newScore1)) {
                setMatchWinner(match, match.team2);
              } else {
                match.winner = null;
              }
              renderBracket();
            });
            scoreContainer.appendChild(confirmButton);
            matchDiv.appendChild(scoreContainer);
          }
          roundDiv.appendChild(matchDiv);
        });
        container.appendChild(roundDiv);
      }
      
      // Финальный столбец – выводим блок финального матча и, если чекбокс отмечен, блок матча за 3-е место.
      const finalMatchColumn = document.createElement("div");
      finalMatchColumn.className = "round-column";
      finalMatchColumn.style.order = 1;
      
      // Определяем финальный матч:
      let finalMatch;
      if (needThirdMatch) {
        // Если проводится матч за 3-е место, финальный матч берем из предпоследнего раунда.
        finalMatch = bracketRounds[bracketRounds.length - 2][0];
      } else {
        finalMatch = bracketRounds[bracketRounds.length - 1][0];
      }
      // Блок финального матча – заголовок красный, центрирован
      const finalMatchDiv = document.createElement("div");
      finalMatchDiv.className = "match";
      const finalTitle = document.createElement("h2");
      finalTitle.textContent = "Финальный матч";
      finalTitle.classList.add("final-label");
      finalTitle.style.textAlign = "center";
      finalMatchDiv.appendChild(finalTitle);
      if (finalMatch) {
        const finalBlock = document.createElement("div");
        finalBlock.className = "match";
        const finalLabel = document.createElement("div");
        finalLabel.textContent = `Матч ${finalMatch.round}-${finalMatch.index + 1}`;
        finalBlock.appendChild(finalLabel);
        const finalTeam1 = createTeamElem(finalMatch, finalMatch.team1, 'team1');
        const finalTeam2 = createTeamElem(finalMatch, finalMatch.team2, 'team2');
        finalBlock.appendChild(finalTeam1);
        finalBlock.appendChild(finalTeam2);
        if (finalMatch.team1 && finalMatch.team2) {
          const finalScoreContainer = document.createElement("div");
          finalScoreContainer.className = "score-container";
          const finalScore1 = document.createElement("input");
          finalScore1.type = "number";
          finalScore1.placeholder = "Счет 1";
          finalScore1.style.width = "40%";
          finalScore1.value = finalMatch.score1 !== null ? finalMatch.score1 : "";
          if (finalMatch.scoreConfirmed) finalScore1.disabled = true;
          finalScoreContainer.appendChild(finalScore1);
          finalScoreContainer.appendChild(document.createTextNode(" - "));
          const finalScore2 = document.createElement("input");
          finalScore2.type = "number";
          finalScore2.placeholder = "Счет 2";
          finalScore2.style.width = "40%";
          finalScore2.value = finalMatch.score2 !== null ? finalMatch.score2 : "";
          if (finalMatch.scoreConfirmed) finalScore2.disabled = true;
          finalScoreContainer.appendChild(finalScore2);
          const finalConfirm = document.createElement("button");
          finalConfirm.textContent = "✔";
          finalConfirm.className = "confirm-btn";
          finalConfirm.style.marginLeft = "5px";
          finalConfirm.addEventListener("click", function() {
            if (finalMatch.nextMatch && ((finalMatch.nextMatch.score1 !== null && finalMatch.nextMatch.score1 !== "") ||
                (finalMatch.nextMatch.score2 !== null && finalMatch.nextMatch.score2 !== ""))) {
              alert("Невозможно изменить счёт, так как в следующем матче уже введены результаты.");
              return;
            }
            let newScore1 = finalScore1.value;
            let newScore2 = finalScore2.value;
            finalMatch.score1 = newScore1;
            finalMatch.score2 = newScore2;
            finalMatch.scoreConfirmed = true;
            if (parseInt(newScore1) > parseInt(newScore2)) {
              setMatchWinner(finalMatch, finalMatch.team1);
            } else if (parseInt(newScore2) > parseInt(newScore1)) {
              setMatchWinner(finalMatch, finalMatch.team2);
            } else {
              finalMatch.winner = null;
            }
            renderBracket();
          });
          finalScoreContainer.appendChild(finalConfirm);
          finalBlock.appendChild(finalScoreContainer);
        }
        finalMatchDiv.appendChild(finalBlock);
      } else {
        finalMatchDiv.textContent = "TBD";
      }
      finalMatchColumn.appendChild(finalMatchDiv);
      
      // Если чекбокс отмечен – отрисовываем блок матча за 3-е место под финальным матчем
      if (needThirdMatch) {
        const thirdMatchDiv = document.createElement("div");
        thirdMatchDiv.className = "match";
        const thirdTitle = document.createElement("h2");
        thirdTitle.textContent = "Матч за 3-е место";
        thirdTitle.classList.add("final-label");
        thirdTitle.style.textAlign = "center";
        thirdMatchDiv.appendChild(thirdTitle);
        if (registeredTeams.length === 3) {
          let prelimMatch = bracketRounds[0][0];
          let loser = "TBD";
          if (prelimMatch.team1 && prelimMatch.team2 && prelimMatch.winner) {
            loser = (prelimMatch.winner === prelimMatch.team1) ? prelimMatch.team2 : prelimMatch.team1;
          }
          thirdPlaceMatch = new Match("TP", 0, loser, "TBD");
          thirdPlaceMatch.scoreConfirmed = true;
        } else if (registeredTeams.length > 3) {
          let semifinalRound;
          if (bracketRounds.length >= 3) {
            semifinalRound = bracketRounds[bracketRounds.length - 3];  // полуфинальный раунд
          } else {
            semifinalRound = bracketRounds[bracketRounds.length - 2];
          }
          if (semifinalRound && semifinalRound.length >= 2) {
            const getLoser = match => (match.winner ? (match.winner === match.team1 ? match.team2 : match.team1) : "TBD");
            thirdPlaceMatch = bracketRounds[bracketRounds.length - 1][0];
            thirdPlaceMatch.team1 = getLoser(semifinalRound[0]);
            thirdPlaceMatch.team2 = getLoser(semifinalRound[1]);
          }
        }
        if (thirdPlaceMatch) {
          const tpTeam1Elem = createTeamElem(thirdPlaceMatch, thirdPlaceMatch.team1, 'team1');
          const tpTeam2Elem = createTeamElem(thirdPlaceMatch, thirdPlaceMatch.team2, 'team2');
          thirdMatchDiv.appendChild(tpTeam1Elem);
          thirdMatchDiv.appendChild(tpTeam2Elem);
          if (thirdPlaceMatch.team1 && thirdPlaceMatch.team2) {
            const tpScoreContainer = document.createElement("div");
            tpScoreContainer.className = "score-container";
            const tpScore1Input = document.createElement("input");
            tpScore1Input.type = "number";
            tpScore1Input.placeholder = "Счет 1";
            tpScore1Input.style.width = "40%";
            tpScore1Input.value = thirdPlaceMatch.score1 !== null ? thirdPlaceMatch.score1 : "";
            if (thirdPlaceMatch.scoreConfirmed) tpScore1Input.disabled = true;
            tpScoreContainer.appendChild(tpScore1Input);
            tpScoreContainer.appendChild(document.createTextNode(" - "));
            const tpScore2Input = document.createElement("input");
            tpScore2Input.type = "number";
            tpScore2Input.placeholder = "Счет 2";
            tpScore2Input.style.width = "40%";
            tpScore2Input.value = thirdPlaceMatch.score2 !== null ? thirdPlaceMatch.score2 : "";
            if (thirdPlaceMatch.scoreConfirmed) tpScore2Input.disabled = true;
            tpScoreContainer.appendChild(tpScore2Input);
            const tpConfirmButton = document.createElement("button");
            tpConfirmButton.textContent = "✔";
            tpConfirmButton.className = "confirm-btn";
            tpConfirmButton.style.marginLeft = "5px";
            tpConfirmButton.addEventListener("click", function() {
              if (thirdPlaceMatch.nextMatch && ((thirdPlaceMatch.nextMatch.score1 !== null && thirdPlaceMatch.nextMatch.score1 !== "") ||
                   (thirdPlaceMatch.nextMatch.score2 !== null && thirdPlaceMatch.nextMatch.score2 !== ""))) {
                alert("Невозможно изменить счёт, так как в следующем матче уже введены результаты.");
                return;
              }
              let newScore1 = tpScore1Input.value;
              let newScore2 = tpScore2Input.value;
              thirdPlaceMatch.score1 = newScore1;
              thirdPlaceMatch.score2 = newScore2;
              thirdPlaceMatch.scoreConfirmed = true;
              if (parseInt(newScore1) > parseInt(newScore2)) {
                setMatchWinner(thirdPlaceMatch, thirdPlaceMatch.team1);
              } else if (parseInt(newScore2) > parseInt(newScore1)) {
                setMatchWinner(thirdPlaceMatch, thirdPlaceMatch.team2);
              } else {
                thirdPlaceMatch.winner = null;
              }
              renderBracket();
            });
            tpScoreContainer.appendChild(tpConfirmButton);
            thirdMatchDiv.appendChild(tpScoreContainer);
          }
          finalMatchColumn.appendChild(thirdMatchDiv);
        }
      }
      
      container.appendChild(finalMatchColumn);
      
      // (Столбец для победителя турнира удалён)
      
      // Обновляем список призёров турнира
      updatePrizeList();
    }

    /***** Функция обновления списка призёров *****/
    function updatePrizeList() {
      const prizeListContainer = document.getElementById("podiumContainer");
      prizeListContainer.innerHTML = "";
      let finalMatchForPrize;
      const needThirdMatch = document.getElementById("thirdMatchCheckbox").checked;
      if (needThirdMatch) {
        finalMatchForPrize = bracketRounds[bracketRounds.length - 2][0];
      } else {
        finalMatchForPrize = bracketRounds[bracketRounds.length - 1][0];
      }
      if (!finalMatchForPrize || !finalMatchForPrize.winner) return;
      const firstPlace = finalMatchForPrize.winner;
      const secondPlace = finalMatchForPrize.winner === finalMatchForPrize.team1 ? finalMatchForPrize.team2 : finalMatchForPrize.team1;
      let thirdPlace = "Не определено";
      if (needThirdMatch && thirdPlaceMatch && thirdPlaceMatch.winner && thirdPlaceMatch.winner !== "TBD") {
        thirdPlace = thirdPlaceMatch.winner;
      }
      const listHTML = `
        <div class="first-prize">🥇 1 место: ${firstPlace}</div>
        <div>🥈 2 место: ${secondPlace}</div>
        <div>🥉 3 место: ${thirdPlace}</div>
      `;
      prizeListContainer.innerHTML = listHTML;
    }

    /***** Обработчик кнопки "Сформировать сетку" *****/
    document.getElementById("generateButton").addEventListener("click", function() {
      const errorDiv = document.getElementById("error");
      errorDiv.textContent = "";
      if (registeredTeams.length < 2) {
        errorDiv.textContent = "Пожалуйста, зарегистрируйте минимум 2 команды.";
        return;
      }
      const teams = registeredTeams.map(team => team.name + " (" + team.city + ")");
      try {
        bracketRounds = buildBracket(teams);
        thirdPlaceMatch = null; // сброс предыдущего матча за 3-е место
        renderBracket();
      } catch (e) {
        errorDiv.textContent = e.message;
      }
    });
  });
