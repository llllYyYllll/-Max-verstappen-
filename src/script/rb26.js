// 从 three 包导入整个库，后面用 THREE.xxx 调用
import * as THREE from 'three'
// 轨道控制器：鼠标拖拽旋转、滚轮缩放相机
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
// 右上角调试面板（可拖滑块改参数）
import GUI from 'lil-gui'
// GLTF/GLB 模型加载器
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
// HDR（.hdr）环境贴图加载器，用于背景 + 环境光
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
// 相机切换动画（与 font-light.js 相同 CDN 写法；若失败可改为 npm 包 gsap）
import gsap from 'gsap'

/**
 * ========== 基础：调试面板 / 画布 / 场景 ==========
 */
// 创建调试 GUI（页面右上角 Controls）
const gui = new GUI()

// 拿到 HTML 里的 <canvas class="webgl">，Three 会画在这里
const canvas = document.querySelector('canvas.webgl')

// 创建三维场景容器（所有模型、灯光、背景都加进 scene）
const scene = new THREE.Scene()
// 深色底：棚拍类 HDR 若同时当背景，容易整屏发白看不清车
scene.background = new THREE.Color('#0a1628')

/**
 * ========== 加载赛车模型（GLTF） ==========
 */
// 创建 GLTF 加载器实例
const gltfLoader = new GLTFLoader()

// load(路径, 成功回调, 进度回调, 失败回调)
gltfLoader.load(
    // 模型路径：Vite root 是 src，所以从网站根目录访问 /module/...
    // 想换模型：改这个路径，并保证对应文件夹里有 scene.gltf / scene.bin / textures
    '/module/rb22/scene.gltf',
    // 加载成功：把整棵模型树加入场景
    (gltf) => {
        // 【赛车物体在场景里的位置/缩放/旋转】在这里改
        // gltf.scene.position.set(0, 0, 0)   // 左右, 上下, 前后
        // gltf.scene.scale.set(1, 1, 1)
        // gltf.scene.rotation.y = Math.PI * 0.5
        scene.add(gltf.scene)
    },
    // 进度回调（暂不使用，传 undefined）
    undefined,
    // 加载失败时在控制台打印错误
    (error) => {
        console.error('模型加载失败', error)
    }
)

/**
 * ========== 地面 ==========
 */
// Mesh = 几何体 + 材质
const floor = new THREE.Mesh(
    // 圆形地面：半径 5、分段数 64（越大边缘越圆滑）；想更大就改半径
    new THREE.CircleGeometry(100, 32),
    // 标准 PBR 材质（会受灯光和 HDR 环境影响）
    new THREE.MeshStandardMaterial({
        color: '#444444', // 地面颜色（用十六进制，如 #444444）
        metalness: 0,     // 金属度 0~1，地面一般用 0
        roughness: 0    // 粗糙度 0~1，越大越哑光
    })
)
// 允许接收阴影（需要灯光 castShadow + renderer.shadowMap 开启）
floor.receiveShadow = true
// 平面默认朝 Z，绕 X 轴转 -90° 铺成地面
floor.rotation.x = - Math.PI * 0.5
// 把地面加入场景
// scene.add(floor)

/**
 * ========== 灯光（HDR 为主照明，这里做弱补光 + 阴影） ==========
 * 改亮度：调第二个参数 intensity，或用 GUI 的 Lights 面板
 */
// 环境光：均匀照亮全场，无方向、无阴影；颜色用 0xRRGGBB，不要写 rgb()
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

// 平行光：像太阳，有方向，可投射阴影；颜色 + 强度
const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
// 开启此灯光投射阴影
directionalLight.castShadow = true
// 阴影贴图分辨率，越大越清晰但越耗性能（常用 1024 / 2048）
directionalLight.shadow.mapSize.set(1024, 1024)
// 阴影相机远裁剪面（超过就不算阴影）
directionalLight.shadow.camera.far = 100
// 阴影相机正交范围（left/right/top/bottom），罩住模型即可
directionalLight.shadow.camera.left = - 7
directionalLight.shadow.camera.top = 7
directionalLight.shadow.camera.right = 7
directionalLight.shadow.camera.bottom = - 7
// 灯光位置（从哪里「照射」过来）；改这里改变高光和阴影方向
directionalLight.position.set(5, 5, 5)
scene.add(directionalLight)

/**
 * ========== 画布尺寸 ==========
 */
// 用窗口宽高作为渲染尺寸；若只要 .module 区域大小，可改成容器 clientWidth/Height
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

// 窗口缩放时同步更新相机和渲染器，避免拉伸变形
window.addEventListener('resize', () =>
{
    // 更新记录的宽高
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // 更新相机宽高比并刷新投影矩阵（必须调用）
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // 更新渲染分辨率
    renderer.setSize(sizes.width, sizes.height)
    // 像素比上限 2，避免高分屏过耗性能
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * ========== 相机 ==========
 */
// 透视相机：视野角 fov、宽高比、近裁剪面、远裁剪面
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
// 相机初始位置 (x, y, z)；拉远/拉近可改这三个数
camera.position.set(2, 2, 2)
scene.add(camera)

// 轨道控制器：仅同步 target；滚轮机位期间完全不用它驱动相机
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0.75, 0)
controls.enableDamping = false
controls.enableZoom = false
controls.enableRotate = false
controls.enablePan = false
controls.enabled = false

/**
 * ========== 滚轮机位切换 ==========
 * 在模型区且玻璃已打开时：向下滚 → 下一个机位，向上滚 → 上一个机位
 * 到头/到尾时放行页面滚动
 */
const cameraShots = [
    // position = 相机在哪；target = 看向哪
    // 【起始视角】改第 0 项。x/z 相对 target 略偏一点，避免正对下方
    { position: [2.963854257922303, 0.654522668434298, -0.2009838796561945]
        , target: [-0.60492504380789, 1.088326740830374, 0.08919372855985666]
    }, // 0：起始
    { position: [0.4763306573929188, 1.2948774958776041, 1.9837124460231539]
        , target: [0.39497857203744713, 0.024918454490740878, 1.73051856756255]
    }, // 1：车头
    { position: [1.204370507052178, 1.1147326956490597, -0.24381373093202416]
        , target: [0.04213129644361591, 0.5382837348940214, -0.22312843058890525]
    }, // 2：侧面
    { position: [1.0427683831357561, 0.8416360763493148, -1.2367526719324111]
        , target: [0.3476164573278315, 0.16811831836927002, -2.1008469367050404]
    }, 
    { position: [2.963854257922303, 0.654522668434298, -0.2009838796561945]
        , target: [-0.60492504380789, 1.088326740830374, 0.08919372855985666]
    },
]
let shotIndex = 0
let isShotAnimating = false
let shotTimeline = null

// 复用临时对象，避免每帧 / 每次切换时 new
const _shotTarget = new THREE.Vector3()
const _startQuat = new THREE.Quaternion()
const _endQuat = new THREE.Quaternion()
const _orientCam = new THREE.PerspectiveCamera()
const lookTarget = new THREE.Vector3()

/**
 * 用 position + target 还原朝向。
 * 必须和 OrbitControls 一样：始终用世界 up (0,1,0) 做 lookAt。
 * 之前俯视时换成 (0,0,1) 当 up，会导致「录下来的坐标」和「回放画面」滚转不一致。
 */
function getShotQuaternion(position, target, outQuat) {
    _orientCam.position.fromArray(position)
    _shotTarget.fromArray(target)
    _orientCam.up.set(0, 1, 0)
    _orientCam.lookAt(_shotTarget)
    outQuat.copy(_orientCam.quaternion)
    return outQuat
}

/**
 * 导出当前机位（与回放算法一致）。
 * 用法：鼠标拖到满意角度 → 按键盘 C → 控制台复制打印出的对象到 cameraShots
 */
function logCurrentShot() {
    // 先让 OrbitControls 把内部状态写回 camera / target
    controls.update()
    const position = camera.position.toArray()
    const target = controls.target.toArray()

    // 用同一套 getShotQuaternion 预览回放朝向是否一致
    getShotQuaternion(position, target, camera.quaternion)

    const shot = { position, target }
    console.log('复制下面这一整行到 cameraShots：')
    console.log(JSON.stringify(shot))
    console.log('或展开对象：', shot)
    return shot
}

window.logCurrentShot = logCurrentShot
window.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
        // 输入框里打字时不触发
        if (e.target.closest('input, textarea')) return
        logCurrentShot()
    }
})

// 把相机放到某一机位（无动画）
function applyShot(index) {
    const shot = cameraShots[index]
    camera.position.fromArray(shot.position)
    lookTarget.fromArray(shot.target)
    getShotQuaternion(shot.position, shot.target, camera.quaternion)
    controls.target.copy(lookTarget)
}

applyShot(0)

// 平滑移动：位置线性插值 + 朝向四元数 slerp（比 lookAt 插值更顺）
function goToShot(index) {
    const shot = cameraShots[index]
    if (!shot) return

    isShotAnimating = true
    if (shotTimeline) shotTimeline.kill()
    gsap.killTweensOf([camera.position])

    _startQuat.copy(camera.quaternion)
    getShotQuaternion(shot.position, shot.target, _endQuat)

    const qProxy = { t: 0 }

    shotTimeline = gsap.timeline({
        defaults: { duration: 1.35, ease: 'power3.inOut' },
        onComplete: () => {
            lookTarget.fromArray(shot.target)
            controls.target.copy(lookTarget)
            camera.quaternion.copy(_endQuat)
            isShotAnimating = false
            shotTimeline = null
        }
    })

    shotTimeline.to(camera.position, {
        x: shot.position[0],
        y: shot.position[1],
        z: shot.position[2]
    }, 0)

    shotTimeline.to(qProxy, {
        t: 1,
        onUpdate: () => {
            camera.quaternion.slerpQuaternions(_startQuat, _endQuat, qProxy.t)
        }
    }, 0)

    // 同步 lookTarget，便于调试/后续扩展
    shotTimeline.to(lookTarget, {
        x: shot.target[0],
        y: shot.target[1],
        z: shot.target[2],
        onUpdate: () => controls.target.copy(lookTarget)
    }, 0)
}

const moduleEl = document.querySelector('.module')

// 模型区是否大致在视口内
function isModuleInView() {
    if (!moduleEl) return false
    const rect = moduleEl.getBoundingClientRect()
    const mid = rect.top + rect.height * 0.5
    return mid > 0 && mid < window.innerHeight
}

if (moduleEl) {
    moduleEl.addEventListener('wheel', (e) => {
        // 只在玻璃打开、且模型区在视口时接管滚轮
        if (!moduleEl.classList.contains('is-glass-open')) return
        if (!isModuleInView()) return
        if (isShotAnimating) {
            e.preventDefault()
            return
        }

        const goingDown = e.deltaY > 0
        const goingUp = e.deltaY < 0

        // 已在最后一个机位再往下：放行页面滚动
        if (goingDown && shotIndex >= cameraShots.length - 1) return
        // 已在第一个机位再往上：放行页面滚动
        if (goingUp && shotIndex <= 0) return

        e.preventDefault()

        if (goingDown) shotIndex += 1
        else shotIndex -= 1

        goToShot(shotIndex)
    }, { passive: false })
}

/**
 * ========== 渲染器 ==========
 */
// 创建 WebGL 渲染器，并指定画到哪个 canvas
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
// 开启阴影总开关
renderer.shadowMap.enabled = true
// 软阴影类型（比 BasicShadowMap 更柔和）
renderer.shadowMap.type = THREE.PCFSoftShadowMap
// HDR 色调映射：把高动态范围压到屏幕可显示范围（电影感曲线）
renderer.toneMapping = THREE.ACESFilmicToneMapping
// 曝光：越大越亮；可在 GUI 的 exposure 调节
renderer.toneMappingExposure = 1
// 设置渲染宽高
renderer.setSize(sizes.width, sizes.height)
// 设置设备像素比（高分屏更清晰）
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/**
 * ========== HDR 环境（背景图 + 车身环境反射/照明） ==========
 * 【改背景主要改这里】
 * 1) 换 HDR 文件：把 .hdr 放到 src/module/environment/，改下面路径
 * 2) 调背景强弱：backgroundIntensity
 * 3) 调背景模糊：backgroundBlurriness（0 清晰，1 很糊）
 * 4) 调车身反射强弱：environmentIntensity
 * 5) 纯色背景可改为：scene.background = new THREE.Color('#1a1a2e')
 */
// 背景模糊程度 0~1
scene.backgroundBlurriness = 0.35
// 背景显示亮度（只影响你看到的背景，不太影响车身反射）
scene.backgroundIntensity = 0.6
// 环境贴图对材质的照明/反射强度（影响车漆高光；过大容易整个画面过曝发白）
scene.environmentIntensity = 1

// 创建 HDR 加载器
const rgbeLoader = new RGBELoader()
// 加载 HDR：成功后同时当作「可见背景」和「环境光贴图」
rgbeLoader.load(
    // HDR 文件路径；换背景就改这个文件名/路径
    '/module/environment/studio.hdr',
    // 加载成功回调
    (texture) => {
        // 告诉 Three：这是一张等距柱状（全景）反射贴图
        texture.mapping = THREE.EquirectangularReflectionMapping
        // 只用 HDR 做环境反射；背景保持深色，避免棚拍 HDR 整屏发白看不清车
        // 若要 HDR 当背景，取消下一行注释：
        // scene.background = texture
        scene.environment = texture
    },
    // 进度回调（未用）
    undefined,
    // 失败回调
    (error) => {
        console.error('HDR 加载失败', error)
    }
)

/**
 * ========== 调试 GUI：运行时拖滑块改参数，不用改代码反复刷新 ==========
 */
// Environment 分组
const envFolder = gui.addFolder('Environment')
// 绑定 scene.backgroundIntensity，范围 0~2
envFolder.add(scene, 'backgroundIntensity').min(0).max(2).step(0.01).name('bg intensity')
// 绑定背景模糊
envFolder.add(scene, 'backgroundBlurriness').min(0).max(1).step(0.01).name('bg blur')
// 绑定环境光强度（车身反射）
envFolder.add(scene, 'environmentIntensity').min(0).max(3).step(0.01).name('env intensity')
// 绑定渲染器曝光
envFolder.add(renderer, 'toneMappingExposure').min(0).max(3).step(0.01).name('exposure')

// Lights 分组
const lightsFolder = gui.addFolder('Lights')
// 调节环境光强度
lightsFolder.add(ambientLight, 'intensity').min(0).max(2).step(0.01).name('ambient')
// 调节平行光强度
lightsFolder.add(directionalLight, 'intensity').min(0).max(3).step(0.01).name('directional')

/**
 * ========== 动画循环（每帧渲染一次） ==========
 */
// 时钟：用来算时间差（以后做动画/混合器会用到）
const clock = new THREE.Clock()
// 上一帧的累计时间
let previousTime = 0

// 每帧执行的函数
const tick = () =>
{
    // 从开始到现在经过的秒数
    const elapsedTime = clock.getElapsedTime()
    // 本帧与上一帧的时间差（秒）
    const deltaTime = elapsedTime - previousTime
    // 记录本帧时间，供下一帧算 delta
    previousTime = elapsedTime

    // 录机位时需要 OrbitControls；切机位动画时不要 update，避免和四元数插值打架
    if (controls.enabled && !isShotAnimating) {
        controls.update()
    }
    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
    console.log('position: ', camera.position.toArray());
    console.log('target: ', controls.target.toArray());
}

// 启动第一帧
tick()
