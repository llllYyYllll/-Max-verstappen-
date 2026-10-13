var header = document.querySelector(".header");
var html = document.documentElement;
var banner = document.querySelector(".banner");
var bannerImgMax = document.querySelector(".banner-img-max");
var bannerImgRb26 = document.querySelector(".banner-img-rb26");
var bannerImgPeople = document.querySelector(".banner-img-people");
// var bannerContent = document.querySelector(".banner .fliter .content");
var bannerTag = document.querySelector(".banner .fliter .content .tag");
var bannerTagSub = document.querySelector(".banner .fliter .content .tag-sub");
var bannerNameFirst = document.querySelector(".banner .fliter .content .name-first");
var bannerNameLast = document.querySelector(".banner .fliter .content .name-last");
var bannerStripsLeft = Array.from(document.querySelectorAll(".banner-img-background.bannerImgLeft"));
var bannerStripsRight = Array.from(document.querySelectorAll(".banner-img-background.bannerImgRight"));
var fliterBg = document.querySelector(".fliter-bg");
var insideContent = document.querySelector(".inside-content");

var about = document.querySelector(".about");

let progress = 0;
var unlocked = false; // 是否解锁
var animating = false; // 是否正在平滑切换
var ANIM_DURATION = 900; // 平滑动画时长
var insideVisible = false;
var aboutVisible = false;

function moveStrips(strips, dir, progress) {
    var x = dir * progress * 110;
    strips.forEach((img) => {
        img.style.transform = `translate3d(${x}vw, 0, 0)`;
    });
}

function scroll(progress) {
    header.style.transform = `translate3d(0, ${-progress * 140}%, 0)`;

    bannerImgMax.style.transform = `translate3d(0, ${progress * 140}vh, 0)`;
    bannerImgRb26.style.transform = `translate3d(0, ${progress * 80}vh, 0)`;
    bannerImgPeople.style.transform = `translate3d(${-progress * 80}vw, 0, 0)`;

    bannerNameFirst.style.transform = `translate3d(${progress * 80}vw, 0, 0)`;
    bannerNameLast.style.transform = `translate3d(${progress * 80}vw, 0, 0)`;
    bannerTag.style.transform = `translate3d(${progress * 80}vw, 0, 0)`;
    bannerTagSub.style.transform = `translate3d(${progress * 80}vw, 0, 0)`;

    moveStrips(bannerStripsLeft, -1, progress);
    moveStrips(bannerStripsRight, 1, progress);

    fliterBg.style.opacity = String(1 - progress);

    var showInside = progress >= 1;
    if (insideContent && showInside !== insideVisible) {
        insideVisible = showInside;
        insideContent.classList.toggle("visible", showInside);
    }

    var showAbout = progress > 0.7;
    if (about && showAbout !== aboutVisible) {
        aboutVisible = showAbout;
        about.classList.toggle("visible", showAbout);
    }
}

function unlock() {
    // 放开
    html.style.overflow = "auto";
    unlocked = true;
}

function lock() {
    // 锁住
    html.style.overflow = "hidden";
    unlocked = false;
    window.scrollTo(0, 0);
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animateTo(target) {
    if (animating) return;
    animating = true;

    if (banner && !banner.classList.contains("anim-done")) {
        banner.classList.add("anim-done");
    }

    var start = progress;
    var startTime = null;

    function frame(now) {
        if (!startTime) startTime = now;
        var t = Math.min(1, (now - startTime) / ANIM_DURATION);
        progress = start + (target - start) * easeInOutCubic(t);
        scroll(progress);

        if (t < 1) {
            requestAnimationFrame(frame);
            return;
        }

        progress = target;
        scroll(progress);
        animating = false;

        if (target >= 1) {
            unlock();
        } else {
            lock();
        }
    }

    requestAnimationFrame(frame);
}

lock();

if (banner) {
    window.setTimeout(function () {
        banner.classList.add("anim-done");
    }, 1400);
}

window.addEventListener("wheel", (e) => {
        if (animating) {
            e.preventDefault();
            return;
        }

        // 已解锁
        if (unlocked) {
            if (window.scrollY <= 0 && e.deltaY < 0) {
                e.preventDefault();
                lock();
                animateTo(0);
            }
            return;
        }

        e.preventDefault();
        if (e.deltaY > 0) {
            animateTo(1);
        } else if (e.deltaY < 0) {
            animateTo(0);
        }
    },
    { passive: false }
);


//  首页导航栏跳转逻辑制作 开始


//  首页导航栏跳转逻辑制作 结束



// 跳转到首页效果制作 开始

// 跳转到首页效果制作 结束