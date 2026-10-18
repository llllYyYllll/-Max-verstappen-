const RACES = [
  { country: "Australia", name: "Australian Grand Prix", date: "2026-03-08", time: "" },
  { country: "China", name: "Chinese Grand Prix", date: "2026-03-15", time: "" },
  { country: "Japan", name: "Japanese Grand Prix", date: "2026-03-29", time: "" },
  { country: "Bahrain", name: "Bahrain Grand Prix", date: "2026-04-12", time: "" },
  { country: "Saudi Arabia", name: "Saudi Arabian Grand Prix", date: "2026-04-19", time: "" },
  { country: "USA", name: "Miami Grand Prix", date: "2026-05-03", time: "" },
  { country: "Canada", name: "Canadian Grand Prix", date: "2026-05-24", time: "" },
  { country: "Monaco", name: "Monaco Grand Prix", date: "2026-06-07", time: "" },
  { country: "Spain", name: "Spanish Grand Prix (Barcelona)", date: "2026-06-14", time: "" },
  { country: "Austria", name: "Austrian Grand Prix", date: "2026-06-28", time: "" },
  { country: "UK", name: "British Grand Prix", date: "2026-07-05", time: "" },
  { country: "Belgium", name: "Belgian Grand Prix", date: "2026-07-19", time: "" },
  { country: "Hungary", name: "Hungarian Grand Prix", date: "2026-07-26", time: "" },
  { country: "Netherlands", name: "Dutch Grand Prix", date: "2026-08-23", time: "" },
  { country: "Italy", name: "Italian Grand Prix (Monza)", date: "2026-09-06", time: "" },
  { country: "Spain", name: "Madrid Grand Prix", date: "2026-09-13", time: "" },
  { country: "Azerbaijan", name: "Azerbaijan Grand Prix", date: "2026-09-26", time: "" },
  { country: "Singapore", name: "Singapore Grand Prix", date: "2026-10-11", time: "" },
  { country: "USA", name: "United States Grand Prix (Austin)", date: "2026-10-25", time: "04:00:00" },
  { country: "Mexico", name: "Mexican Grand Prix", date: "2026-11-01", time: "" },
  { country: "Brazil", name: "Brazilian Grand Prix (São Paulo)", date: "2026-11-08", time: "" },
  { country: "USA", name: "Las Vegas Grand Prix", date: "2026-11-21", time: "" },
  { country: "Qatar", name: "Qatar Grand Prix", date: "2026-11-29", time: "" },
  { country: "UAE", name: "Abu Dhabi Grand Prix", date: "2026-12-06", time: "" },
];

function getRaceTargetTime(race) {
  var timePart = race.time && race.time.indexOf(":") !== -1 ? race.time : "00:00:00";
  return new Date(race.date.replace(/-/g, "/") + " " + timePart).getTime();
}

function isRacePast(race) {
  return getRaceTargetTime(race) <= Date.now();
}

var raceCountdownTimer = null;
var targetTime = 0;
var selectedRaceIndex = -1;

var countdownPanel = document.getElementById("race-countdown-panel");
var pastPanel = document.getElementById("race-past-panel");
var selectEl = document.getElementById("race-select");

function updateRaceMeta(race) {
  document.getElementById("race-country").innerText = race.country;
  document.getElementById("race-name").innerText = race.name;
  document.getElementById("race-date").innerText = race.date;
  document.getElementById("race-time").innerText = race.time
    ? race.time + " (local time)"
    : "";
}

function showCountdownPanel() {
  countdownPanel.hidden = false;
  pastPanel.hidden = true;
}

function showPastPanel() {
  stopCount();
  countdownPanel.hidden = true;
  pastPanel.hidden = false;
  // 已结束赛事：内容区先空着，后续可自行填充
  pastPanel.innerHTML = "";
}

function startCount() {
  stopCount();
  countRun();
  raceCountdownTimer = setInterval(countRun, 1000);
}

function stopCount() {
  clearInterval(raceCountdownTimer);
  raceCountdownTimer = null;
}

function countRun() {
  var now = new Date().getTime();
  var diff = targetTime - now;

  if (diff <= 0) {
    stopCount();
    document.getElementById("days").innerText = "00";
    document.getElementById("hours").innerText = "00";
    document.getElementById("minutes").innerText = "00";
    document.getElementById("seconds").innerText = "00";
    // 倒计时结束后切到空面板
    if (selectedRaceIndex >= 0) {
      showPastPanel();
      syncSelectActive();
    }
    return;
  }

  var days = Math.floor(diff / (1000 * 60 * 60 * 24));
  var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  var seconds = Math.floor((diff % (1000 * 60)) / 1000);

  days = days < 10 ? "0" + days : days;
  hours = hours < 10 ? "0" + hours : hours;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  seconds = seconds < 10 ? "0" + seconds : seconds;

  document.getElementById("days").innerText = days;
  document.getElementById("hours").innerText = hours;
  document.getElementById("minutes").innerText = minutes;
  document.getElementById("seconds").innerText = seconds;
}

function selectRace(index) {
  if (index < 0 || index >= RACES.length) return;

  selectedRaceIndex = index;
  var race = RACES[index];
  updateRaceMeta(race);
  syncSelectActive();

  if (isRacePast(race)) {
    showPastPanel();
    return;
  }

  targetTime = getRaceTargetTime(race);
  showCountdownPanel();
  startCount();
}

function syncSelectActive() {
  var buttons = selectEl.querySelectorAll(".race-time__select-btn");
  buttons.forEach(function (btn, i) {
    btn.classList.toggle("is-active", i === selectedRaceIndex);
    btn.classList.toggle("is-past", isRacePast(RACES[i]));
  });
}

function buildRaceSelect() {
  selectEl.innerHTML = "";

  RACES.forEach(function (race, index) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "race-time__select-btn";
    if (isRacePast(race)) btn.classList.add("is-past");

    btn.innerHTML =
      '<span class="race-time__select-round">R' +
      (index + 1) +
      "</span>" +
      '<span class="race-time__select-name">' +
      race.country +
      "</span>" +
      '<span class="race-time__select-date">' +
      race.date.slice(5) +
      "</span>";

    btn.addEventListener("click", function () {
      selectRace(index);
    });

    selectEl.appendChild(btn);
  });
}

function getDefaultRaceIndex() {
  for (var i = 0; i < RACES.length; i++) {
    if (!isRacePast(RACES[i])) return i;
  }
  return RACES.length - 1;
}

buildRaceSelect();
selectRace(getDefaultRaceIndex());
