# 首页滚轮动画：逐段代码逻辑详解

本文按 `src/script/script.js` 的**书写顺序**，把每一段代码「在干什么、为什么这样写、和前后如何衔接」讲清楚。

整套机制可以先记一句：

> **一次滚轮 = 把 `progress` 平滑推到 0 或 1；`scroll(progress)` 负责根据进度摆好所有元素；`lock` / `unlock` 决定滚轮是「切场景」还是「正常翻页」。**

---

## 第 1 段：抓取 DOM（第 1～16 行）

```js
var header = document.querySelector(".header");
var html = document.documentElement;
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
```

### 逻辑说明

脚本一上来先把动画要用到的节点全部「登记入册」，后面改 `transform` / `opacity` / class 时就不用反复查 DOM。

| 变量 | 对应页面元素 | 动画里扮演什么 |
|------|--------------|----------------|
| `header` | 顶部导航 | 向上滑出 |
| `html` | `<html>` 根元素 | 通过改 `overflow` 锁/解锁页面滚动 |
| `bannerImgMax` | Max 主图 | 向下沉出屏幕 |
| `bannerImgRb26` | 赛车图 | 向下（速度稍慢） |
| `bannerImgPeople` | 人群图 | 向左滑出 |
| `bannerNameFirst` / `bannerNameLast` | Max / Verstappen | 向右甩出 |
| `bannerTag` / `bannerTagSub` | 称号与副标题 | 向右甩出 |
| `bannerStripsLeft` / `Right` | 左右背景条带图数组 | 左右对开拉开 |
| `fliterBg` | 左侧蓝色渐变遮罩 | 透明度随进度下降 |
| `insideContent` | Alonso 引言 | 进度到 1 时淡入 |
| `about` | About 区块 | 进度过 0.7 时淡入 |

### 几个细节

1. **`document.documentElement`**  
   就是 `<html>`。锁滚动时改它的 `overflow`，比改 `body` 更稳（各浏览器滚动容器习惯不同）。

2. **`querySelector` vs `querySelectorAll`**  
   - 单个元素用 `querySelector`，拿到一个节点。  
   - 左右条带各有多张图，用 `querySelectorAll` 拿到 NodeList，再 `Array.from(...)` 转成真正的数组，方便后面 `forEach`。

3. **被注释掉的 `bannerContent`**  
   说明曾经可能想整块移动 `.content`，后来改成分别控制姓名、tag 等子元素，所以整块选择器废弃了。

4. **为什么要提前缓存？**  
   动画每帧都会调用 `scroll(progress)`。若每帧都 `querySelector`，既浪费又容易写乱。缓存一次，后面只改样式。

---

## 第 2 段：状态变量（第 18～21 行）

```js
let progress = 0;
var unlocked = false; // 是否解锁
var animating = false; // 是否正在平滑切换
var ANIM_DURATION = 900; // 平滑动画时长（毫秒）
```

### 逻辑说明

这四行是整套动画的「仪表盘」：

| 变量 | 初值 | 含义 | 谁改它 |
|------|------|------|--------|
| `progress` | `0` | 首页演出进度，`0`=全员在场，`1`=全员退场 | `animateTo` 每一帧 |
| `unlocked` | `false` | `false`=禁止自由滚动；`true`=可正常浏览 | `lock` / `unlock` |
| `animating` | `false` | 是否正在 900ms 过渡中 | `animateTo` 开始/结束 |
| `ANIM_DURATION` | `900` | 过渡总时长（毫秒） | 常量，一般不改运行时值 |

### 为什么用 `let progress`？

因为后面会不断重新赋值：`progress = start + ...`。用 `let` 语义上表示「会变」；其余标志用 `var` 也可以，这里主要是习惯差异，不影响逻辑。

### 三者如何配合？

```
progress   → 画面「长什么样」
unlocked   → 滚轮「算切场景还是算翻页」
animating  → 现在「能不能响应新的滚轮」
```

没有这三面旗帜，滚轮事件里就会一团乱：不知道该不该 `preventDefault`，也不知道该推到 0 还是 1。

---

## 第 3 段：`moveStrips` —— 批量移动背景条带（第 23～27 行）

```js
function moveStrips(strips, dir, progress) { //背景条带滑动
    strips.forEach((img) => {
        img.style.transform = `translateX(${dir * progress * 110}vw)`;
    });
}
```

### 逻辑说明

这是一个**小工具函数**：给一组图片统一设置水平位移。

参数拆开看：

- **`strips`**：图片数组（左组或右组）。
- **`dir`**：方向系数。  
  - `-1` → 结果为负 → 向左移。  
  - `1` → 结果为正 → 向右移。
- **`progress`**：0～1 的进度。`0` 时位移为 0；`1` 时位移为 `±110vw`。

公式：

```
位移 X = dir × progress × 110vw
```

举例（左组，`dir = -1`）：

| progress | 计算 | 结果 |
|----------|------|------|
| 0 | `-1 × 0 × 110` | `0`（原位） |
| 0.5 | `-1 × 0.5 × 110` | `-55vw`（移出半个多屏） |
| 1 | `-1 × 1 × 110` | `-110vw`（完全离开视野） |

### 为什么是 `110vw` 而不是 `100vw`？

条带本身很宽（CSS 里宽度约 `140%`），还带 `clip-path`。如果只移 `100vw`，边缘可能还露一点。多移一点（`110vw`），保证退场干净。

### 为什么单独抽函数？

`scroll` 里要写两次几乎一样的循环（左组、右组）。抽成 `moveStrips` 后，调用只剩：

```js
moveStrips(bannerStripsLeft, -1, progress);
moveStrips(bannerStripsRight, 1, progress);
```

意图一眼能看懂：**左组往左、右组往右**。

---

## 第 4 段：`scroll(progress)` —— 根据进度摆姿势（第 29～64 行）

这是**导演函数**：不听滚轮、不算时间，只认一个输入 `progress`，然后把所有视觉状态刷一遍。

### 4.1 导航栏向上（第 30 行）

```js
header.style.transform = `translateY(${-progress * 140}%)`;
```

- 负号 = 向上。
- `140%`：相对自身高度移动 1.4 倍，确保导航完全离开可视区（不只刚好贴边）。
- `progress = 0` → `0`；`progress = 1` → `-140%`。

### 4.2 三张主视觉图（第 32～34 行）

```js
bannerImgMax.style.transform = `translateY(${progress * 140}vh)`;
bannerImgRb26.style.transform = `translateY(${progress * 80}vh)`;
bannerImgPeople.style.transform = `translateX(${-progress * 80}vw)`;
```

| 行 | 元素 | 方向 | 幅度 | 设计意图 |
|----|------|------|------|----------|
| Max | 向下 | `140vh` | 主角退场最明显、最「重」 |
| RB26 | 向下 | `80vh` | 同向下但更慢 → 视差 |
| People | 向左 | `80vw` | 横向离场，和纵向层形成交叉运动 |

单位混用 `vh` / `vw`：纵向移动跟视口高度走，横向跟视口宽度走，换不同屏幕比例时比例感仍在。

### 4.3 文字向右甩出（第 36～39 行）

```js
bannerNameFirst.style.transform = `translateX(${progress * 80}vw)`;
bannerNameLast.style.transform = `translateX(${progress * 80}vw)`;
bannerTag.style.transform = `translateX(${progress * 80}vw)`;
bannerTagSub.style.transform = `translateX(${progress * 80}vw)`;
```

四个文字节点用**同一套公式**：一起向右飞 `80vw`。  
这样姓名和称号像同一块「标题层」被掀走，不会各飞各的显得散。

### 4.4 背景条带对开（第 41～43 行）

```js
// 背景条带：左组向左、右组向右
moveStrips(bannerStripsLeft, -1, progress);
moveStrips(bannerStripsRight, 1, progress);
```

调用上一节的工具函数。画面效果像舞台幕布左右拉开，中间空出给引言。

### 4.5 渐变遮罩淡出（第 45～46 行）

```js
// 背景渐变随滚动渐渐消失
fliterBg.style.opacity = `${1 - progress}`;
```

- `progress = 0` → 透明度 `1`（遮罩最浓）。
- `progress = 1` → 透明度 `0`（完全看不见）。

和位移不同：这里改的是 **`opacity`**。遮罩不用飞走，只要「化掉」即可，逻辑更简单，也避免多余图层位移。

### 4.6 引言的显示/隐藏（第 48～55 行）

```js
// 滚动结束后才显示引言
if (insideContent) {
    if (progress >= 1) {
        insideContent.classList.add("visible");
    } else {
        insideContent.classList.remove("visible");
    }
}
```

逻辑拆两层：

1. **`if (insideContent)`**  
   防御性判断：万一 HTML 里没有这个节点，不报错、不中断后面动画。

2. **`progress >= 1` 才加 `visible`**  
   引言要等首页元素基本退场完毕再出场，避免和 Max、姓名叠在一起抢戏。  
   CSS 里 `.inside-content` 默认 `opacity: 0`，`.visible` 变成 `1` 并带 `transition`，所以 JS 只负责「开关 class」，淡入动画交给 CSS。

回退时（`progress` 从 1 回到小于 1）：立刻 `remove("visible")`，引言消失，为首页重聚腾地方。

### 4.7 About 区块的提前淡入（第 57～63 行）

```js
if (about) {
    if (progress > 0.7) {
        about.classList.add("visible");
    } else {
        about.classList.remove("visible");
    }
}
```

和引言类似，但阈值更早：`> 0.7`。

时间线对比：

```
progress:   0.0          0.7              1.0
            │            │                │
画面:       首页完整    About 开始淡入    引言出现 + 解锁
```

About 提前出现，是为了让「第一幕结束 → 第二幕正文」衔接更顺：用户感觉下面内容已经在准备就绪，而不是动画播完才突然蹦出一块黑底。

### 4.8 整段 `scroll` 的本质

```
输入: progress (0~1)
输出: 一系列 style / class 更新
特点: 纯函数味道——同样的 progress，画面应一致
```

所以后面 `animateTo` 每一帧只要改 `progress` 再调用一次 `scroll`，动画就自动连贯。

---

## 第 5 段：`unlock` / `lock` —— 闸门开关（第 66～77 行）

```js
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
```

### `unlock` 在干什么？

1. `overflow = "auto"`：允许页面出现滚动条、允许原生滚动。
2. `unlocked = true`：告诉滚轮监听器——现在进入「自由浏览模式」。

通常在 **`animateTo(1)` 播完** 后调用：第一幕结束，把控制权还给用户。

### `lock` 在干什么？

1. `overflow = "hidden"`：禁止原生滚动（和 CSS 里 `html { overflow: hidden }` 同一思路，JS 再强调一次）。
2. `unlocked = false`：滚轮再次变成「切场景按钮」。
3. `window.scrollTo(0, 0)`：强制滚回顶部。

为什么要 `scrollTo`？  
若用户已经滚到 About 再触发「回首页动画」，若不先拉回顶部，页面可能停在半截，和首页退场/入场叠在一起会错位。先归零，再播 `animateTo(0)`，坐标系统一。

### 对称关系

| | 浏览器滚动 | 逻辑标志 | 额外动作 |
|--|------------|----------|----------|
| `lock` | 关 | `unlocked = false` | 滚到顶 |
| `unlock` | 开 | `unlocked = true` | 无 |

---

## 第 6 段：`easeInOutCubic` —— 缓动曲线（第 79～81 行）

```js
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
```

### 逻辑说明

输入输出都是 **0～1**：

- 输入 `t`：时间走了百分之几（线性）。
- 输出：进度应该走到百分之几（非线性）。

### 分段理解

**前半段（`t < 0.5`）**：`4 * t³`

| t | 输出（约） | 含义 |
|---|------------|------|
| 0 | 0 | 静止 |
| 0.25 | 0.0625 | 才动一点点 |
| 0.5 | 0.5 | 到达中点 |

开始慢、后半程加速 → 像轻踩油门。

**后半段（`t ≥ 0.5`）**：`1 - ((-2t+2)³)/2`

从中点到终点对称减速，结尾不「撞墙」。

### 若不用缓动会怎样？

直接 `progress = start + (target - start) * t` 是匀速直线运动，看起来机械。套上 cubic ease-in-out 后，有加速和收油，更像物理运动。

---

## 第 7 段：`animateTo(target)` —— 平滑插值引擎（第 83～114 行）

```js
/** 平滑将 progress 动画到 target（0 或 1） */
function animateTo(target) {
    if (animating) return;
    animating = true;

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
```

这是全文件最核心的「发动机」。下面按执行顺序拆。

### 7.1 防重入（第 85～86 行）

```js
if (animating) return;
animating = true;
```

- 若已经在播动画，直接忽略新的 `animateTo` 调用。  
- 否则立刻把 `animating` 设为 `true`，占住「赛道」。

没有这两行，用户狂滚会启动多个 `requestAnimationFrame` 循环，同时改 `progress`，画面会抖、状态会乱。

### 7.2 记录起点（第 88～89 行）

```js
var start = progress;
var startTime = null;
```

- `start`：动画开始那一刻的进度（可能是 0、1，或中途某个值——虽然当前交互几乎只在 0/1 之间跳）。
- `startTime`：第一帧的时间戳，先留空，等浏览器回调时再填。

### 7.3 内部函数 `frame(now)` —— 每一帧做什么

浏览器通过 `requestAnimationFrame(frame)` 传入 `now`（高精度时间戳，单位毫秒）。

#### （1）锁定起始时间

```js
if (!startTime) startTime = now;
```

第一帧才赋值，保证「动画计时」从真正开始绘制的那一刻算起。

#### （2）计算线性时间比例 `t`

```js
var t = Math.min(1, (now - startTime) / ANIM_DURATION);
```

- `(now - startTime)`：已经过了多少毫秒。
- 除以 `900`：变成 0～1 的比例。
- `Math.min(1, ...)`：防止最后一帧超过 1（例如掉帧后时间跳得很猛）。

#### （3）用缓动把 `progress` 插到目标

```js
progress = start + (target - start) * easeInOutCubic(t);
scroll(progress);
```

标准线性插值（lerp）公式：

```
当前值 = 起点 + (终点 - 起点) × 比例
```

这里的「比例」不是裸的 `t`，而是 `easeInOutCubic(t)`。

然后立刻 `scroll(progress)`，把这一帧的画面刷出去。

#### （4）没播完就预约下一帧

```js
if (t < 1) {
    requestAnimationFrame(frame);
    return;
}
```

`t` 还没到 1 → 继续循环。这就是「动画循环」的心跳。

#### （5）播完：定格 + 收旗 + 开关锁

```js
progress = target;
scroll(progress);
animating = false;

if (target >= 1) {
    unlock();
} else {
    lock();
}
```

| 步骤 | 作用 |
|------|------|
| `progress = target` | 消除浮点误差，保证最终精确是 0 或 1 |
| `scroll(progress)` | 用精确值再刷一次，避免停在 0.999 |
| `animating = false` | 允许下一次滚轮生效 |
| `target >= 1` → `unlock` | 冲出首页后开放自由滚动 |
| 否则 → `lock` | 回到首页后继续锁滚动 |

### 7.4 启动第一帧（第 113 行）

```js
requestAnimationFrame(frame);
```

函数末尾挂上第一帧。之后由 `frame` 内部自己链式调用，直到结束。

### 7.5 调用约定

当前业务里 `target` 只会出现：

- `animateTo(1)`：首页 → 退场完成
- `animateTo(0)`：退场状态 → 首页归位

---

## 第 8 段：开机即上锁（第 116 行）

```js
lock();
```

### 逻辑说明

脚本解析执行到这里时：

1. 函数都已定义完毕。
2. 立刻 `lock()`：关掉原生滚动、`unlocked = false`、滚到顶部。

这样用户一打开页面就处于「首页演出模式」——滚轮不会先把页面滚下去，而是等着触发 `animateTo`。

注意：`progress` 初值已是 `0`，此时**不必**再调 `scroll(0)`，因为 HTML/CSS 初始样式就是「全员在场」的样子；`scroll` 主要在动画过程中覆盖 `transform`。

---

## 第 9 段：滚轮监听 —— 总调度台（第 118～144 行）

```js
window.addEventListener("wheel", (e) => {
        if (animating) {
            e.preventDefault();
            return;
        }

        // 已解锁
        if (unlocked) {
            // 回到页面最顶部且继续上滑 → 重新进入首页动画
            if (window.scrollY <= 0 && e.deltaY < 0) {
                e.preventDefault();
                lock();
                animateTo(0);
            }
            return;
        }

        // 未解锁：滚一下直接平滑切到下一屏 / 上一屏
        e.preventDefault();
        if (e.deltaY > 0) {
            animateTo(1);
        } else if (e.deltaY < 0) {
            animateTo(0);
        }
    },
    { passive: false }
);
```

### 9.1 为什么第三个参数是 `{ passive: false }`？

默认很多浏览器把 `wheel` 当成 passive 监听：你不能 `preventDefault`，浏览器照样滚。

这里必须拦住默认滚动（否则未解锁时页面会跟手乱滚，和自定义动画打架），所以显式声明 **`passive: false`**，允许调用 `e.preventDefault()`。

### 9.2 分支一：动画进行中（第 119～122 行）

```js
if (animating) {
    e.preventDefault();
    return;
}
```

- 正在播 900ms 过渡 → **吞掉**这次滚轮。
- 既阻止默认滚动，也不启动新的 `animateTo`。
- 手感：一拨一下、播完再说，不会中途被打断或叠加。

### 9.3 分支二：已解锁（第 124～133 行）

```js
if (unlocked) {
    if (window.scrollY <= 0 && e.deltaY < 0) {
        e.preventDefault();
        lock();
        animateTo(0);
    }
    return;
}
```

此时用户本应自由浏览。监听器大部分时候「什么都不做」——注意分支末尾有个 **`return`**：

- 若满足「在顶部 + 向上滚」：特殊处理（见下）。
- 若不满足：直接 `return`，**不** `preventDefault`，浏览器自己负责滚动。这就是「解锁后正常翻页」的关键。

#### 特殊情况：顶部继续上滑

条件要**同时**成立：

1. `window.scrollY <= 0`：已经在（或几乎在）页面最顶端。  
2. `e.deltaY < 0`：滚轮方向向上（内容想往下走的反方向——用户手势是「再往上翻」）。

于是：

1. `preventDefault()`：别让浏览器做橡皮筋/无效滚动。
2. `lock()`：重新禁止自由滚动，并确保在顶部。
3. `animateTo(0)`：把首页元素从退场状态动画回原位。

这就是「看完正文 → 滚回顶 → 再上滑 → 首页重演」的回路。

### 9.4 分支三：未解锁（第 135～141 行）

```js
e.preventDefault();
if (e.deltaY > 0) {
    animateTo(1);
} else if (e.deltaY < 0) {
    animateTo(0);
}
```

首页阶段，**每一次**滚轮都先禁止默认行为，然后只看方向：

| `deltaY` | 用户手势 | 动作 |
|----------|----------|------|
| `> 0` | 向下滚 | `animateTo(1)` 冲出首页 |
| `< 0` | 向上滚 | `animateTo(0)` 收回首页 |
| `=== 0` | 极少见（横向滚轮等） | 两支都不进，等于只阻止了默认 |

要点：这里**不是**把 `deltaY` 累加到 `progress` 上，而是「触发一次完整过渡」。  
所以叫「滚一下切一屏」，不是「跟手拖动进度条」。

### 9.5 整段决策树（对照代码）

```
wheel 事件到来
│
├─ animating === true
│     → preventDefault + return
│
├─ unlocked === true
│     ├─ scrollY<=0 且 deltaY<0
│     │     → preventDefault → lock → animateTo(0)
│     └─ 其他
│           → return（放行给浏览器）
│
└─ unlocked === false
      → preventDefault
      ├─ deltaY > 0 → animateTo(1)
      └─ deltaY < 0 → animateTo(0)
```

---

## 第 10 段：预留注释区（第 147～156 行）

```js
//  首页导航栏跳转逻辑制作 开始
//  首页导航栏跳转逻辑制作 结束

// 跳转到首页效果制作 开始
// 跳转到首页效果制作 结束
```

### 逻辑说明

目前是**空占位**，没有可执行代码。  
从注释可以看出后续计划：

1. 点击导航（Home / About 等）时的跳转逻辑。  
2. 「跳回首页」时可能要复用 `lock` + `animateTo(0)` 这一套。

它们和滚轮动画会共享同一套状态（`progress` / `unlocked`），所以预留在同一文件是合理的。

---

## 附录 A：一次「向下滚出发车」的完整调用链

按时间顺序 Occurs：

1. 页面加载 → 执行 `lock()` → 无法自由滚动。  
2. 用户向下拨滚轮 → `wheel` 触发。  
3. `animating` 为 false，`unlocked` 为 false → 走未解锁分支。  
4. `preventDefault()` → `animateTo(1)`。  
5. `animating = true`，开始 rAF 循环。  
6. 约 900ms 内：`progress` 0→1，每帧 `scroll(progress)`：  
   - 图文条带移动、遮罩变淡；  
   - 过 0.7 时 About 加 `visible`；  
   - 到 1 时引言加 `visible`。  
7. 结束：`progress = 1`，`animating = false`，`unlock()`。  
8. 此后滚轮大多交给浏览器；只有「顶部再上滑」会触发回首页。

---

## 附录 B：各函数职责速查

| 函数 / 片段 | 一句话职责 |
|-------------|------------|
| DOM 变量区 | 缓存节点，避免每帧查找 |
| 状态变量 | 记录进度、锁、是否在动画 |
| `moveStrips` | 批量设置条带 `translateX` |
| `scroll` | 根据 `progress` 更新全部视觉 |
| `unlock` / `lock` | 开关原生滚动 + 同步 `unlocked` |
| `easeInOutCubic` | 把线性时间变成先加速后减速 |
| `animateTo` | 在时长内插值 `progress` 并收尾开/上锁 |
| `lock()` 调用 | 进页即进入首页模式 |
| `wheel` 监听 | 根据状态决定忽略 / 回首页 / 切屏 |
| 底部注释 | 预留导航跳转，尚无逻辑 |

---

## 附录 C：想改手感时改哪一行

| 目标 | 位置 |
|------|------|
| 动画更快/更慢 | `ANIM_DURATION = 900` |
| 缓动更冲/更肉 | `easeInOutCubic` |
| Max 沉得更深 | `scroll` 里 `140vh` |
| 赛车跟得更紧/更慢 | `80vh` |
| 文字甩得更远 | 姓名/tag 的 `80vw` |
| 条带拉得更开 | `moveStrips` 的 `110` |
| About 更早/更晚露 | `progress > 0.7` |
| 引言是否必须等到结束 | `progress >= 1` |

---

## 一句话收束

读这文件时抓住四层：

1. **数据**：`progress` / `unlocked` / `animating`  
2. **表现**：`scroll` + `moveStrips`  
3. **驱动**：`animateTo` + `easeInOutCubic`  
4. **入口**：`wheel` 监听 + 初始 `lock()`

四层串起来，就是完整的首页滚轮离场动画。
