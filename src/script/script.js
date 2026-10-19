var html = document.documentElement
var banner = document.querySelector(".banner")

var locked = true
var animating = false //是否已经在动画中

//锁住
function lock() {
    html.style.overflow = "hidden"
    locked = true
    window.scrollTo(0, 0) //强制回到顶部
}

//解锁
function unlock () {
    html.style.overflow = "auto"
    locked = false
}

//执行的动画
function BannerExited(flag) {
    if (animating) return //如果已经在动画中，直接return
    
    animating = true

    banner.classList.toggle("is-exited", flag) //无则添加，有则删除
    
    //过了动画时间执行了操作
    window.setTimeout(() => {
        animating = false
        if (flag) { //锁住了下一步要解锁
            unlock()
        } else { //解锁了下一步要锁住
            lock()
        }
    }, 900)
}

lock() //一开始先锁住

//鼠标滚轮滚动事件
window.addEventListener("wheel", (e) => {
    if (animating) return

    if (locked == false) {
        if (window.scrollY == 0 && e.deltaY < 0) { //屏幕到首页并且鼠标向上滑动
            lock() //锁住
            BannerExited(false) //执行入场动画
        }
        return
    }

    //锁住的时候 locket == true
    //鼠标向下滑动
    if (e.deltaY > 0)  {
        BannerExited(true)
    } else if (e.deltaY < 0) {
        BannerExited(false)
    }
})

// module 玻璃门：单击开合（拖拽旋转模型不触发）
var moduleEl = document.querySelector(".module")
if (moduleEl) {
    var glassPointer = { x: 0, y: 0 }

    moduleEl.addEventListener("pointerdown", function (e) {
        glassPointer.x = e.clientX
        glassPointer.y = e.clientY
    })

    moduleEl.addEventListener("pointerup", function (e) {
        var dx = Math.abs(e.clientX - glassPointer.x)
        var dy = Math.abs(e.clientY - glassPointer.y)
        // 位移很小视为点击，而非拖拽
        if (dx < 5 && dy < 5) {
            // 玻璃关闭时：点玻璃开启；打开后：点空白可合拢（拖拽模型不触发）
            var onGlass = e.target.closest(".glass_01, .glass_02")
            var isOpen = moduleEl.classList.contains("is-glass-open")
            if (!isOpen && !onGlass) return
            moduleEl.classList.toggle("is-glass-open")
        }
    })
}

// 轮播效果JS（原生 DOM；图片由 ajax-loader 靠近时再赋 src）
var carouselBox = document.querySelector('.carousel-box')
var carouselList = document.querySelector('.carousel-list')
if (carouselBox && carouselList) {
    var imgs = carouselBox.querySelectorAll('img')
    var listImgs = carouselList.querySelectorAll('img')
    var btnPrev = carouselBox.querySelector('.btn-prev')
    var btnNext = carouselBox.querySelector('.btn-next')
    var carouselRoot = carouselBox.closest('.carousel') || carouselBox
    var sectionLun = carouselBox.closest('.section-lun')
    var currentIndex = 0
    var totalImage = imgs.length
    var timer = null
    var interval = 3500
    var isRunning = false
    var isHovering = false
    var isInView = false
    var started = false
    var animationTime = 850
    var animClasses = ['active', 'active2', 'prev', 'prev2', 'is-current']

    function clearAnimClasses(el) {
        animClasses.forEach(function (c) {
            el.classList.remove(c)
        })
    }

    function syncThumbs(index) {
        for (var i = 0; i < listImgs.length; i++) {
            listImgs[i].classList.toggle('active', i === index)
        }
    }

    function settleCurrent(index) {
        for (var i = 0; i < totalImage; i++) {
            clearAnimClasses(imgs[i])
        }
        imgs[index].classList.add('is-current')
        syncThumbs(index)
        currentIndex = index
        isRunning = false
    }

    function startAutoplay() {
        clearInterval(timer)
        if (!isHovering && isInView) timer = setInterval(showNext, interval)
    }

    function stopAutoplay() {
        clearInterval(timer)
        timer = null
    }

    function goTo(index, direction) {
        if (isRunning || totalImage === 0) return
        index = ((index % totalImage) + totalImage) % totalImage
        if (index === currentIndex) return

        var from = currentIndex
        var dir = direction != null ? direction : (index > from ? 1 : -1)
        // 环绕时按最短视觉方向：末→首 用 next，首→末 用 prev
        if (direction == null && Math.abs(index - from) > totalImage / 2) {
            dir = index > from ? -1 : 1
        }
        var suffix = dir < 0 ? '2' : ''

        isRunning = true
        clearInterval(timer)

        for (var i = 0; i < totalImage; i++) {
            clearAnimClasses(imgs[i])
        }
        // 强制重排，确保同向连续切换时动画能重新触发
        void carouselBox.offsetWidth

        imgs[from].classList.add('prev' + suffix)
        imgs[index].classList.add('active' + suffix)
        syncThumbs(index)
        currentIndex = index

        setTimeout(function () {
            settleCurrent(currentIndex)
            startAutoplay()
        }, animationTime)
    }

    function showPrev() {
        goTo(currentIndex - 1, -1)
    }
    function showNext() {
        goTo(currentIndex + 1, 1)
    }

    function startCarousel() {
        if (started) return
        started = true
        settleCurrent(0)
        if (isInView) startAutoplay()
    }

    if (btnPrev) btnPrev.addEventListener('click', showPrev)
    if (btnNext) btnNext.addEventListener('click', showNext)

    for (var t = 0; t < listImgs.length; t++) {
        ;(function (idx) {
            listImgs[idx].addEventListener('click', function () {
                goTo(idx)
            })
        })(t)
    }

    carouselRoot.addEventListener('mouseenter', function () {
        isHovering = true
        clearInterval(timer)
    })
    carouselRoot.addEventListener('mouseleave', function () {
        isHovering = false
        if (!isRunning) startAutoplay()
    })

    // 图片 AJAX 注入完成后启动；已有 src 时（无懒加载）直接启动
    window.addEventListener('carousel:ready', startCarousel)
    var hasSrc = false
    for (var s = 0; s < imgs.length; s++) {
        if (imgs[s].getAttribute('src')) { hasSrc = true; break }
    }
    if (hasSrc) startCarousel()

    if ('IntersectionObserver' in window && sectionLun) {
        var carouselIO = new IntersectionObserver(function (entries) {
            var entry = entries[0]
            isInView = !!(entry && entry.isIntersecting)
            if (isInView) startAutoplay()
            else stopAutoplay()
        }, { threshold: 0.15 })
        carouselIO.observe(sectionLun)
    } else {
        isInView = true
    }
}