# 发布流程

1. 更新 `CHANGELOG.md`，写清楚本次面向使用者的变化，并检查当前版本号。
2. 选择版本递增方式运行 `npm run release:patch`、`npm run release:minor` 或 `npm run release:major`。也可以运行 `npm run release` 后交互选择。
3. `bumpp` 更新 `package.json` 和 `package-lock.json`，提交版本变更、创建 `vX.Y.Z` 标签并推送。推送标签后，GitHub Actions 会运行 lint、类型检查和生产构建，再为 macOS、Windows、Linux 制作安装包。
4. Actions 会创建 GitHub 草稿发行版，用 `changelogithub` 根据 Conventional Commits 生成发行说明，并上传安装包。检查发行说明、平台和架构对应的安装包后，再手动发布草稿。

macOS 安装包未使用 Apple Developer ID 签名且未公证，因此无需配置 Apple 证书密钥；首次启动可能需要用户在 macOS“隐私与安全性”设置中手动允许。未签名的 macOS 版本不支持应用内更新，后续版本需从 GitHub Releases 手动下载。Windows 保留应用内更新。
