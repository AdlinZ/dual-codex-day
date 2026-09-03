# Dual Codex Day

<p align="center"><img src="assets/codex-day-mark.svg" width="112" alt="Dual Codex Day Logo"></p>

[![CI](https://github.com/AdlinZ/dual-codex-day/actions/workflows/ci.yml/badge.svg)](https://github.com/AdlinZ/dual-codex-day/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/AdlinZ/dual-codex-day)](https://github.com/AdlinZ/dual-codex-day/releases)
[![Website](https://img.shields.io/badge/website-GitHub%20Pages-176c4b)](https://adlinz.github.io/dual-codex-day/)

一个本地优先的 Codex 多账号启动、Skills 管理与个人用量中心。在同一个项目里管理隔离账号，统一分发 Skills，并查看今天、本周、模型、项目和任务维度的 Token 活动。

> 非 OpenAI 官方项目，与 OpenAI 无隶属或背书关系。

官网与公开 Demo：[adlinz.github.io/dual-codex-day](https://adlinz.github.io/dual-codex-day/)

![Dual Codex Day 虚构用量 Demo](assets/demo-preview.png)

## 三项核心能力

### 多账号隔离启动

- 为每个账号创建独立的 `CODEX_HOME`、SQLite 和客户端数据目录
- 一键打开 Codex CLI、独立 VS Code 窗口或实验性的桌面客户端实例
- 持久记录启动实例并显示每个账号当前运行数量
- 在所选 Profile 的打开按钮旁直接关闭该账号的全部客户端实例
- 自动记录 Profile、工作目录和客户端入口，并从启动中心继续上次工作
- Electron 桌面控制台统一展示账号、入口状态、今日用量与最近启动记录
- 单层居中导航与统一纯白工作区减少常驻工具栏、面板边框和跨页面色差
- 每个 Profile 可选择 OpenAI 官方登录或独立的 Responses API 中转站
- 通过版本化迁移文件预览、导出和恢复 Profile 设置，写入前自动创建本地备份
- 从恢复中心校验并预览历史更新备份，只恢复所选 Profile 的账号设置与 `config.toml`
- 只读检查 Profile 配置、认证、入口、Skills、插件、用量索引和备份，并导出脱敏诊断
- 在 Profile 列表和启动区显示就绪、需留意或不可启动状态，并统计待处理项目
- 启动前即时检查环境；可继续的异常需要确认，阻断项可直接进入登录、供应商、恢复、Skills 或数据诊断
- 不读取、复制、导入或展示 `auth.json`；中转站 API Key 使用操作系统加密
- 启动时清除继承的 API Key 和 Access Token，只向目标 Profile 注入其专用密钥
- 原生 Windows 图形界面，编译器不可用时自动回退到 PowerShell 界面

### 本地用量分析

- 今日、本周、近 30 天、近 90 天、自定义日期与全部记录汇总
- 输入、缓存输入、非缓存输入、输出和推理 Token
- 按模型公开 API 标价估算成本，支持缓存写入、长上下文与处理模式
- 今日成本、本月累计、月底预测、预算进度与价格覆盖提示
- 周报/月报、同期对比、近 12 周活跃日历、CSV、分享海报与 CC Switch 只读对账
- 默认账号与各 Profile 并列对比，并可从最近任务钻取模型调用与 Token 构成
- SQLite 增量索引、本地项目别名、任务详情和完整 24 小时时间轴
- 仅监听 `127.0.0.1`，不上传日志，不依赖远程服务

### Skills 管理

- 扫描 `~/.agents/skills`、默认 `CODEX_HOME/skills`、独立 Profile 和当前仓库 Skills
- 可在 Skills 页直接选择项目并立即扫描其 `.agents/skills`，项目来源保持只读
- 自动发现“文档”目录下项目中的 `.agents/skills`，无需逐个选择项目
- 用矩阵查看共享、默认账号及各 Profile 的安装状态和同名冲突
- 显式共享或同步 Skill，不自动迁移现有目录
- 通过 `[[skills.config]]` 管理启用状态，删除时移入系统回收站
- 系统内置 `.system` Skills 只读，所有写操作限制在已识别的受管目录
- 单独展示插件提供的 Skills，并按插件包归组，避免把缓存残留误判为已安装
- 通过 Codex 插件命令把整个插件安装到目标 Profile；自定义 Marketplace 会随安装来源注册
- 支持按环境启停或卸载插件，插件包含的所有 Skills 共同生效
- 单独列出 Marketplace 中可安装的插件 Skills，并可选择安装到默认 Codex 或指定 Profile

## Windows 快速开始

推荐安装 Node.js 22.5 或更高版本。Electron 桌面版与多账号启动核心需要 Node.js；用量仪表盘在没有 Node.js 时仍可回退到 PowerShell 5.1 静态模式。

```powershell
git clone https://github.com/AdlinZ/dual-codex-day.git
cd dual-codex-day
npm install
```

启动 Electron 桌面版：

```powershell
npm run desktop
```

构建 Windows x64 桌面应用：

```powershell
npm run package:electron
```

构建结果位于 `dist\electron\dual-codex-day-win32-x64`。原生 Windows 账号管理器继续作为轻量回退入口：

```powershell
.\scripts\open-profiles.cmd
```

打开用量仪表盘：

```powershell
.\scripts\open-dashboard.cmd
```

## 多账号启动

在启动器中新建“工作账号”“个人账号”等配置，选择启动目录，然后打开 CLI、VS Code 或桌面客户端。账号来源可以设为“当前默认 Codex”或“独立 Profile”：前者复用现有系统账号，后者保存独立登录和配置。首次启动独立 Profile 时，在官方登录页面完成对应账号的登录。

配置默认保存在 `%LOCALAPPDATA%\dual-codex-day\profiles`，不会覆盖、迁移或修改现有的 `%USERPROFILE%\.codex`。显示名称不参与路径拼接，每个配置使用随机 ID 目录。

运行来源与隔离范围：

- **当前默认 Codex**：CLI、VS Code 和桌面端沿用系统现有账号与数据目录，适合把已在工作的主账号直接接入 DCD。
- **独立 Profile / CLI**：独立 `CODEX_HOME` 与 SQLite 状态。
- **独立 Profile / VS Code**：独立 `CODEX_HOME` 和 `--user-data-dir`，打开独立的 VS Code 实例。
- **独立 Profile / Codex 桌面客户端**：独立 `CODEX_HOME` 和 Electron `--user-data-dir`。该入口标记为实验性，因为官方没有承诺商店版客户端始终支持多实例。

官方环境变量说明确认 `CODEX_HOME` 覆盖 CLI、IDE 扩展和 app-server 的配置、认证、日志、Session 与 SQLite 状态；桌面客户端本身不在该兼容承诺中，所以 DCD 还必须为独立桌面实例设置单独的 Electron 用户数据目录。账号列表会通过 `codex login status` 显示经过脱敏的登录状态，不读取认证文件。Profile 可以重命名；删除前会要求确认，并把其独立目录移入系统回收站，默认 Codex 数据不受影响。

每个配置都会生成自己的 `config.toml`。官方模式写入 `cli_auth_credentials_store = "file"`；中转站模式还会写入 `model_provider`、`base_url`、认证方式和 `wire_api = "responses"` 等字段。不要上传或分享 `%LOCALAPPDATA%\dual-codex-day\profiles`。

### Profile 供应商设置

选中 Profile 后打开“供应商设置”，可以在以下模式间切换：

- **OpenAI 官方**：使用该 Profile 自己的 ChatGPT 官方登录状态。
- **自定义中转站**：分别设置供应商名称、备注、Provider ID、模型和 API 请求地址，并可配置推理强度、交互个性和旧版响应存储兼容项。

中转站提供三种互斥认证方式：

- **CDC 安全密钥**：API Key 使用 Electron `safeStorage` 调用操作系统加密，启动时通过独立 `env_key` 注入目标进程。
- **Codex 登录**：生成 `requires_openai_auth = true`，使用该 Profile 自己的 ChatGPT 或 API Key 登录状态；CDC 不读取登录凭据。
- **无需认证**：不生成密钥变量，适用于不要求认证的本地兼容服务。

根据 [Codex Authentication](https://developers.openai.com/codex/auth)，`requires_openai_auth = true` 时 Codex 会忽略 `env_key`，因此 CDC 不会同时生成两套认证字段。使用 CDC 安全密钥时，渲染页面、`profiles.json`、`config.toml` 和启动历史都不会包含明文；留空保存会保留已有密钥，填写新值会替换，切换到其他认证方式会删除该 Profile 的 CDC 密钥。

保存供应商时会解析现有 `config.toml` 并只替换当前供应商管理的字段，插件、MCP、桌面偏好、项目信任、通知和其他通用配置会保留。供应商编辑器中的“导入配置”可以选择另一个 `config.toml`：CDC 会移除来源文件的活动模型与供应商，再叠加目标 Profile 的当前供应商；`auth.json` 不会被读取或复制。TOML 会由序列化器重新排版，原注释和手工格式不会保留。

自定义中转站必须兼容 Codex 的 Responses API。CDC 不会自动发起可能计费的连接测试。使用“CDC 安全密钥”时，Electron 控制台会自动解密并向目标进程注入密钥；直接使用 Node.js 命令启动该类 Profile 时，需要调用方自行提供 `DUAL_CODEX_DAY_PROVIDER_API_KEY`。

### Profile 迁移与恢复

启动中心的导出按钮会生成版本化 JSON，内容包括 Profile 名称、供应商元数据、运行与用量来源、脱敏后的通用 `config.toml`、Profile-local Skill 状态、已安装插件状态和该账号的用量偏好。迁移文件不包含 `auth.json`、API Key、加密密钥、日志、SQLite 用量数据或启动历史。

导入时先显示创建或更新目标、变更范围、缺少的 Skills/插件和凭据要求。只有确认后才写入；每次写入前会在 `%LOCALAPPDATA%\dual-codex-day\profiles\backups` 建立本地备份，失败时自动回滚。目标环境缺少的 Skills 和插件只会列出，不会自动安装。自定义环境认证无法随文件迁移，供应商身份发生变化时需要重新填写 API Key。

恢复中心列出所选 Profile 的已完成更新备份，并校验元数据、目标身份、文件结构、路径边界、TOML 内容和文件完整性。确认前会预览账号设置与 `config.toml` 的变化；有客户端仍在运行时无法恢复。执行恢复前会再创建一份保护备份，只合并所选 Profile 的注册表条目并还原它的 `config.toml`，不会覆盖其他 Profile，也不会改动凭据、日志或用量 SQLite。当前版本不开放创建类备份恢复，因为这类备份还需要单独定义新建 Profile 数据的删除边界。

### Profile 环境体检

选中 Profile 后可以从启动中心打开环境体检。检查过程保持只读，覆盖注册信息与活动 `config.toml`、运行与用量目录、供应商认证状态、CLI/VS Code/桌面端入口、Skill 路径、已配置插件、用量索引、活动实例和最近迁移备份。单项检查失败会保留其他分组结果。

启动中心使用同一份体检模型生成 Profile 就绪摘要。配置损坏、运行目录不可用、缺少必要凭据或安全凭据存储不可用会阻止启动；未登录、组件缺失和用量索引异常会展示处理入口，并允许确认后继续。处理动作只跳转到 DCD 已有的受限功能，不会执行后台自动修复。

体检结果分为“正常”“需留意”“需处理”。导出的版本化 JSON 会移除 Profile 名称、内部 ID、用户名和绝对路径，不包含认证文件、API Key、加密密钥、日志正文或用量事件。体检不自动修改配置；备份恢复需要从独立恢复中心预览并确认。

命令行管理入口：

```powershell
node .\scripts\codex-profiles.mjs doctor
node .\scripts\codex-profiles.mjs list
node .\scripts\codex-profiles.mjs create "工作账号"
node .\scripts\codex-profiles.mjs launch "工作账号" --target vscode --workspace .
```

Windows 会用系统自带的 .NET Framework 编译器在本机构建 `dist\dual-codex-day.exe`。源码更新后自动重建，构建失败时回退到 PowerShell 图形界面。设计和安全边界见 [v1.0.0 规划](docs/plans/v1.0.0.md)。

Electron `v0.23.0` 使用沙箱渲染进程和受限预加载桥接，账号、启动、预检、最近工作与实例关闭逻辑复用同一套 Node.js 核心。范围和基础安全边界见 [v0.10.0 规划](docs/plans/v0.10.0.md)，当前版本变化见 [v0.23.0 Release Notes](docs/releases/v0.23.0.md)。Windows 上打开 Codex CLI 需要系统已安装 Windows Terminal，DCD 会用独立终端窗口承载交互界面。

### 同时打开两个 Codex 桌面账号

1. 为现有工作账号创建 Profile，并把运行环境和用量记录都设为“当前默认 Codex”。
2. 创建第二个 Profile，保留“独立 Profile”，点击“打开独立 Codex”并完成另一个账号的官方登录。
3. 回到控制台分别打开两个账号。
4. 左侧账号列表和“运行与最近启动”会分别显示两个正在运行的实例。

启动器会等待确认客户端主进程仍然存活；默认账号使用系统数据目录，第二个实例使用独立的 `CODEX_HOME`、SQLite 和 Electron `--user-data-dir`。在 Windows Store 版 `OpenAI.Codex 26.818.8289.0` 上已经完成“默认实例 + 独立实例”双开实测；由于官方尚未把多实例作为稳定接口承诺，后续客户端更新仍需重新验证。

所选 Profile 的打开按钮旁会显示“关闭客户端”，一次确认后逐个关闭该 Profile 的全部活动实例；“继续工作”区域仍可单独关闭某个运行实例。DCD 只关闭对应启动记录的进程树：先请求正常退出，未响应时再强制结束；系统默认运行环境会额外提示共享窗口风险。关闭操作会核对 PID 的进程创建时间，历史 PID 被系统复用时会拒绝执行。实例关闭能力已在 Codex CLI、独立 VS Code 和 `OpenAI.Codex 26.820.7780.0` 独立桌面实例上完成真实启动与关闭验证。

### 最近工作组合

客户端成功启动后，DCD 会在本机记录 Profile、工作目录和入口类型。启动中心显示“继续上次工作”以及最近或固定的工作组合；点击后先切换到对应 Profile 和目录，再执行当前版本的启动前体检。记录只接受 DCD 已知的 Profile、目录和 CLI、VS Code、Codex 桌面端入口，不保存命令行参数。

工作目录缺失时可以重新选择目录；Profile 已删除或客户端入口不可用时会保留失效提示，不会自动换用其他账号或入口。最近工作记录保存在 Profile 根目录的 `work-combinations.json`，最多保留 24 条，其中最多固定 8 条。文件包含本机绝对路径，因此不会进入 Profile 导出或迁移文件。

## 用量仪表盘

仪表盘默认扫描：

- `%USERPROFILE%\.codex\sessions`
- `%USERPROFILE%\.codex\archived_sessions`

启动后，服务在系统托盘常驻并打开 `http://127.0.0.1:8765/?live=1`。默认数据库仍保存在 `.codex-day/codex-day.sqlite`，以兼容已有索引；生成页面位于 `dist/index.html`。这两个目录都已被 Git 忽略。

页面设置可以保存币种、汇率、中转站倍率、预算和项目别名，也可以导出带版本号的 JSON 配置并在导入前预览。设置保存在浏览器 `localStorage`，不会写入原始日志。

服务提供 `/healthz`、`/api/status` 与 `/api/summary` 三个只读接口。`/api/summary?date=YYYY-MM-DD` 只返回汇总 Token、交互回合、模型调用数、任务数、缓存率和主要模型，不返回项目名称或 Session ID。Electron 用量中心还提供周报/月报、同期对比、CSV、用量海报与周期报告海报。

常用命令：

```powershell
npm run index
npm start
node .\scripts\codex-day.mjs doctor --json
node .\scripts\codex-day.mjs summary --date 2026-08-24 --json
node .\scripts\codex-day.mjs pricing --json
node .\scripts\codex-day.mjs --retention-days 90
```

`pricing` 只读检查本地价格快照，不会联网抓取或覆盖文件。历史保留周期默认是 `all`，缩短周期只清理 SQLite 事件，不删除或修改 Codex 原始日志。

## Windows 托盘

双击 `scripts/open-dashboard.cmd` 后，Dual Codex Day 会缩到 Windows 通知区域。右键菜单可以：

- 查看当前调用数和任务数
- 打开仪表盘或本地日志目录
- 重启后台服务
- 随时显示今日摘要
- 打开或关闭每日摘要提醒，并选择 17:00、18:00、20:00 或 22:00
- 打开或关闭当前用户的开机自启
- 退出托盘并停止它所管理的服务

开机自启和每日摘要提醒默认关闭。托盘继续使用原有 `.codex-day/` 状态目录和当前用户注册表键，确保升级后不会丢失设置或生成重复服务。

### 兼容说明

项目对外名称、安装目录、原生 EXE、容器镜像和发布包均使用 `dual-codex-day`。为避免升级破坏已有数据，`codex-day.mjs`、`.codex-day/`、浏览器存储键及现有图标文件名暂时保留；这些名称属于兼容接口，不代表旧品牌仍在使用。

## Docker

Docker 版本适合希望后台常驻、又不想在宿主机安装 Node.js 的用户。它仍然只读取本机日志，不会上传数据；Compose 只把服务发布到 `127.0.0.1`。

正式版本可以直接从 GHCR 拉取 `ghcr.io/adlinz/dual-codex-day:latest`，或者继续使用仓库内 Compose 在本机构建。

个人账号下首次发布 GHCR 包时，GitHub 会默认设为私有，需要在包设置中手动切换一次 `Public`。Release 流程包含匿名拉取检查，私有镜像不会被误标为正式公开版本。

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

启动后访问 `http://127.0.0.1:8765`。原始日志以只读方式挂载到 `/codex`，SQLite 索引存放在 Docker 命名卷 `dual-codex-day_index` 中。更新与停止命令：

```powershell
docker compose up -d --build
docker compose down
```

`docker compose down` 不会删除索引；只有显式增加 `--volumes` 才会移除持久化卷。时区默认是 `Asia/Shanghai`，可以在 `.env` 中修改 `TZ`。端口冲突时修改 `CODEX_DAY_PORT`，历史保留周期通过 `CODEX_DAY_RETENTION_DAYS` 配置。

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
- 只有用户主动导出设置时才会生成配置文件；该文件不含日志明细，但包含预算和项目别名。

生成页面仍会包含项目名称、模型、时间和 Token 明细。不要上传或分享 `dist/index.html`，除非你已确认其中的信息适合公开。

## 开发

增量索引需要 Node.js 22.5 或更高版本。修改 Tailwind 样式还需要先安装开发依赖：

```powershell
npm install
npm run build
npm test
npm run desktop
```

可单独执行：

```powershell
npm run build:css
npm run build:demo
npm run test:service
npm run test:profiles
npm run test:electron
npm run test:tray
npm run test:container
```

`npm test` 会检查模板与 Demo、SQLite 增量行为、服务 PID 生命周期、Windows 托盘脚本以及容器的只读挂载、持久化和本地端口边界。如果本机安装了 Docker，还会额外执行 `docker compose config`。

## 项目结构

```text
dual-codex-day/
├─ Dockerfile                 # 非 root 的 Node.js 运行镜像
├─ compose.yaml               # 本地端口、只读日志与持久化索引
├─ .env.example               # 跨平台 Docker 配置示例
├─ assets/                    # 品牌图标与公开 Demo 预览
│  ├─ codex-day-mark.svg      # 兼容文件名：页面与 favicon 品牌图标
│  ├─ codex-day.ico           # 兼容文件名：Windows 多尺寸图标
│  └─ demo-preview.png        # README 的公开 Demo 预览图
├─ config/
│  ├─ pricing.json            # 可更新的 API 价格快照
│  ├─ profiles.zh-CN.json     # 多账号启动器中文文本
│  └─ tray.zh-CN.json         # Windows 托盘中文文本
├─ demo/
│  ├─ index.html              # 可直接浏览的虚构 Demo
│  └─ sample-data.json        # 虚构数据源
├─ electron/
│  ├─ main.mjs                # Electron 主进程、IPC 与详细仪表盘窗口
│  ├─ preload.cjs             # 受限渲染进程桥接
│  └─ renderer/               # 桌面控制台 HTML、CSS 与交互
├─ scripts/
│  ├─ build-demo.ps1          # 重建公开 Demo
│  ├─ build-demo.mjs          # 跨平台重建公开 Demo
│  ├─ codex-day.mjs           # 增量索引、本地服务与跨平台入口
│  ├─ codex-day-tray.ps1      # Windows 托盘与开机自启控制
│  ├─ check-container.mjs     # Docker/Compose 边界检查
│  ├─ check-indexer.mjs       # SQLite 增量行为集成测试
│  ├─ check-service.mjs       # 服务健康与 PID 生命周期测试
│  ├─ check-pricing.mjs       # 价格快照与候选差异检查
│  ├─ check-profiles.mjs      # 多账号目录与启动隔离检查
│  ├─ check-electron.mjs      # Electron 安全边界与界面结构检查
│  ├─ capture-electron.mjs    # 本地桌面视觉验收截图
│  ├─ package-electron.mjs    # Electron 跨平台打包入口
│  ├─ build-profiles-launcher.ps1 # 构建原生 Windows 启动器
│  ├─ check-tray.mjs          # 托盘入口与脚本语法检查
│  ├─ lib/
│  │  ├─ pricing-audit.mjs    # 只读价格审计与候选差异
│  │  ├─ profile-store.mjs    # 多账号配置、检测与启动核心
│  │  └─ session-index.mjs    # JSONL 解析、SQLite 与页面生成
│  ├─ open-dashboard.cmd      # 刷新并打开个人仪表盘
│  ├─ open-profiles.cmd       # 打开 Windows 多账号启动器
│  ├─ codex-profiles-ui.ps1   # Windows 多账号图形界面
│  ├─ codex-profiles.mjs      # 跨平台配置管理命令
│  ├─ refresh-dashboard.ps1   # 扫描本地日志并生成 dist
│  └─ watch-dashboard.ps1     # 监听日志变化并触发页面更新
├─ windows/
│  └─ CodexProfilesLauncher.cs # 原生 Windows 图形界面源码
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
- `config/pricing.json` 的 GPT-5.6 标价已于 2026-08-25 对照 [OpenAI Docs](https://developers.openai.com/api/docs/pricing) 核验，`gpt-5.3-codex` 保留 2026-08-20 的核验日期；其余未单独核验的模型会明确标记为待核验。
- 页面按每个模型的核验日期提示快照新鲜度；这只是本地时间判断，不代表后台联网比价或自动确认价格未变化。
- Standard 为默认计价模式；Batch、Flex 和 Fast 仅用于价格情景对比，并不代表日志中的真实处理模式。
- 没有价格或不支持所选模式的模型不会参与费用合计，页面会显示定价覆盖率。
- 中转站、代理或不同 Codex 版本可能改变日志字段；解析器遇到无法识别的记录时会跳过。
- SQLite 按文件大小和修改时间识别变化；变化文件会整体重新解析，未变化文件不会重复扫描。
- 无效 JSON、无效时间戳、空用量和重复事件会进入脱敏诊断汇总，不再静默丢失上下文。
- 历史保留策略只影响 SQLite 索引；Codex 原始日志始终保持只读。

## 当前限制

- Node.js 增量模式和多账号启动核心要求 22.5 或更高版本；Windows 仪表盘在无 Node.js 时仍可回退到 PowerShell 静态模式。
- Electron 中的 Codex CLI 独立终端依赖 Windows Terminal；未安装时 CLI 入口会显示为不可用。
- Codex 桌面客户端多实例已在当前 Windows Store 版完成双实例验证，但仍未获官方稳定性承诺；客户端大版本更新后需要重新验证。
- Docker 部署需要用户显式配置 `CODEX_DATA_DIR`，不会自动猜测或扩大宿主机挂载范围。
- 项目名称取自工作目录的最后一级，重名目录会在界面中显示相同名称，但内部匿名标识仍不同。
- 成本仅是公开 API 标价的等价估算，无法代表公司中转站的折扣、包量、倍率或实际账单。

## 后续方向

- 可选的周目标和月目标回顾
- 价格候选快照的人工确认与显式更新流程

v0.23.0 已补齐启动前预检、最近工作组合和默认账号统一入口；Electron 控制中心的基础设计范围与验收标准见 [v0.10.0 规划](docs/plans/v0.10.0.md)。价格审计与 90 天回顾见 [v0.9.0 规划](docs/plans/v0.9.0.md)，设置迁移与每日摘要见 [v0.8.0 规划](docs/plans/v0.8.0.md)。

## License

[MIT](LICENSE)
