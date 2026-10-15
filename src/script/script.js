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
            moduleEl.classList.toggle("is-glass-open")
        }
    })
}