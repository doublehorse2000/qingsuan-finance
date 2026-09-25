# 清算 · 个人财务管家

一个本地优先的个人财务管理 Web 应用，用于记录收入、支出、预算、账户和投资，并按月生成可视化复盘与 AI 分析数据包。

## 已实现

- 月度仪表盘：收入、支出、储蓄率、净资产、分类占比和六个月趋势
- 收支流水：新增、编辑、删除、按月或全部月份浏览、筛选、搜索和 CSV 导出
- 分类预算：预算进度、超支提醒和复制历史预算
- 账户与投资：资产/负债账户、投资成本、市值、收益和配置比例
- 月末快照：记录总资产和总负债，形成净资产历史
- AI 分析导出：默认导出聚合数据，可选附带流水，支持提示词、Markdown 和 JSON
- 数据管理：完整 JSON 备份、恢复、演示数据和空白初始化
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

首次打开未签名应用时，如果系统提示无法验证开发者，可在“系统设置 → 隐私与安全性”中选择“仍要打开”。

## 项目结构

```text
src/
  components/    通用弹窗
  lib/           财务计算、备份和 AI 导出
  views/         总览、流水、预算、资产、分析和设置
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

当前前端可以直接作为 Tauri 的 Web 资源。下一阶段建议：

1. 使用 Tauri 2 打包 macOS、Windows 和 Linux 应用。
2. 将 `localStorage` 迁移到 SQLite，并保留现有 JSON 导入导出格式。
3. 增加系统钥匙串加密、自动备份和可选 WebDAV/iCloud 同步。
4. 增加银行 CSV 映射、重复交易识别和周期性交易。

AI 分析建议继续采用“用户主动导出”的模式，避免在未明确知情的情况下把完整财务流水发送到第三方服务。
