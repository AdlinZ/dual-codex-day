# codex-day

一个本地优先的个人 Codex Token 活动仪表盘。它读取本机 Codex 会话日志，按今天、本周、近 30 天、模型、项目和任务汇总 Token，并可以导出 CSV 与分享海报。

> 非 OpenAI 官方项目，与 OpenAI 无隶属或背书关系。

![codex-day 虚构 Demo](assets/demo-preview.png)

## 功能

- 今日、本周、近 30 天与全部记录汇总
- 输入、缓存输入、非缓存输入、输出和推理 Token
- 按模型公开 API 标价估算成本，支持缓存写入、长上下文与处理模式
- 可保存币种、人民币汇率、中转站倍率、每日预算与每月预算
- 今日成本、本月累计、月底预测与预算进度
- 自动提示费用峰值、低缓存、长上下文与价格覆盖缺口
- 周报/月报、上期同期对比与近 12 周活跃日历
- 独立的周报/月报海报导出
- SQLite 本地增量索引，只重建新增或变化的日志文件
- 仅监听 `127.0.0.1` 的本地 HTTP 服务与健康状态接口
- Docker Compose 部署，日志只读挂载、索引独立持久化
- 本地项目别名，不修改原始日志或公开 Demo
- 模型与项目筛选、项目 × 模型矩阵、任务详情
- 完整 24 小时时间轴，连续空闲时段自动压缩
- 深浅主题、CSV 导出与 1200 × 1600 海报导出
- 本地日志变化后自动刷新，页面状态与滚动位置会保留
- 响应式桌面与手机布局
- 不上传日志，不依赖远程服务

## 快速开始

推荐使用 Node.js 22.5 或更高版本，并要求本机已经产生 Codex 会话日志。Windows 在没有 Node.js 时仍可回退到 PowerShell 5.1 版本。

```powershell
git clone https://github.com/AdlinZ/codex-day.git
cd codex-day
.\scripts\open-dashboard.cmd
```

脚本会扫描：

- `%USERPROFILE%\.codex\sessions`
- `%USERPROFILE%\.codex\archived_sessions`

启动脚本会优先使用 SQLite 增量索引，并打开 `http://127.0.0.1:8765/?live=1`。启动窗口会持续监听日志变化，关闭窗口或按 `Ctrl+C` 即可停止动态刷新。

数据库位于 `.codex-day/codex-day.sqlite`，生成页面位于 `dist/index.html`。这两个目录都已被 Git 忽略，只应保留在本机。SQLite 会保存本地日志文件路径用于判断文件是否变化，但这些路径不会进入生成页面或公开 Demo。

页面右上角的设置按钮可以配置显示币种、汇率、中转站倍率和预算。设置与项目别名保存在浏览器的 `localStorage`，不会写入仓库、日志或导出的静态模板。

使用 Node.js 只增量索引并生成一次静态快照：

```powershell
npm run index
```

直接启动本地服务：

```powershell
npm start
```

服务提供 `/healthz` 与 `/api/status` 两个只读状态接口。默认仅绑定 `127.0.0.1`，不会暴露到局域网。

## Docker

Docker 版本适合希望后台常驻、又不想在宿主机安装 Node.js 的用户。它仍然只读取本机日志，不会上传数据；Compose 只把服务发布到 `127.0.0.1`。

先复制环境变量示例，并把 `CODEX_DATA_DIR` 改成自己的 `.codex` 目录：

```powershell
Copy-Item .env.example .env
notepad .env
docker compose up -d --build
```

Windows Docker Desktop 路径请使用正斜杠，例如：

```dotenv
CODEX_DATA_DIR=C:/Users/your-name/.codex
```

macOS 或 Linux 可以填写：

```dotenv
CODEX_DATA_DIR=/Users/your-name/.codex
```

启动后访问 `http://127.0.0.1:8765`。原始日志以只读方式挂载到 `/codex`，SQLite 索引存放在 Docker 命名卷 `codex-day_index` 中。更新与停止命令：

```powershell
docker compose up -d --build
docker compose down
```

`docker compose down` 不会删除索引；只有显式增加 `--volumes` 才会移除持久化卷。时区默认是 `Asia/Shanghai`，可以在 `.env` 中修改 `TZ`。端口冲突时修改 `CODEX_DAY_PORT`。

使用 PowerShell 兼容模式只生成一次静态快照：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\refresh-dashboard.ps1
```

使用其他 Codex 数据目录：

```powershell
.\scripts\refresh-dashboard.ps1 -CodexRoot "D:\my-codex-data"
```

## 查看虚构 Demo

仓库中的 Demo 数据完全虚构，不来自任何真实用户或项目。

```powershell
.\scripts\build-demo.ps1 -Open
```

也可以直接打开 `demo/index.html`。Demo 使用固定参考时间，因此不会随当前日期变成空页面。

## 隐私设计

公开仓库和个人数据之间有明确边界：

- `src/index.template.html` 只包含空数据占位符。
- `demo/sample-data.json` 只包含虚构项目与虚构任务。
- 真实数据仅写入被忽略的 `dist/`。
- SQLite 索引仅写入被忽略的 `.codex-day/`。
- 完整项目路径不会写入生成页面，只保留项目目录名称。
- 原始 Session ID 和项目路径会转换成稳定的短匿名标识。
- 页面没有遥测、网络请求或云端同步。
- 预算、价格倍率和项目别名仅保存在当前浏览器。

生成页面仍会包含项目名称、模型、时间和 Token 明细。不要上传或分享 `dist/index.html`，除非你已确认其中的信息适合公开。

## 开发

增量索引需要 Node.js 22.5 或更高版本。修改 Tailwind 样式还需要先安装开发依赖：

```powershell
npm install
npm run build
npm test
```

可单独执行：

```powershell
npm run build:css
npm run build:demo
npm run test:container
```

`npm test` 会检查模板与 Demo、SQLite 增量行为以及容器的只读挂载、持久化和本地端口边界。如果本机安装了 Docker，还会额外执行 `docker compose config`。

## 项目结构

```text
codex-day/
├─ Dockerfile                 # 非 root 的 Node.js 运行镜像
├─ compose.yaml               # 本地端口、只读日志与持久化索引
├─ .env.example               # 跨平台 Docker 配置示例
├─ assets/                    # README 的公开 Demo 预览图
├─ config/
│  └─ pricing.json            # 可更新的 API 价格快照
├─ demo/
│  ├─ index.html              # 可直接浏览的虚构 Demo
│  └─ sample-data.json        # 虚构数据源
├─ scripts/
│  ├─ build-demo.ps1          # 重建公开 Demo
│  ├─ codex-day.mjs           # 增量索引、本地服务与跨平台入口
│  ├─ check-container.mjs     # Docker/Compose 边界检查
│  ├─ check-indexer.mjs       # SQLite 增量行为集成测试
│  ├─ lib/
│  │  └─ session-index.mjs    # JSONL 解析、SQLite 与页面生成
│  ├─ open-dashboard.cmd      # 刷新并打开个人仪表盘
│  ├─ refresh-dashboard.ps1   # 扫描本地日志并生成 dist
│  └─ watch-dashboard.ps1     # 监听日志变化并触发页面更新
├─ src/
│  ├─ index.template.html     # 无私人数据的页面模板
│  ├─ styles.css              # Tailwind 源样式
│  └─ token-dashboard.css     # 预编译样式，普通使用无需 npm
├─ .gitignore
├─ LICENSE
├─ package.json
└─ tailwind.config.js
```

## 数据口径

- 统计来自本地日志中的 `token_count` 事件，不是账单或费用数据。
- 缓存 Token 已包含在输入 Token 中。
- 推理 Token 已包含在输出 Token 中。
- API 等价预计成本按每次调用分别计算，避免按周期总量误触发长上下文价格。
- 页面预计成本 = API 情景价格 × 中转站倍率；切换人民币仅改变显示和预算输入，不修改底层美元价格快照。
- 月底预测使用本月截至当前时刻的平均消耗速度折算，样本较少时只应视为趋势提示。
- `config/pricing.json` 的 GPT-5.6 与 GPT-5.3-Codex 标价已于 2026-08-20 对照 [OpenAI Docs](https://developers.openai.com/api/docs/pricing) 核验。
- Standard 为默认计价模式；Batch、Flex 和 Fast 仅用于价格情景对比，并不代表日志中的真实处理模式。
- 没有价格或不支持所选模式的模型不会参与费用合计，页面会显示定价覆盖率。
- 中转站、代理或不同 Codex 版本可能改变日志字段；解析器遇到无法识别的记录时会跳过。
- SQLite 按文件大小和修改时间识别变化；变化文件会整体重新解析，未变化文件不会重复扫描。

## 当前限制

- Node.js 增量模式要求 22.5 或更高版本；Windows PowerShell 模式仍可作为兼容回退。
- Docker 部署需要用户显式配置 `CODEX_DATA_DIR`，不会自动猜测或扩大宿主机挂载范围。
- 项目名称取自工作目录的最后一级，重名目录会在界面中显示相同名称，但内部匿名标识仍不同。
- 成本仅是公开 API 标价的等价估算，无法代表公司中转站的折扣、包量、倍率或实际账单。

## 后续方向

- Windows 托盘入口与后台刷新
- 可选择的本地数据保留与索引清理策略

Node.js、SQLite 与 Docker 部署层已经完成。下一阶段将优先改善后台常驻体验，并让用户可以控制历史索引的保留周期。

## License

[MIT](LICENSE)
