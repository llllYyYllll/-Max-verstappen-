/**
 * 性能优化调度器（AJAX / 动态加载）
 * - 接近区块时再 fetch / 动态 import，避免首屏抢带宽与主线程
 * - 图片用 data-src 延迟赋值
 */
;(function () {
  function whenNear(el, callback, rootMargin) {
    if (!el || typeof callback !== "function") return
    if (!("IntersectionObserver" in window)) {
      callback()
      return
    }
    var done = false
    var io = new IntersectionObserver(
      function (entries) {
        if (done) return
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            done = true
            io.disconnect()
            callback()
            break
          }
        }
      },
      { rootMargin: rootMargin || "600px 0px", threshold: 0.01 }
    )
    io.observe(el)
  }

  function hydrateLazyImages(root) {
    if (!root) return
    var imgs = root.querySelectorAll("img[data-src]")
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i]
      if (img.dataset.src) {
        img.src = img.dataset.src
        img.removeAttribute("data-src")
      }
    }
  }

  function loadScriptOnce(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-ajax-src="' + src + '"]')
      if (existing) {
        if (existing.dataset.loaded === "1") resolve()
        else existing.addEventListener("load", function () { resolve() })
        return
      }
      var s = document.createElement("script")
      s.src = src
      s.async = true
      s.dataset.ajaxSrc = src
      s.onload = function () {
        s.dataset.loaded = "1"
        resolve()
      }
      s.onerror = reject
      document.body.appendChild(s)
    })
  }

  // —— Legacy 时间线图片：靠近再加载 ——
  var historyEl = document.getElementById("history")
  whenNear(historyEl, function () {
    hydrateLazyImages(historyEl)
  })

  // —— 轮播：靠近再加载图片并启动自动播放钩子 ——
  var carouselEl = document.querySelector(".section-lun")
  whenNear(carouselEl, function () {
    hydrateLazyImages(carouselEl)
    window.dispatchEvent(new CustomEvent("carousel:ready"))
  })

  // —— 赛程：AJAX 拉 JSON ——
  var raceEl = document.getElementById("race-countdown")
  whenNear(raceEl, function () {
    loadScriptOnce("./script/F1Race2026.js").then(function () {
      if (typeof window.initRaceCountdown === "function") {
        return window.initRaceCountdown()
      }
    })
  })

  // —— RB26 3D：靠近时再动态加载 Three / 模型（最大开销） ——
  var rb26El = document.getElementById("rb26")
  whenNear(
    rb26El,
    function () {
      import("./rb26.js").catch(function (err) {
        console.error("RB26 模块加载失败", err)
      })
    },
    "800px 0px"
  )
})()
