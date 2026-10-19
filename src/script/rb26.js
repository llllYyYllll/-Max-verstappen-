import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import gsap from 'gsap'

/**
 * ========== 基础 ==========
 */
const gui = new GUI({ title: 'Controls' })
gui.hide() // 默认隐藏，按 G 打开

const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()

/**
 * 蓝调展厅环境贴图（只给车漆反射用）
 * 可见背景改由 CSS 平滑渐变承担，避免侧视时 equirect「一整条同色」发死
 */
function createBlueStudioEquirect() {
    const w = 1024
    const h = 512
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')

    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#0a1428')
    sky.addColorStop(0.35, '#163058')
    sky.addColorStop(0.55, '#1e4a82')
    sky.addColorStop(0.75, '#245898')
    sky.addColorStop(1, '#0e1c38')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // 蓝色灯带（偏青蓝，避免纯白高光和背景脱节）
    const panel = (cx, cy, radius, color) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        g.addColorStop(0, color)
        g.addColorStop(1, 'rgba(40, 90, 160, 0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()
    }
    panel(w * 0.5, h * 0.2, h * 0.28, 'rgba(140, 190, 255, 0.55)')
    panel(w * 0.2, h * 0.45, h * 0.22, 'rgba(90, 150, 230, 0.4)')
    panel(w * 0.8, h * 0.42, h * 0.2, 'rgba(100, 160, 240, 0.38)')
    panel(w * 0.5, h * 0.72, h * 0.18, 'rgba(60, 110, 190, 0.25)')

    const tex = new THREE.CanvasTexture(c)
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
}

const studioEquirect = createBlueStudioEquirect()
// 背景透明，露出 CSS 渐变（始终平滑，不随镜头发条带）
scene.background = null
scene.fog = new THREE.FogExp2('#152a44', 0.01)

/**
 * ========== 模型 ==========
 */
const gltfLoader = new GLTFLoader()
gltfLoader.load(
    '/module/rb22/scene.gltf',
    (gltf) => {
        gltf.scene.traverse((child) => {
            if (!child.isMesh) return
            child.castShadow = true
            child.receiveShadow = true
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            mats.forEach((mat) => {
                if (!mat) return
                // 车漆吃蓝调环境反射，细节靠清晰高光拉开
                if ('envMapIntensity' in mat) mat.envMapIntensity = 1.85
                if ('metalness' in mat && mat.metalness > 0.2) {
                    mat.metalness = Math.min(1, mat.metalness + 0.08)
                }
                if ('roughness' in mat) mat.roughness = Math.max(0.12, mat.roughness * 0.78)
                mat.needsUpdate = true
            })
        })
        scene.add(gltf.scene)
    },
    undefined,
    (error) => console.error('模型加载失败', error)
)

/**
 * ========== 地面：深色哑光 + 边缘淡出（消除硬地平线） ==========
 */
function createFloorMaps() {
    const size = 512
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')

    // 颜色：贴近背景蓝黑，避免中心发成实心黑盘
    const colorGrad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5)
    colorGrad.addColorStop(0, '#0c182c')
    colorGrad.addColorStop(0.55, '#0a1628')
    colorGrad.addColorStop(1, '#0a1426')
    ctx.fillStyle = colorGrad
    ctx.fillRect(0, 0, size, size)
    const colorMap = new THREE.CanvasTexture(c)
    colorMap.colorSpace = THREE.SRGBColorSpace

    // Alpha：外圈更长距离淡出，削弱圆形轮廓
    const a = document.createElement('canvas')
    a.width = size
    a.height = size
    const actx = a.getContext('2d')
    const alphaGrad = actx.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size * 0.5)
    alphaGrad.addColorStop(0, '#ffffff')
    alphaGrad.addColorStop(0.4, '#dddddd')
    alphaGrad.addColorStop(0.75, '#666666')
    alphaGrad.addColorStop(1, '#000000')
    actx.fillStyle = alphaGrad
    actx.fillRect(0, 0, size, size)
    const alphaMap = new THREE.CanvasTexture(a)

    return { colorMap, alphaMap }
}

const floorMaps = createFloorMaps()
const floor = new THREE.Mesh(
    new THREE.CircleGeometry(18, 64),
    new THREE.MeshStandardMaterial({
        map: floorMaps.colorMap,
        alphaMap: floorMaps.alphaMap,
        color: '#ffffff',
        metalness: 0.08,
        roughness: 0.92,
        envMapIntensity: 0,
        transparent: true,
        depthWrite: false
    })
)
floor.receiveShadow = true
floor.rotation.x = -Math.PI * 0.5
scene.add(floor)

// 轮胎接触阴影：径向羽化，避免视角变化时露出硬边黑圆
function createContactShadowMap() {
    const size = 256
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(0, 0, 0, 0.55)')
    g.addColorStop(0.35, 'rgba(0, 0, 0, 0.28)')
    g.addColorStop(0.7, 'rgba(0, 0, 0, 0.08)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    const map = new THREE.CanvasTexture(c)
    map.colorSpace = THREE.SRGBColorSpace
    return map
}

const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 64),
    new THREE.MeshBasicMaterial({
        map: createContactShadowMap(),
        transparent: true,
        opacity: 1,
        depthWrite: false,
        toneMapped: false
    })
)
contactShadow.rotation.x = -Math.PI * 0.5
contactShadow.position.y = 0.01
contactShadow.renderOrder = 1
scene.add(contactShadow)

/**
 * ========== 灯光：常驻底光压弱，机位专属光主导造型 ==========
 */
const ambientLight = new THREE.AmbientLight(0x9eb8e0, 0.22)
scene.add(ambientLight)

const hemiLight = new THREE.HemisphereLight(0xc8dcff, 0x0a1424, 0.4)
scene.add(hemiLight)

const directionalLight = new THREE.DirectionalLight(0xc8dcff, 1.0)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 40
directionalLight.shadow.camera.left = -8
directionalLight.shadow.camera.top = 8
directionalLight.shadow.camera.right = 8
directionalLight.shadow.camera.bottom = -8
directionalLight.shadow.bias = -0.0002
directionalLight.shadow.normalBias = 0.02
directionalLight.position.set(5, 7, 4)
scene.add(directionalLight)

const rimLight = new THREE.DirectionalLight(0x7eb4ff, 0.55)
rimLight.position.set(-6, 3.5, -3)
scene.add(rimLight)

const fillLight = new THREE.DirectionalLight(0xa8c8f0, 0.35)
fillLight.position.set(-1, 3.5, 6)
scene.add(fillLight)

// 常驻顶光压弱，避免冲淡机位专属顶光/侧光
const topLight = new THREE.DirectionalLight(0xd0e4ff, 0.35)
topLight.position.set(0, 10, 1)
scene.add(topLight)

const spotLight = new THREE.SpotLight(0xd8e8ff, 0.7, 22, Math.PI * 0.22, 0.45, 1)
spotLight.position.set(2.5, 6, 2)
spotLight.target.position.set(0, 0.55, 0)
spotLight.castShadow = true
spotLight.shadow.mapSize.set(1024, 1024)
scene.add(spotLight)
scene.add(spotLight.target)

const detailLightA = new THREE.PointLight(0xa8ccff, 0.45, 11, 2)
detailLightA.position.set(2.2, 1.5, 1.2)
scene.add(detailLightA)

const detailLightB = new THREE.PointLight(0xb8d8ff, 0.35, 11, 2)
detailLightB.position.set(-1.8, 1.7, -1.5)
scene.add(detailLightB)

// 车底抬光仅保留极弱层次
const underLight = new THREE.PointLight(0x6a9ad0, 0.18, 6, 2)
underLight.position.set(0, 0.35, 0)
scene.add(underLight)

const _keyColor = new THREE.Color()
const _rimColor = new THREE.Color()
const _fillColor = new THREE.Color()
const _spotColor = new THREE.Color()
const _fogColor = new THREE.Color()
const _floorColor = new THREE.Color()

/**
 * ========== 尺寸 / 相机 ==========
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}
let renderer = null

window.addEventListener('resize', () => {
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()
    if (!renderer) return
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
})

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(2, 2, 2)
scene.add(camera)

const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0.75, 0)
controls.enableDamping = false
controls.enableZoom = false
controls.enableRotate = true
controls.enablePan = true
controls.enabled = true

/**
 * ========== 机位（坐标不改）+ 布光 + 文案排版 ==========
 *
 * 每个机位的文字在 info 里改；三段排版在 layout.index / layout.title / layout.body 里改。
 *
 * 每段可用字段：
 *   top / left / right / bottom / textAlign / width / height
 *   fontSize / color / opacity / letterSpacing / lineHeight
 *
 * 便捷定位（玻璃打开后）：
 *   T — 开关编辑框
 *   1 / 2 / 3 — 选中 序号 / 标题 / 正文
 *   拖框移动；拖边角/边缘改宽高；L — 复制三段配置
 *
 * placement 仅作未写坐标时的默认落点：
 *   left-top | left-mid | right-top | right-mid | bottom-left | bottom-right
 */
const INFO_PARTS = ['index', 'title', 'body']

const PLACEMENT_PRESETS = {
    'left-top': { top: 8, left: 4, right: null, bottom: null, textAlign: 'left' },
    'left-mid': { top: 28, left: 3, right: null, bottom: null, textAlign: 'left' },
    'right-top': { top: 8, left: null, right: 4, bottom: null, textAlign: 'right' },
    'right-mid': { top: 28, left: null, right: 3, bottom: null, textAlign: 'right' },
    'bottom-left': { top: null, left: 4, right: null, bottom: 8, textAlign: 'left' },
    'bottom-right': { top: null, left: null, right: 4, bottom: 8, textAlign: 'right' }
}

/** 相对 placement 锚点的垂直错开（百分点） */
const PART_STACK = {
    index: 0,
    title: 3.5,
    body: 12
}

const PART_STYLE_DEFAULTS = {
    index: {
        width: 'min(340px, 32vw)',
        fontSize: 'clamp(13px, 1.2vw, 16px)',
        color: '#FFFFFF',
        opacity: '0.8',
        letterSpacing: '0.14em',
        lineHeight: '1.2'
    },
    title: {
        width: 'min(340px, 32vw)',
        fontSize: 'clamp(28px, 3.2vw, 44px)',
        color: '',
        opacity: '1',
        letterSpacing: '0',
        lineHeight: '1.05'
    },
    body: {
        width: 'min(340px, 32vw)',
        fontSize: 'clamp(12px, 1.05vw, 15px)',
        color: 'rgba(255, 255, 255, 0.9)',
        opacity: '1',
        letterSpacing: '0',
        lineHeight: '1.5'
    }
}

function pctOrAuto(n) {
    return n == null || n === 'auto' ? 'auto' : `${n}%`
}

function buildPartsFromPlacement(placement, width = 'min(340px, 32vw)') {
    const p = PLACEMENT_PRESETS[placement] || PLACEMENT_PRESETS['left-top']
    const parts = {}
    for (const key of INFO_PARTS) {
        const dy = PART_STACK[key]
        let top = p.top
        let bottom = p.bottom
        if (p.top != null) top = p.top + dy
        else if (p.bottom != null) bottom = Math.max(2, p.bottom + (12 - dy))
        parts[key] = {
            ...PART_STYLE_DEFAULTS[key],
            width,
            top: pctOrAuto(top),
            left: pctOrAuto(p.left),
            right: pctOrAuto(p.right),
            bottom: pctOrAuto(bottom),
            textAlign: p.textAlign
        }
    }
    return parts
}

const cameraShots = [
    {
        position: [2.963854257922303, 0.654522668434298, -0.2009838796561945],
        target: [-0.60492504380789, 1.088326740830374, 0.08919372855985666],
        placement: 'left-top',
        info: {
            // index: '01 / Side Profile',
            title: 'Long Chassis',
            body: 'Overall length ≈5.5 m; wheelbase ≈3.4 m. Side elevation: low nose cone, undercut sidepods with sharp inlet lips, tight cockpit survivability cell, tapering engine cover, high-mounted rear wing. Longitudinal mass distribution and a continuous aero profile cut yaw drag and sharpen front-axle response on turn-in.'
        },
        layout: {
            title: {
                top: '11.5%',
                left: '4.0%',
                right: 'auto',
                bottom: 'auto',
                textAlign: 'left',
                width: '28.5%',
                height: '5.8%',
                fontSize: 'clamp(45px, 3.2vw, 60px)',
            },
            body: {
                top: '20.0%',
                left: '4.0%',
                right: 'auto',
                bottom: 'auto',
                textAlign: 'left',
                width: '89.9%',
                height: '33.4%',
                fontSize: 'clamp(25px, 1.05vw, 20px)',
            },
        },
        // 顶光：压亮车顶 / 侧箱上沿，拉长侧视轮廓阴影
        light: {
            key: { pos: [0.15, 10.5, 0.35], intensity: 4.2, color: '#f2f6ff' },
            rim: { pos: [-3.2, 1.8, 2.8], intensity: 0.4, color: '#6a9ad8' },
            fill: { pos: [2.8, 1.6, -2.2], intensity: 0.28, color: '#b8d0f0' },
            spot: { pos: [0.2, 8.5, 0.1], target: [0, 0.55, 0], intensity: 3.6, color: '#eef4ff', angle: 0.4 },
            ambient: 0.16,
            hemi: 0.42,
            exposure: 1.36,
            env: 1.55,
            bg: 1.02,
            fogDensity: 0.011,
            fogColor: '#1c2e46',
            floor: '#ffffff'
        }
    },
    {
        position: [0.060368112637948425, 2.6180553737073056, -0.18668267233240626],
        target: [0.021863858680226854, -0.9884792444800835, -0.1871211221640452],
        placement: 'right-top',
        info: {
            // index: '02 / Top View',
            title: 'Narrow Track',
            body: 'Overall width ≈1.9 m. Plan view: reduced track, narrower tyre package, and a tightly packaged bodywork envelope. Lower frontal area cuts CdA; cleaner wake feeds the 2026 active-aero surfaces with less turbulence and more predictable downforce.'
        },
        layout: {
            title: {
                top: '4.5%',
                left: '3.2%',
                right: 'auto',
                bottom: 'auto',
                textAlign: 'left',
                width: '19.4%',
                height: '11.7%',
                fontSize: 'clamp(45px, 3.2vw, 60px)',
            },
            body: {
                top: '83.4%',
                left: '3.2%',
                right: 'auto',
                bottom: 'auto',
                textAlign: 'left',
                width: '93.4%',
                height: '16.6%',
                fontSize: 'clamp(25px, 1.05vw, 20px)',
            },
        },
        // 侧光：俯视下横切车身，强调窄轮距与侧箱边缘
        light: {
            key: { pos: [7.5, 2.8, 1.2], intensity: 4.0, color: '#f0f4ff' },
            rim: { pos: [-6.5, 2.2, -1.5], intensity: 2.1, color: '#7eb4ff' },
            fill: { pos: [-1.5, 2.4, 5.5], intensity: 0.4, color: '#c0d8f5' },
            spot: { pos: [5.5, 3.2, 0.4], target: [0, 0.2, -0.15], intensity: 3.2, color: '#e8f0ff', angle: 0.36 },
            ambient: 0.14,
            hemi: 0.32,
            exposure: 1.32,
            env: 1.7,
            bg: 0.98,
            fogDensity: 0.012,
            fogColor: '#182840',
            floor: '#ffffff'
        }
    },
    {
        position: [0.4763306573929188, 1.2948774958776041, 1.9837124460231539],
        target: [0.39497857203744713, 0.024918454490740878, 1.73051856756255],
        placement: 'left-top',
        info: {
            // index: '03 / Nose Identity',
            title: 'Sponsors & No.3',
            body: "Nose cone branding stack: Oracle title partner forward, Red Bull primary mark along the tip. Race number 3 — Verstappen's permanent FIA identifier — sits high-contrast on both flanks for timing loops, onboard cameras, and marshalling ID at full speed."
        },
        layout: {
            title: {
                top: '66.3%',
                left: '78.9%',
                right: 'auto',
                bottom: 'auto',
                textAlign: 'right',
                width: '20.5%',
                height: '11.7%',
                fontSize: 'clamp(45px, 3.2vw, 60px)',
            },
            body: {
                top: '80.5%',
                left: '59.3%',
                right: 'auto',
                bottom: 'auto',
                textAlign: 'right',
                width: '40.6%',
                height: '19.5%',
                fontSize: 'clamp(25px, 1.05vw, 20px)',
            },
        },
        // 侧光：鼻锥侧面打亮，突出 No.3 与赞助商标识立体感
        light: {
            key: { pos: [5.2, 2.4, 2.8], intensity: 4.15, color: '#f8faff' },
            rim: { pos: [-4.8, 2.2, 0.6], intensity: 1.85, color: '#8ab8ff' },
            fill: { pos: [-0.8, 1.8, 4.5], intensity: 0.32, color: '#c8dcff' },
            spot: { pos: [3.8, 2.6, 2.6], target: [0.35, 0.45, 1.35], intensity: 3.5, color: '#ffffff', angle: 0.22 },
            ambient: 0.12,
            hemi: 0.28,
            exposure: 1.4,
            env: 1.9,
            bg: 0.96,
            fogDensity: 0.014,
            fogColor: '#152236',
            floor: '#ffffff'
        }
    },
    {
        position: [1.204370507052178, 1.1147326956490597, -0.24381373093202416],
        target: [0.04213129644361591, 0.5382837348940214, -0.22312843058890525],
        placement: 'right-top',
        info: {
            // index: '04 / Livery',
            title: 'Midnight Blue',
            body: 'Sidepod livery: midnight navy basecoat with racing-red and cyber-yellow accent bands. Graphics track the undercut crease lines and cooling inlet edges so brand marks stay readable under changing specular highlights at race speed. Red Bull DNA mapped to bodywork topology.'
        },
        layout: {
            title: {
                top: '4.6%',
                left: '2.3%',
                right: 'auto',
                bottom: 'auto',
                textAlign: 'left',
                width: '19.4%',
                height: '11.7%',
                fontSize: 'clamp(45px, 3.2vw, 60px)',
            },
            body: {
                top: '4.3%',
                left: '18.6%',
                right: 'auto',
                bottom: 'auto',
                textAlign: 'left',
                width: '62.6%',
                height: '37.2%',
                fontSize: 'clamp(25px, 1.05vw, 20px)',
            },
        },
        // 顶光：自上而下扫过涂装折线，深蓝底色上的红黄条带更清晰
        light: {
            key: { pos: [0.4, 9.5, -0.15], intensity: 4.1, color: '#f0f4ff' },
            rim: { pos: [-3.5, 1.6, 2.2], intensity: 0.7, color: '#ff6b85' },
            fill: { pos: [2.2, 1.4, 2.8], intensity: 0.3, color: '#b8d0f0' },
            spot: { pos: [0.3, 7.2, -0.1], target: [0.1, 0.55, -0.15], intensity: 3.55, color: '#e8f0ff', angle: 0.28 },
            ambient: 0.15,
            hemi: 0.4,
            exposure: 1.35,
            env: 1.75,
            bg: 0.97,
            fogDensity: 0.013,
            fogColor: '#18243c',
            floor: '#ffffff'
        }
    },
    {
        position: [1.0427683831357561, 0.8416360763493148, -1.2367526719324111],
        target: [0.3476164573278315, 0.16811831836927002, -2.1008469367050404],
        placement: 'left-top',
        info: {
            // index: '05 / Power Unit',
            title: 'PU & Rear Wing',
            body: 'Red Bull-Ford 1.6 L turbo-hybrid V6: near 50/50 ICE-to-electric split, uprated MGU-K, sustainable fuel. Aft of the power unit, the high-mounted rear wing and beam wing manage rear downforce and wake; active-aero modes trade drag on the straights for grip in high-load corners.'
        },
        layout: {
            title: {
                top: '6.7%',
                left: '78.3%',
                right: 'auto',
                bottom: 'auto',
                textAlign: 'right',
                width: '19.4%',
                height: '11.7%',
                fontSize: 'clamp(45px, 3.2vw, 60px)',
            },
            body: {
                top: '22.0%',
                left: '68.3%',
                right: 'auto',
                bottom: 'auto',
                textAlign: 'right',
                width: '29.5%',
                height: '72.4%',
                fontSize: 'clamp(25px, 1.05vw, 20px)',
            },
        },
        // 全光：多向均匀照亮引擎盖与尾翼细节
        light: {
            key: { pos: [4.5, 6.5, -3.2], intensity: 3.3, color: '#e8f0ff' },
            rim: { pos: [-5.5, 3.8, 2.5], intensity: 2.4, color: '#70c8ff' },
            fill: { pos: [2.2, 4.2, 4.5], intensity: 2.0, color: '#c8dcff' },
            spot: { pos: [1.5, 5.5, -2.4], target: [0.3, 0.5, -1.7], intensity: 2.85, color: '#eef4ff', angle: 0.38 },
            ambient: 0.38,
            hemi: 0.7,
            exposure: 1.38,
            env: 2.15,
            bg: 1.02,
            fogDensity: 0.01,
            fogColor: '#1a2840',
            floor: '#ffffff'
        }
    },
    {
        position: [2.963854257922303, 0.654522668434298, -0.2009838796561945],
        target: [-0.60492504380789, 1.088326740830374, 0.08919372855985666],
        placement: 'right-top',
        info: {
            // index: 'RB26',
            title: 'Keep Going',
            body: 'Scroll down to leave, or click to close the glass. Five angles. One machine.'
        },
        layout: {
            // index: { top: '8%', left: 'auto', right: '4%', bottom: 'auto', textAlign: 'right', width: 'min(340px, 32vw)', fontSize: 'clamp(13px, 1.2vw, 16px)' },
            title: { top: '11.5%', left: 'auto', right: '4%', bottom: 'auto', textAlign: 'right', width: 'min(340px, 32vw)', fontSize: 'clamp(45px, 3.2vw, 60px)' },
            body: { top: '20%', left: 'auto', right: '4%', bottom: 'auto', textAlign: 'right', width: 'min(340px, 32vw)', fontSize: 'clamp(25px, 1.05vw, 20px)' }
        },
        // 收尾机位保持全光影棚感
        light: {
            key: { pos: [5, 7, 4], intensity: 3.2, color: '#d0e4ff' },
            rim: { pos: [-6, 3.5, -3], intensity: 2.25, color: '#7eb4ff' },
            fill: { pos: [-1, 3.5, 6], intensity: 1.85, color: '#a8c8f0' },
            spot: { pos: [2.5, 6, 2], target: [0, 0.55, 0], intensity: 2.6, color: '#d8e8ff', angle: 0.36 },
            ambient: 0.4,
            hemi: 0.72,
            exposure: 1.3,
            env: 2.1,
            bg: 1,
            fogDensity: 0.01,
            fogColor: '#1a2a44',
            floor: '#ffffff'
        }
    }
]

let shotIndex = 0
let isShotAnimating = false
let shotTimeline = null

const moduleEl = document.querySelector('.module')
const infoEl = document.querySelector('.module-info')
const infoIndexEl = document.querySelector('.module-info__index')
const infoTitleEl = document.querySelector('.module-info__title')
const infoBodyEl = document.querySelector('.module-info__body')

const infoPartEls = {
    index: infoIndexEl,
    title: infoTitleEl,
    body: infoBodyEl
}

function resolveShotLayout(shot) {
    const base = buildPartsFromPlacement(shot.placement || 'left-top')
    const raw = shot.layout || {}
    const resolved = {}

    for (const key of INFO_PARTS) {
        const partRaw = raw[key] && typeof raw[key] === 'object' ? raw[key] : {}
        resolved[key] = { ...base[key], ...partRaw }
    }

    // 兼容旧版扁平 layout（仅有 top/left/indexSize 时）
    if (!raw.index && (raw.top || raw.left || raw.right)) {
        const stacked = buildPartsFromPlacement(shot.placement || 'left-top', raw.width || 'min(340px, 32vw)')
        for (const key of INFO_PARTS) {
            resolved[key] = {
                ...stacked[key],
                top: key === 'index' ? (raw.top ?? stacked.index.top) : stacked[key].top,
                left: raw.left ?? stacked[key].left,
                right: raw.right ?? stacked[key].right,
                bottom: key === 'index' ? (raw.bottom ?? stacked.index.bottom) : stacked[key].bottom,
                textAlign: raw.textAlign ?? stacked[key].textAlign,
                width: raw.width ?? stacked[key].width,
                fontSize: raw[`${key}Size`] ?? stacked[key].fontSize
            }
        }
    }

    return resolved
}

function applyPartVars(partKey, part) {
    if (!infoEl || !part) return
    const p = `--${partKey}`
    const height = part.height && part.height !== 'auto' ? part.height : 'auto'
    infoEl.style.setProperty(`${p}-top`, part.top ?? 'auto')
    infoEl.style.setProperty(`${p}-left`, part.left ?? 'auto')
    infoEl.style.setProperty(`${p}-right`, part.right ?? 'auto')
    infoEl.style.setProperty(`${p}-bottom`, part.bottom ?? 'auto')
    infoEl.style.setProperty(`${p}-align`, part.textAlign ?? 'left')
    infoEl.style.setProperty(`${p}-width`, part.width ?? PART_STYLE_DEFAULTS[partKey].width)
    infoEl.style.setProperty(`${p}-height`, height)
    infoEl.style.setProperty(`${p}-overflow`, height === 'auto' ? 'visible' : 'hidden')
    infoEl.style.setProperty(`${p}-size`, part.fontSize ?? PART_STYLE_DEFAULTS[partKey].fontSize)
    infoEl.style.setProperty(`${p}-color`, part.color || PART_STYLE_DEFAULTS[partKey].color || 'transparent')
    infoEl.style.setProperty(`${p}-opacity`, String(part.opacity ?? PART_STYLE_DEFAULTS[partKey].opacity))
    infoEl.style.setProperty(`${p}-tracking`, part.letterSpacing ?? PART_STYLE_DEFAULTS[partKey].letterSpacing)
    infoEl.style.setProperty(`${p}-leading`, part.lineHeight ?? PART_STYLE_DEFAULTS[partKey].lineHeight)
}

function applyShotLayout(shot) {
    if (!infoEl) return
    const parts = resolveShotLayout(shot)
    for (const key of INFO_PARTS) applyPartVars(key, parts[key])
}

function setShotInfo(index, { animate = true } = {}) {
    const shot = cameraShots[index]
    if (!shot?.info || !infoEl) return

    const apply = () => {
        infoIndexEl.textContent = shot.info.index ?? ''
        infoTitleEl.textContent = shot.info.title ?? ''
        infoBodyEl.textContent = shot.info.body ?? ''
        applyShotLayout(shot)
        if (isTextPlacing) {
            infoEl.classList.add('is-visible')
            syncSelectionFrame()
        }
    }

    if (!animate) {
        apply()
        return
    }

    infoEl.classList.remove('is-visible')
    window.setTimeout(() => {
        apply()
        if (moduleEl?.classList.contains('is-glass-open')) {
            infoEl.classList.add('is-visible')
        }
    }, 200)
}

const _shotTarget = new THREE.Vector3()
const _startQuat = new THREE.Quaternion()
const _endQuat = new THREE.Quaternion()
const _orientCam = new THREE.PerspectiveCamera()
const lookTarget = new THREE.Vector3()

function getShotQuaternion(position, target, outQuat) {
    _orientCam.position.fromArray(position)
    _shotTarget.fromArray(target)
    _orientCam.up.set(0, 1, 0)
    _orientCam.lookAt(_shotTarget)
    outQuat.copy(_orientCam.quaternion)
    return outQuat
}

function logCurrentShot() {
    controls.update()
    const position = camera.position.toArray()
    const target = controls.target.toArray()
    getShotQuaternion(position, target, camera.quaternion)
    const shot = { position, target }
    console.log('复制下面这一整行到 cameraShots：')
    console.log(JSON.stringify(shot))
    return shot
}

/**
 * 分段文字编辑框：
 *   T — 开关；1/2/3 选段；拖框移动；拖边角改宽高；L 复制
 */
let isTextPlacing = false
let textDrag = null
let activeTextPart = 'index'
let selectionFrame = null

const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

function pct(n, min = 0, max = 100) {
    return `${Math.max(min, Math.min(max, n)).toFixed(1)}%`
}

function pctNum(n, min = 0, max = 100) {
    return Math.max(min, Math.min(max, n))
}

function readPartBox(el) {
    if (!el || !moduleEl) return null
    const box = moduleEl.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) return null

    const leftN = pctNum(((rect.left - box.left) / box.width) * 100)
    const topN = pctNum(((rect.top - box.top) / box.height) * 100)
    const widthN = pctNum((rect.width / box.width) * 100, 4, 96)
    const heightN = pctNum((rect.height / box.height) * 100, 2, 96)
    const midX = leftN + widthN * 0.5
    const textAlign = midX > 50 ? 'right' : 'left'

    return {
        top: pct(topN),
        left: pct(leftN),
        right: 'auto',
        bottom: 'auto',
        width: pct(widthN, 4, 96),
        height: pct(heightN, 2, 96),
        textAlign
    }
}

function applyLivePartBox(partKey, boxVals) {
    const shot = cameraShots[shotIndex]
    if (!shot || !boxVals) return
    if (!shot.layout || typeof shot.layout !== 'object') shot.layout = {}
    const prev = shot.layout[partKey] && typeof shot.layout[partKey] === 'object'
        ? shot.layout[partKey]
        : {}
    shot.layout[partKey] = { ...prev, ...boxVals }
    applyPartVars(partKey, { ...resolveShotLayout(shot)[partKey], ...shot.layout[partKey] })
    syncSelectionFrame()
}

function readBoxFromFrameOrEl(partKey) {
    const el = infoPartEls[partKey]
    if (!moduleEl) return null

    // 当前选中段优先读选中框（与拖拽所见一致）
    if (
        partKey === activeTextPart &&
        selectionFrame &&
        !selectionFrame.hidden &&
        isTextPlacing
    ) {
        const box = moduleEl.getBoundingClientRect()
        const leftN = pctNum((parseFloat(selectionFrame.style.left) / box.width) * 100)
        const topN = pctNum((parseFloat(selectionFrame.style.top) / box.height) * 100)
        const widthN = pctNum((parseFloat(selectionFrame.style.width) / box.width) * 100, 4, 96)
        const heightN = pctNum((parseFloat(selectionFrame.style.height) / box.height) * 100, 2, 96)
        return {
            top: pct(topN),
            left: pct(leftN),
            right: 'auto',
            bottom: 'auto',
            width: pct(widthN, 4, 96),
            height: pct(heightN, 2, 96),
            textAlign: leftN + widthN * 0.5 > 50 ? 'right' : 'left'
        }
    }

    return readPartBox(el)
}

function collectShotLayout() {
    const shot = cameraShots[shotIndex]
    if (!shot) return null
    if (!shot.layout || typeof shot.layout !== 'object') shot.layout = {}

    const layout = {}
    for (const key of INFO_PARTS) {
        const hasText = Boolean(shot.info?.[key])
        if (!hasText) continue

        const prev = shot.layout[key] && typeof shot.layout[key] === 'object'
            ? shot.layout[key]
            : {}
        const measured = readBoxFromFrameOrEl(key)
        if (!measured && !prev.top && !prev.left && !prev.right) continue

        layout[key] = {
            ...prev,
            ...(measured || {}),
            // 字号等样式以内存/源配置为准，避免被测量值冲掉
            fontSize: prev.fontSize || PART_STYLE_DEFAULTS[key].fontSize,
            color: prev.color,
            opacity: prev.opacity,
            letterSpacing: prev.letterSpacing,
            lineHeight: prev.lineHeight
        }

        // 清掉 undefined，避免写进 snippet
        Object.keys(layout[key]).forEach((k) => {
            if (layout[key][k] == null || layout[key][k] === '') delete layout[key][k]
        })
    }

    shot.layout = layout
    return layout
}

function formatPartSnippet(key, part) {
    if (!part || typeof part !== 'object') return ''
    const lines = [`    ${key}: {`]
    for (const field of ['top', 'left', 'right', 'bottom', 'textAlign', 'width', 'height', 'fontSize']) {
        if (part[field] == null || part[field] === '') continue
        lines.push(`        ${field}: '${String(part[field])}',`)
    }
    lines.push('    },')
    return lines.join('\n')
}

function copyTextReliable(text) {
    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
    }
    try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        ta.remove()
        return Promise.resolve(ok)
    } catch {
        return Promise.resolve(false)
    }
}

function flashCopyNotice(ok, shotNo) {
    let tip = document.querySelector('.module-copy-tip')
    if (!tip && moduleEl) {
        tip = document.createElement('div')
        tip.className = 'module-copy-tip'
        moduleEl.appendChild(tip)
    }
    if (!tip) return
    tip.textContent = ok
        ? `机位 ${shotNo} layout 已复制`
        : `机位 ${shotNo} 复制失败，请看控制台手动复制`
    tip.classList.add('is-show')
    window.clearTimeout(flashCopyNotice._t)
    flashCopyNotice._t = window.setTimeout(() => tip.classList.remove('is-show'), 1800)
}

function logInfoLayout() {
    const shot = cameraShots[shotIndex]
    if (!shot || !moduleEl) {
        console.warn('无法读取文字坐标：先打开玻璃，并确保文案可见')
        return null
    }

    // 结束未完成的拖拽，再以选中框/元素尺寸汇总
    textDrag = null
    const layout = collectShotLayout()
    if (!layout || !Object.keys(layout).length) {
        console.warn('当前机位没有可导出的文字段（检查 info 是否有内容）')
        return null
    }

    applyShotLayout(shot)
    syncSelectionFrame()

    const parts = INFO_PARTS
        .map((key) => formatPartSnippet(key, layout[key]))
        .filter(Boolean)

    const clean = ['layout: {', ...parts, '},'].join('\n')

    console.log(`机位 ${shotIndex + 1} 文字 layout — 请粘贴替换该机位的 layout：`)
    console.log(clean)

    copyTextReliable(clean).then((ok) => {
        if (ok) console.log('已复制到剪贴板')
        else console.warn('剪贴板写入失败，请从上面手动复制')
        flashCopyNotice(ok, shotIndex + 1)
    })

    return layout
}

function syncSelectionFrame() {
    if (!selectionFrame || !isTextPlacing || !moduleEl) return
    const el = infoPartEls[activeTextPart]
    if (!el) {
        selectionFrame.hidden = true
        return
    }
    const box = moduleEl.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    selectionFrame.hidden = false
    selectionFrame.style.left = `${rect.left - box.left}px`
    selectionFrame.style.top = `${rect.top - box.top}px`
    selectionFrame.style.width = `${rect.width}px`
    selectionFrame.style.height = `${Math.max(rect.height, 24)}px`
}

function ensureSelectionFrame() {
    if (selectionFrame || !infoEl) return selectionFrame
    selectionFrame = document.createElement('div')
    selectionFrame.className = 'module-info__frame'
    selectionFrame.hidden = true

    for (const h of RESIZE_HANDLES) {
        const handle = document.createElement('span')
        handle.className = `module-info__handle module-info__handle--${h}`
        handle.dataset.handle = h
        selectionFrame.appendChild(handle)
    }
    infoEl.appendChild(selectionFrame)

    selectionFrame.addEventListener('pointerdown', (e) => {
        if (!isTextPlacing) return
        e.preventDefault()
        e.stopPropagation()

        const handle = e.target.closest('.module-info__handle')?.dataset.handle || null
        const el = infoPartEls[activeTextPart]
        if (!el) return

        const box = moduleEl.getBoundingClientRect()
        const rect = el.getBoundingClientRect()
        textDrag = {
            mode: handle ? 'resize' : 'move',
            handle,
            part: activeTextPart,
            box,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect.left - box.left,
            startTop: rect.top - box.top,
            startWidth: rect.width,
            startHeight: Math.max(rect.height, 24),
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top
        }
        selectionFrame.setPointerCapture?.(e.pointerId)
    })

    selectionFrame.addEventListener('pointermove', (e) => {
        if (!isTextPlacing || !textDrag || textDrag.part !== activeTextPart) return
        const { box, mode, handle } = textDrag
        let left = textDrag.startLeft
        let top = textDrag.startTop
        let width = textDrag.startWidth
        let height = textDrag.startHeight

        if (mode === 'move') {
            left = e.clientX - box.left - textDrag.offsetX
            top = e.clientY - box.top - textDrag.offsetY
        } else {
            const dx = e.clientX - textDrag.startX
            const dy = e.clientY - textDrag.startY
            if (handle.includes('e')) width = textDrag.startWidth + dx
            if (handle.includes('s')) height = textDrag.startHeight + dy
            if (handle.includes('w')) {
                width = textDrag.startWidth - dx
                left = textDrag.startLeft + dx
            }
            if (handle.includes('n')) {
                height = textDrag.startHeight - dy
                top = textDrag.startTop + dy
            }
        }

        const minW = box.width * 0.04
        const minH = box.height * 0.02
        if (width < minW) {
            if (handle?.includes('w')) left = textDrag.startLeft + textDrag.startWidth - minW
            width = minW
        }
        if (height < minH) {
            if (handle?.includes('n')) top = textDrag.startTop + textDrag.startHeight - minH
            height = minH
        }

        left = pctNum((left / box.width) * 100, 0, 96)
        top = pctNum((top / box.height) * 100, 0, 96)
        width = pctNum((width / box.width) * 100, 4, 96)
        height = pctNum((height / box.height) * 100, 2, 96)
        if (left + width > 100) width = 100 - left
        if (top + height > 100) height = 100 - top

        applyLivePartBox(activeTextPart, {
            top: pct(top),
            left: pct(left),
            right: 'auto',
            bottom: 'auto',
            width: pct(width, 4, 96),
            height: pct(height, 2, 96),
            textAlign: left + width * 0.5 > 50 ? 'right' : 'left'
        })
    })

    const endDrag = () => {
        if (!textDrag) return
        const part = textDrag.part
        textDrag = null
        // 松手时再提交一次选中框尺寸，避免 L 读到旧值
        const box = readBoxFromFrameOrEl(part)
        if (box) applyLivePartBox(part, box)
    }
    selectionFrame.addEventListener('pointerup', endDrag)
    selectionFrame.addEventListener('pointercancel', endDrag)

    return selectionFrame
}

function setActiveTextPart(partKey) {
    if (!INFO_PARTS.includes(partKey)) return
    activeTextPart = partKey
    for (const key of INFO_PARTS) {
        infoPartEls[key]?.classList.toggle('is-active-part', key === partKey)
    }
    ensureSelectionFrame()
    // 选中时先把当前渲染尺寸写入 height，便于立刻拖边角
    const el = infoPartEls[partKey]
    const box = readPartBox(el)
    if (box) {
        const shot = cameraShots[shotIndex]
        if (shot) {
            if (!shot.layout || typeof shot.layout !== 'object') shot.layout = {}
            const prev = shot.layout[partKey] && typeof shot.layout[partKey] === 'object'
                ? shot.layout[partKey]
                : {}
            // 未设 height 时用当前高度，避免第一次拉边角跳动
            if (!prev.height || prev.height === 'auto') {
                shot.layout[partKey] = { ...prev, width: prev.width || box.width, height: box.height }
                applyPartVars(partKey, { ...resolveShotLayout(shot)[partKey], ...shot.layout[partKey] })
            }
        }
    }
    syncSelectionFrame()
    console.log(`已选中：${partKey}（拖框移动，拖边角改宽高；1/2/3 切换）`)
}

function setTextPlacing(on) {
    if (!infoEl) return
    isTextPlacing = on
    infoEl.classList.toggle('is-placing', on)
    ensureSelectionFrame()

    if (on) {
        infoEl.classList.add('is-visible')
        setActiveTextPart(activeTextPart)
        console.log('文字编辑：1/2/3 选段 → 拖框/边角 → L 复制 → T 退出')
    } else {
        textDrag = null
        if (selectionFrame) selectionFrame.hidden = true
        for (const key of INFO_PARTS) {
            infoPartEls[key]?.classList.remove('is-active-part')
        }
        console.log('文字编辑已关闭')
    }
}

if (infoEl && moduleEl) {
    for (const key of INFO_PARTS) {
        const el = infoPartEls[key]
        if (!el) continue
        el.addEventListener('pointerdown', (e) => {
            if (!isTextPlacing) return
            e.preventDefault()
            e.stopPropagation()
            setActiveTextPart(key)
        })
    }

    window.addEventListener('resize', () => {
        if (isTextPlacing) syncSelectionFrame()
    })
}

window.logCurrentShot = logCurrentShot
window.logInfoLayout = logInfoLayout
window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return
    if (e.key === 'c' || e.key === 'C') logCurrentShot()
    if (e.key === 't' || e.key === 'T') {
        if (!moduleEl?.classList.contains('is-glass-open')) {
            console.warn('请先点击打开玻璃，再按 T 编辑文字框')
            return
        }
        setTextPlacing(!isTextPlacing)
    }
    if (isTextPlacing && (e.key === '1' || e.key === '2' || e.key === '3')) {
        setActiveTextPart(INFO_PARTS[Number(e.key) - 1])
    }
    if (e.key === 'l' || e.key === 'L') logInfoLayout()
    if (e.key === 'g' || e.key === 'G') {
        gui._hidden ? gui.show() : gui.hide()
    }
})

function applyShotLighting(index, timeline = null) {
    const L = cameraShots[index]?.light
    if (!L) return

    const duration = 1.35
    const ease = 'power3.inOut'
    const fogProxy = { density: scene.fog.density }

    if (timeline) {
        timeline.to(directionalLight.position, { x: L.key.pos[0], y: L.key.pos[1], z: L.key.pos[2], duration, ease }, 0)
        timeline.to(directionalLight, { intensity: L.key.intensity, duration, ease }, 0)
        _keyColor.set(L.key.color)
        timeline.to(directionalLight.color, { r: _keyColor.r, g: _keyColor.g, b: _keyColor.b, duration, ease }, 0)

        timeline.to(rimLight.position, { x: L.rim.pos[0], y: L.rim.pos[1], z: L.rim.pos[2], duration, ease }, 0)
        timeline.to(rimLight, { intensity: L.rim.intensity, duration, ease }, 0)
        _rimColor.set(L.rim.color)
        timeline.to(rimLight.color, { r: _rimColor.r, g: _rimColor.g, b: _rimColor.b, duration, ease }, 0)

        timeline.to(fillLight.position, { x: L.fill.pos[0], y: L.fill.pos[1], z: L.fill.pos[2], duration, ease }, 0)
        timeline.to(fillLight, { intensity: L.fill.intensity, duration, ease }, 0)
        _fillColor.set(L.fill.color)
        timeline.to(fillLight.color, { r: _fillColor.r, g: _fillColor.g, b: _fillColor.b, duration, ease }, 0)

        timeline.to(spotLight.position, { x: L.spot.pos[0], y: L.spot.pos[1], z: L.spot.pos[2], duration, ease }, 0)
        timeline.to(spotLight.target.position, {
            x: L.spot.target[0], y: L.spot.target[1], z: L.spot.target[2], duration, ease
        }, 0)
        timeline.to(spotLight, { intensity: L.spot.intensity, angle: L.spot.angle, duration, ease }, 0)
        _spotColor.set(L.spot.color)
        timeline.to(spotLight.color, { r: _spotColor.r, g: _spotColor.g, b: _spotColor.b, duration, ease }, 0)

        timeline.to(ambientLight, { intensity: L.ambient, duration, ease }, 0)
        timeline.to(hemiLight, { intensity: L.hemi, duration, ease }, 0)

        if (renderer) {
            timeline.to(renderer, { toneMappingExposure: L.exposure, duration, ease }, 0)
        }
        timeline.to(scene, {
            environmentIntensity: L.env,
            duration,
            ease
        }, 0)

        timeline.to(fogProxy, {
            density: L.fogDensity,
            duration,
            ease,
            onUpdate: () => { scene.fog.density = fogProxy.density }
        }, 0)
        _fogColor.set(L.fogColor)
        timeline.to(scene.fog.color, { r: _fogColor.r, g: _fogColor.g, b: _fogColor.b, duration, ease }, 0)

        _floorColor.set(L.floor)
        timeline.to(floor.material.color, {
            r: _floorColor.r, g: _floorColor.g, b: _floorColor.b, duration, ease
        }, 0)
        return
    }

    directionalLight.position.fromArray(L.key.pos)
    directionalLight.intensity = L.key.intensity
    directionalLight.color.set(L.key.color)

    rimLight.position.fromArray(L.rim.pos)
    rimLight.intensity = L.rim.intensity
    rimLight.color.set(L.rim.color)

    fillLight.position.fromArray(L.fill.pos)
    fillLight.intensity = L.fill.intensity
    fillLight.color.set(L.fill.color)

    spotLight.position.fromArray(L.spot.pos)
    spotLight.target.position.fromArray(L.spot.target)
    spotLight.intensity = L.spot.intensity
    spotLight.angle = L.spot.angle
    spotLight.color.set(L.spot.color)

    ambientLight.intensity = L.ambient
    hemiLight.intensity = L.hemi

    if (renderer) renderer.toneMappingExposure = L.exposure
    scene.environmentIntensity = L.env
    scene.fog.density = L.fogDensity
    scene.fog.color.set(L.fogColor)
    floor.material.color.set(L.floor)
    floor.material.envMapIntensity = 0
}

function applyShot(index) {
    const shot = cameraShots[index]
    camera.position.fromArray(shot.position)
    lookTarget.fromArray(shot.target)
    getShotQuaternion(shot.position, shot.target, camera.quaternion)
    controls.target.copy(lookTarget)
    setShotInfo(index, { animate: false })
    applyShotLighting(index, null)
}

applyShot(0)

function goToShot(index) {
    const shot = cameraShots[index]
    if (!shot) return

    isShotAnimating = true
    if (shotTimeline) shotTimeline.kill()
    gsap.killTweensOf([
        camera.position,
        directionalLight.position,
        rimLight.position,
        fillLight.position,
        spotLight.position
    ])

    _startQuat.copy(camera.quaternion)
    getShotQuaternion(shot.position, shot.target, _endQuat)

    const qProxy = { t: 0 }
    setShotInfo(index)

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

    shotTimeline.to(lookTarget, {
        x: shot.target[0],
        y: shot.target[1],
        z: shot.target[2],
        onUpdate: () => controls.target.copy(lookTarget)
    }, 0)

    applyShotLighting(index, shotTimeline)
}

function isModuleInView() {
    if (!moduleEl) return false
    const rect = moduleEl.getBoundingClientRect()
    const mid = rect.top + rect.height * 0.5
    return mid > 0 && mid < window.innerHeight
}

if (moduleEl) {
    const glassObserver = new MutationObserver(() => {
        const open = moduleEl.classList.contains('is-glass-open')
        if (open) {
            setShotInfo(shotIndex, { animate: false })
            infoEl?.classList.add('is-visible')
        } else {
            infoEl?.classList.remove('is-visible')
        }
    })
    glassObserver.observe(moduleEl, { attributes: true, attributeFilter: ['class'] })

    moduleEl.addEventListener('wheel', (e) => {
        if (!moduleEl.classList.contains('is-glass-open')) return
        if (!isModuleInView()) return
        if (isShotAnimating) {
            e.preventDefault()
            return
        }

        const goingDown = e.deltaY > 0
        const goingUp = e.deltaY < 0
        if (goingDown && shotIndex >= cameraShots.length - 1) return
        if (goingUp && shotIndex <= 0) return

        e.preventDefault()
        shotIndex += goingDown ? 1 : -1
        goToShot(shotIndex)
    }, { passive: false })
}

/**
 * ========== 渲染器 ==========
 */
renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
})
renderer.setClearColor(0x000000, 0)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.22
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
applyShotLighting(0, null)

/**
 * ========== 蓝调环境反射（背景由 CSS 渐变提供） ==========
 */
scene.environmentIntensity = 2.1

const pmrem = new THREE.PMREMGenerator(renderer)
pmrem.compileEquirectangularShader()
const envRT = pmrem.fromEquirectangular(studioEquirect)
scene.environment = envRT.texture
studioEquirect.dispose()
pmrem.dispose()
applyShotLighting(shotIndex, null)

const envFolder = gui.addFolder('Environment')
envFolder.add(scene, 'environmentIntensity').min(0).max(4).step(0.01).name('env intensity')
envFolder.add(renderer, 'toneMappingExposure').min(0).max(3).step(0.01).name('exposure')
envFolder.add(floor.material, 'roughness').min(0).max(1).step(0.01).name('floor rough')
envFolder.add(floor.material, 'metalness').min(0).max(1).step(0.01).name('floor metal')

const lightsFolder = gui.addFolder('Lights')
lightsFolder.add(ambientLight, 'intensity').min(0).max(3).step(0.01).name('ambient')
lightsFolder.add(hemiLight, 'intensity').min(0).max(2).step(0.01).name('hemi')
lightsFolder.add(directionalLight, 'intensity').min(0).max(5).step(0.01).name('directional')
lightsFolder.add(rimLight, 'intensity').min(0).max(3).step(0.01).name('rim')
lightsFolder.add(fillLight, 'intensity').min(0).max(3).step(0.01).name('fill')
lightsFolder.add(topLight, 'intensity').min(0).max(3).step(0.01).name('top')
lightsFolder.add(spotLight, 'intensity').min(0).max(5).step(0.01).name('spot')
lightsFolder.add(detailLightA, 'intensity').min(0).max(4).step(0.01).name('detail A')
lightsFolder.add(detailLightB, 'intensity').min(0).max(4).step(0.01).name('detail B')

/**
 * ========== 循环（仅在模块进入视口时渲染，离开即暂停） ==========
 */
let isModuleVisible = false
let rafId = null

const tick = () => {
    if (!isModuleVisible) {
        rafId = null
        return
    }
    if (controls.enabled && !isShotAnimating) controls.update()
    renderer.render(scene, camera)
    rafId = window.requestAnimationFrame(tick)
}

function startRenderLoop() {
    if (isModuleVisible) return
    isModuleVisible = true
    if (rafId == null) rafId = window.requestAnimationFrame(tick)
}

function stopRenderLoop() {
    isModuleVisible = false
    if (rafId != null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
    }
}

const moduleSection = document.querySelector('#rb26') || canvas
if ('IntersectionObserver' in window && moduleSection) {
    const renderIO = new IntersectionObserver(
        (entries) => {
            const entry = entries[0]
            if (entry && entry.isIntersecting) startRenderLoop()
            else stopRenderLoop()
        },
        { threshold: 0.05, rootMargin: '80px 0px' }
    )
    renderIO.observe(moduleSection)
} else {
    startRenderLoop()
}
