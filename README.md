# codex-day

一个本地优先的个人 Codex Token 活动仪表盘。它读取本机 Codex 会话日志，按今天、本周、近 30 天、模型、项目和任务汇总 Token，并可以导出 CSV 与分享海报。

> 非 OpenAI 官方项目，与 OpenAI 无隶属或背书关系。

![codex-day 虚构 Demo](assets/demo-preview.png)

## 功能

- 今日、本周、近 30 天与全部记录汇总
- 输入、缓存输入、非缓存输入、输出和推理 Token
- 模型与项目筛选、项目 × 模型矩阵、任务详情
- 完整 24 小时时间轴，连续空闲时段自动压缩
- 深浅主题、CSV 导出与 1200 × 1600 海报导出
- 响应式桌面与手机布局
- 不上传日志，不依赖远程服务

## 快速开始

当前版本支持 Windows PowerShell 5.1 或更高版本，并要求本机已经产生 Codex 会话日志。

```powershell
git clone <your-repository-url>
cd codex-day
.\scripts\open-dashboard.cmd
```

脚本会扫描：

- `%USERPROFILE%\.codex\sessions`
- `%USERPROFILE%\.codex\archived_sessions`

生成结果位于 `dist/index.html`。`dist/` 已被 Git 忽略，只应保留在本机。

仅刷新、不自动打开：

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
- 完整项目路径不会写入生成页面，只保留项目目录名称。
- 原始 Session ID 和项目路径会转换成稳定的短匿名标识。
- 页面没有遥测、网络请求或云端同步。

生成页面仍会包含项目名称、模型、时间和 Token 明细。不要上传或分享 `dist/index.html`，除非你已确认其中的信息适合公开。

## 开发

普通使用不需要 Node.js。只有修改 Tailwind 样式时才需要：

```powershell
npm install
npm run build
```

可单独执行：

```powershell
npm run build:css
npm run build:demo
```

## 项目结构

```text
codex-day/
├─ assets/                    # README 的公开 Demo 预览图
├─ demo/
│  ├─ index.html              # 可直接浏览的虚构 Demo
│  └─ sample-data.json        # 虚构数据源
├─ scripts/
│  ├─ build-demo.ps1          # 重建公开 Demo
│  ├─ open-dashboard.cmd      # 刷新并打开个人仪表盘
│  └─ refresh-dashboard.ps1   # 扫描本地日志并生成 dist
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
- 中转站、代理或不同 Codex 版本可能改变日志字段；解析器遇到无法识别的记录时会跳过。

## 当前限制

- 本地生成脚本目前只提供 PowerShell 版本。
- 项目名称取自工作目录的最后一级，重名目录会在界面中显示相同名称，但内部匿名标识仍不同。
- 仪表盘无法保证与服务商账单完全一致。

## License

[MIT](LICENSE)
