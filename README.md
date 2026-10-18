# 发票夹

基于 Electron、Vue 3、TypeScript 和 electron-vite 的本地发票管理应用。发票图片、识别文本和手动校正后的信息都保存在当前设备的 Electron 用户数据目录中。

## 开发

需要 Node.js 24 或更高版本。

```sh
npm install
npm run dev
```

首次使用 OCR 时，RapidOCRNode 会将识别模型下载到本机数据目录；模型就绪后，图片识别在本机 CPU 上运行。发票图片不会上传到云端。首次准备模型需要网络连接。

## 界面组件

渲染端使用 shadcn-vue 的本地组件模式和 Tailwind CSS v4。组件按需保存在 `src/renderer/src/components/ui`，通过 `@/components/ui/...` 导入，并在 `components.json` 中维护组件生成配置。组件源码属于本项目，可直接按发票夹的视觉和交互需求调整。

## 功能

- 导入 JPG、PNG、WEBP、BMP、TIFF 发票图片，并保留本地原图。
- 使用 RapidOCRNode 识别发票文字、日期、号码、销售方和金额。
- 手动修正字段、设置类别和备注，归档或筛选待核对发票。
- 预览或删除本地图片，导出 CSV 发票清单。
- 发票字段保存在 `userData/receipt-fold/invoices.sqlite`，主进程通过 alex8088 的 `sqlite3-queries` 管理查询和 schema migrations；图片仍以原文件保存在同目录的 `invoices` 文件夹。首次启动会将旧版 `invoices.json` 导入 SQLite 并保留原文件作为迁移备份。升级应用不会覆盖本地发票数据。

## 品牌图标

应用图标源文件为 `src/renderer/src/assets/receipt-fold-logo.svg`，使用同一图形生成渲染器品牌标记、macOS `.icns`、Windows `.ico` 和 Linux `.png`。

```sh
npm run icons
```

在 macOS 上运行此命令可生成全部平台图标。

## 构建

```sh
npm run build
npm run build:mac
npm run build:win
npm run build:linux
```

electron-vite 负责主进程、预加载脚本和渲染器构建，electron-builder 负责安装包并重建 `sqlite3` 原生依赖。RapidOCRNode 的 ONNX Runtime 和 Sharp 运行时作为本地依赖随应用打包。macOS 使用 DMG 和 ZIP，Windows 使用 NSIS，Linux 使用 AppImage 和 DEB。

## 版本、发布与更新

1. 更新 `CHANGELOG.md` 并提交这些改动，保持工作区干净。
2. 运行 `npm run release:patch`、`npm run release:minor` 或 `npm run release:major` 更新版本并创建 Git tag。
3. 推送版本提交与 tag：`git push origin main --follow-tags`。
4. GitHub Actions 会在 macOS、Windows、Linux 上构建安装包，并上传到对应的 GitHub 草稿发行版。
5. 检查草稿发行版中的安装包和自动更新清单，确认后在 GitHub Releases 页面发布。
6. 已安装的正式版会在启动时检查 GitHub Releases；新版本在后台下载完成后，用户可点击顶部的“重启安装”完成升级。

自动更新源配置在 `electron-builder.yml`，项目发布到 `OSpoon/ReceiptFold` 的 GitHub Releases。正式 tag 格式为 `v主版本.次版本.补丁版本`，且必须与 `package.json` 版本一致。

### GitHub Actions Secrets

首次发布前，在仓库的 Settings → Secrets and variables → Actions 中配置：

- `MAC_CSC_LINK`、`MAC_CSC_KEY_PASSWORD`：Base64 编码的 Developer ID Application `.p12` 证书和密码，用于签名 macOS 应用。
- `APPLE_API_KEY_BASE64`、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER`：App Store Connect API `.p8` 密钥（Base64）、Key ID 和 Issuer ID，用于 macOS 公证。
- `WIN_CSC_LINK`、`WIN_CSC_KEY_PASSWORD`：可选的 Base64 编码 Windows `.pfx` 代码签名证书和密码。

仓库内不会保存签名密钥。没有 Apple 签名与公证凭据时，macOS 正式发布 job 会停止；未签名的 macOS 包不适合作为可自动更新的正式版本。

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE)。
