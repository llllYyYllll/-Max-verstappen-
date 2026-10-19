# Max Verstappen

马克斯·维斯塔潘主题展示页：包含首页视觉、生涯 Legacy、2026 赛程，以及基于 Three.js 的 RB26 赛车交互场景。

## 环境要求

- [Node.js](https://nodejs.org/) 18 或更高版本（建议 LTS）
- npm（随 Node.js 一并安装）

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/llllYyYllll/-Max-verstappen-.git

# 2. 进入项目目录
cd -Max-verstappen-

# 3. 安装依赖
npm install

# 4. 启动开发服务器
npm run dev
```

启动后，终端会输出本地地址（默认 [http://localhost:5173/](http://localhost:5173/)），浏览器一般会自动打开。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器（热更新） |
| `npm run build` | 打包生产构建，输出到 `dist/` |
| `npm run preview` | 本地预览打包后的站点 |

## 项目结构

```
.
├── src/                 # 网站源码（Vite root）
│   ├── index.html       # 入口页面
│   ├── style/           # 样式
│   ├── script/          # 页面与 Three.js 交互逻辑
│   ├── data/            # 赛程等 JSON 数据
│   └── img/             # 图片资源
├── vite.config.js       # Vite 配置
└── package.json
```

## 技术栈

- Vite
- Three.js
- GSAP
- lil-gui

## 注意事项

- 请在项目根目录执行 `npm install` / `npm run dev`，不要只在 `src/` 下安装依赖。
- 若端口 `5173` 被占用，Vite 会自动改用下一个可用端口，以终端实际输出为准。
- 3D 场景对显卡与浏览器性能有一定要求，建议使用较新的 Chrome / Edge / Firefox。
