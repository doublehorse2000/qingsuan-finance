# 清算 · 个人财务管家

一个本地优先的个人财务管理 Web 应用，用于记录收入、支出、预算、账户和投资，并按月生成可视化复盘与 AI 分析数据包。

## 已实现

- 月度仪表盘：收入、支出、储蓄率、净资产、分类占比和六个月趋势
- 收支流水：新增、编辑、删除、按月或全部月份浏览、筛选、搜索和 CSV 导出
- 分类预算：预算进度、超支提醒和复制历史预算
- 账户与投资：资产/负债账户、投资成本、市值、收益和配置比例
- 多币种账户：账户可使用人民币或美元，美元账户可设置兑人民币汇率，汇总自动换算为人民币
- 月末快照：记录总资产和总负债，形成净资产历史
- AI 分析导出：默认导出聚合数据，可选附带流水，支持提示词、Markdown 和 JSON
- 桌面版导出：CSV、JSON、AI 文本和 Markdown 会弹出系统保存窗口，可选择保存位置
- 数据管理：完整 JSON 备份、恢复、演示数据和空白初始化
- PDF 导入：桌面版可在“导入流水”页面选择招商银行 PDF，调用 Conda 解析器和可配置的本地 AI，并将分类流水直接写入账户；网页端可读取已生成的 CSV
- 主题切换：提供浅色、深色、跟随系统三种模式，并记住选择
- 响应式布局：适配桌面、窄窗口和移动端

所有数据默认保存在浏览器 `localStorage`，应用不会主动上传财务数据。清理浏览器网站数据前，请先导出 JSON 备份。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
pnpm preview
```

## 打包为 macOS 应用

在 macOS 上执行（会生成同时兼容 Apple Silicon 和 Intel 的 Universal 应用）：

```bash
npm run build:mac
open dist-mac/清算.app
```

如果需要分发给其他 Mac，可以继续生成磁盘映像：

```bash
npm run package:mac
open dist-mac/清算-macOS.dmg
```

## GitHub Actions 跨平台打包

仓库内的 `.github/workflows/build-desktop.yml` 会在 GitHub Actions 中分别构建 macOS、Windows 和 Linux 安装包。工作流会自动安装 Python、PyInstaller 和 PDF 解析依赖，把独立解析器一起放进安装包。手动运行工作流可以获得 Actions 构建产物；推送版本标签时还会自动创建或更新 GitHub Release。也可以在手动运行时填写 `release_tag`，把构建产物补传到已有版本：

```bash
git tag v0.1.0
git push origin v0.1.0
```

构建产物包括 macOS DMG/ZIP、Windows 安装程序/ZIP，以及 Linux AppImage/DEB。也可以在本机运行 `npm run package:desktop` 生成当前系统的桌面安装包，输出在 `release/`。

首次打开未签名应用时，如果系统提示无法验证开发者，可在“系统设置 → 隐私与安全性”中选择“仍要打开”。

### macOS 下载后提示“应用已损坏”

当前 GitHub Actions 使用的是未签名构建，macOS 下载后会附加隔离属性，Gatekeeper 可能显示“应用已损坏”。请先把应用从 DMG 拖到“应用程序”文件夹，然后在终端执行：

```bash
xattr -dr com.apple.quarantine "/Applications/清算.app"
open "/Applications/清算.app"
```

也可以在 Finder 中右键点击“清算.app”并选择“打开”，或到“系统设置 → 隐私与安全性”中点击“仍要打开”。如果你下载的是 ZIP，请先解压，再对解压后的 `.app` 执行上述命令。

要让普通用户无需执行这些操作，需要 Apple Developer ID Application 签名和 notarization；这需要在 GitHub Secrets 中配置 Apple 开发者证书和公证凭据，当前仓库尚未配置这些凭据。

## 项目结构

```text
src/
  components/    通用弹窗
  lib/           财务计算、备份和 AI 导出
  views/         总览、流水、PDF 导入、预算、资产、分析和设置
  data.ts        演示数据与分类配置
  store.ts       本地持久化
  types.ts       数据模型
```

## 开源项目参考

产品设计参考了以下公开项目的思路，但没有复制其代码：

- [Actual Budget](https://github.com/actualbudget/actual)：本地优先、信封预算和跨平台桌面架构
- [Firefly III](https://github.com/firefly-iii/firefly-iii)：账户、交易、分类、标签和财务报告
- [Ghostfolio](https://github.com/ghostfolio/ghostfolio)：投资组合、资产配置和风险视角
- [Maybe](https://github.com/maybe-finance/maybe)：净资产总览和现代个人财务体验
- [Cashew](https://github.com/jameskokoska/Cashew)：移动端预算、目标和跨平台交互

## 桌面应用路线

当前跨平台桌面打包使用 Electron + electron-builder，前端构建结果和本地优先的数据能力在 macOS、Windows 和 Linux 中共用。macOS 还保留了 Swift/WebKit 原生外壳，可通过 `npm run build:mac` 单独生成。

### 在软件中导入 PDF

“导入流水”页面的“选择 PDF 并转换”功能依赖本机的 `qingsuan-pdf` Conda 环境。先完成 `tool/README.md` 中的环境安装，并启动 Ollama 或 llama.cpp 的兼容接口；然后在页面填写接口地址、模型名称和（需要时）API 密钥。桌面版会弹出文件选择器，转换完成后可预览并选择账户，点击“导入清算”即可写入流水。导入会按日期、金额、分类、交易对象和账户识别重复记录，并使用 CSV 中最后一笔联机余额同步账户余额。

正式桌面安装包会把 `parse_cmb_pdf.py`、pdfplumber 和 Python 运行时编译成当前平台的独立解析器，用户运行 PDF 导入时不需要安装 Python、Conda 或 pdfplumber。开发环境如果没有构建独立解析器，Electron 才会回退到 `QINGSUAN_PYTHON` 或 `conda run -n qingsuan-pdf`。网页开发版无法直接执行 Python，只能在页面中读取已由命令行生成的 CSV。

构建桌面安装包前，构建机需要安装一次 PyInstaller：

```bash
python3 -m pip install -r tool/requirements-build.txt
npm run package:desktop
```

解析器会按构建机 CPU 架构生成并放入安装包的 `Resources/parser`。macOS ARM 和 Intel 安装包应分别在对应架构的构建机或 CI runner 上构建。

下一阶段建议：

1. 增加 Developer ID 签名、Windows 签名和 macOS notarization。
2. 将 `localStorage` 迁移到 SQLite，并保留现有 JSON 导入导出格式。
3. 增加系统钥匙串加密、自动备份和可选 WebDAV/iCloud 同步。
4. 增加银行 CSV 映射、重复交易识别和周期性交易。

AI 分析建议继续采用“用户主动导出”的模式，避免在未明确知情的情况下把完整财务流水发送到第三方服务。
