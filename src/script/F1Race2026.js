/**
 * 赛程倒计时：通过 AJAX(fetch) 加载 data/races.json 后初始化
 */
var RACES = []
var raceCountdownTimer = null
var targetTime = 0
var selectedRaceIndex = -1

var countdownPanel = document.getElementById("race-countdown-panel")
var pastPanel = document.getElementById("race-past-panel")
var selectEl = document.getElementById("race-select")

function getRaceTargetTime(race) {
  var timePart = race.time && race.time.indexOf(":") !== -1 ? race.time : "00:00:00"
  return new Date(race.date.replace(/-/g, "/") + " " + timePart).getTime()
}

function isRacePast(race) {
  return getRaceTargetTime(race) <= Date.now()
}

function updateRaceMeta(race) {
  document.getElementById("race-country").innerText = race.country
  document.getElementById("race-name").innerText = race.name
  document.getElementById("race-date").innerText = race.date
  document.getElementById("race-time").innerText = race.time
    ? race.time + " (local time)"
    : ""
}

function showCountdownPanel() {
  countdownPanel.hidden = false
  pastPanel.hidden = true
}

function showPastPanel() {
  stopCount()
  countdownPanel.hidden = true
  pastPanel.hidden = false
  pastPanel.innerHTML = ""
}

function startCount() {
  stopCount()
  countRun()
  raceCountdownTimer = setInterval(countRun, 1000)
}

function stopCount() {
  clearInterval(raceCountdownTimer)
  raceCountdownTimer = null
}

function countRun() {
  var now = new Date().getTime()
  var diff = targetTime - now

  if (diff <= 0) {
    stopCount()
    document.getElementById("days").innerText = "00"
    document.getElementById("hours").innerText = "00"
    document.getElementById("minutes").innerText = "00"
    document.getElementById("seconds").innerText = "00"
    if (selectedRaceIndex >= 0) {
      showPastPanel()
      syncSelectActive()
    }
    return
  }

  var days = Math.floor(diff / (1000 * 60 * 60 * 24))
  var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  var seconds = Math.floor((diff % (1000 * 60)) / 1000)

  days = days < 10 ? "0" + days : days
  hours = hours < 10 ? "0" + hours : hours
  minutes = minutes < 10 ? "0" + minutes : minutes
  seconds = seconds < 10 ? "0" + seconds : seconds

  document.getElementById("days").innerText = days
  document.getElementById("hours").innerText = hours
  document.getElementById("minutes").innerText = minutes
  document.getElementById("seconds").innerText = seconds
}

function selectRace(index) {
  if (index < 0 || index >= RACES.length) return

  selectedRaceIndex = index
  var race = RACES[index]
  updateRaceMeta(race)
  syncSelectActive()

  if (isRacePast(race)) {
    showPastPanel()
    return
  }

  targetTime = getRaceTargetTime(race)
  showCountdownPanel()
  startCount()
}

function syncSelectActive() {
  var buttons = selectEl.querySelectorAll(".race-time__select-btn")
  buttons.forEach(function (btn, i) {
    btn.classList.toggle("is-active", i === selectedRaceIndex)
    btn.classList.toggle("is-past", isRacePast(RACES[i]))
  })
}

function buildRaceSelect() {
  selectEl.innerHTML = ""

  RACES.forEach(function (race, index) {
    var btn = document.createElement("button")
    btn.type = "button"
    btn.className = "race-time__select-btn"
    if (isRacePast(race)) btn.classList.add("is-past")

    btn.innerHTML =
      '<span class="race-time__select-round">R' +
      (index + 1) +
      "</span>" +
      '<span class="race-time__select-name">' +
      race.country +
      "</span>" +
      '<span class="race-time__select-date">' +
      race.date.slice(5) +
      "</span>"

    btn.addEventListener("click", function () {
      selectRace(index)
    })

    selectEl.appendChild(btn)
  })
}

function getDefaultRaceIndex() {
  for (var i = 0; i < RACES.length; i++) {
    if (!isRacePast(RACES[i])) return i
  }
  return RACES.length - 1
}

/**
 * AJAX 加载赛程并初始化（由 ajax-loader 在接近区块时调用）
 */
function initRaceCountdown() {
  if (!selectEl || !countdownPanel || !pastPanel) return Promise.resolve()

  return fetch("./data/races.json")
    .then(function (res) {
      if (!res.ok) throw new Error("races.json HTTP " + res.status)
      return res.json()
    })
    .then(function (data) {
      RACES = data
      buildRaceSelect()
      selectRace(getDefaultRaceIndex())
    })
    .catch(function (err) {
      console.error("赛程数据加载失败", err)
    })
}

window.initRaceCountdown = initRaceCountdown
