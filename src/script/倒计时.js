
    // 计时器id
    var timer = null;
    // 目标比赛时间：2026年10月26日 04:00:00
    const targetTime = new Date("2026-10-26 04:00:00").getTime();

    function startCount() {
        countRun();
        timer = setInterval(countRun, 1000);
    }

    function stopCount() {
        clearInterval(timer);
        timer = null;
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


