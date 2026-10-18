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

// 轮播效果JS（原生 DOM，不依赖 jQuery）
var carouselBox = document.querySelector('.carousel-box')
var carouselList = document.querySelector('.carousel-list')
if (carouselBox && carouselList) {
    var imgs = carouselBox.querySelectorAll('img')
    var listImgs = carouselList.querySelectorAll('img')
    var btnPrev = carouselBox.querySelector('.btn-prev')
    var btnNext = carouselBox.querySelector('.btn-next')
    var currentIndex = 0
    var totalImage = imgs.length
    var timer = null
    var interval = 3500
    var isRunning = false
    var animationTime = 1500

    function showPrev() {
        throthling(-1)
    }
    function showNext() {
        throthling(1)
    }
    function switchImage(tag) {
        var nextIndex = (currentIndex + tag + totalImage) % totalImage
        var currentImg = imgs[currentIndex]
        function str(param) {
            return param === -1 ? '2' : ''
        }
        for (var i = 0; i < totalImage; i++) {
            imgs[i].classList.remove('active', 'active2', 'prev', 'prev2')
            listImgs[i].classList.remove('active')
        }
        currentImg.classList.add('prev' + str(tag))
        imgs[nextIndex].classList.add('active' + str(tag))
        listImgs[nextIndex].classList.add('active')
        currentIndex = nextIndex
    }
    function throthling(tag) {
        if (isRunning) return
        switchImage(tag)
        clearInterval(timer)
        timer = setInterval(showNext, interval)
        isRunning = true
        setTimeout(function () {
            isRunning = false
        }, animationTime)
    }

    if (btnPrev) btnPrev.addEventListener('click', showPrev)
    if (btnNext) btnNext.addEventListener('click', showNext)

    imgs[0].classList.add('active')
    listImgs[0].classList.add('active')
    timer = setInterval(showNext, interval)
}