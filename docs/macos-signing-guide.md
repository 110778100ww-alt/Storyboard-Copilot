# macOS 代码签名配置指南

## 前提条件

1. **Apple Developer Program 会员资格**
   - 需要每年 $99 的 Apple Developer Program 会员资格
   - 访问 [Apple Developer](https://developer.apple.com) 注册

2. **创建开发者证书**
   - 登录 [Apple Developer Portal](https://developer.apple.com/account)
   - 进入 Certificates, Identifiers & Profiles
   - 创建 "Developer ID Application" 证书
   - 下载证书并安装到钥匙串
   - 从钥匙串导出为 .p12 格式（需要设置密码）

## 配置 GitHub Secrets

在 GitHub 仓库页面，进入 Settings > Secrets and variables > Actions，添加以下 Secrets：

### 1. APPLE_CERTIFICATE
- 将 .p12 证书文件转换为 base64：
  ```bash
  base64 -i certificate.p12 | pbcopy
  ```
- 将输出的 base64 字符串粘贴到 GitHub Secrets

### 2. APPLE_CERTIFICATE_PASSWORD
- 导出 .p12 文件时设置的密码

### 3. APPLE_TEAM_ID
- 在 [Apple Developer Portal](https://developer.apple.com/account) 查找
- 通常在 Membership 页面显示为 "Team ID"

### 4. APPLE_ID
- 用于登录 App Store Connect 的 Apple ID 邮箱

### 5. APPLE_PASSWORD
- 如果启用了双重认证，需要创建 App-specific password：
  1. 登录 [Apple ID 管理页面](https://appleid.apple.com)
  2. 进入 "App-Specific Passwords"
  3. 生成新的 App-specific password

## 工作流程

### 自动构建和签名

1. **推送标签触发构建**：
   ```bash
   git tag v0.1.14
   git push origin v0.1.14
   ```

2. **手动触发构建**：
   - 在 GitHub 仓库页面点击 "Actions"
   - 选择 "Build Storyboard-Copilot" 工作流
   - 点击 "Run workflow"
   - 输入版本号（如 `v0.1.14`）

### 构建流程

1. Windows 构建：生成 NSIS 安装程序
2. macOS 构建：
   - 构建 Universal Binary（支持 Intel 和 Apple Silicon）
   - 代码签名（使用 Developer ID 证书）
   - 公证（Notarization）
   - 创建 DMG 安装包

## 验证签名

构建完成后，可以通过以下方式验证：

1. 在 macOS 上运行：
   ```bash
   spctl -a -v /Applications/分镜助手.app
   ```
   应该显示：`accepted`

2. 检查签名信息：
   ```bash
   codesign -dv --verbose=4 /Applications/分镜助手.app
   ```

## 故障排除

### 常见问题

1. **证书过期**：
   - 确保证书在有效期内
   - 重新导出证书并更新 GitHub Secrets

2. **公证失败**：
   - 检查 Apple ID 和密码是否正确
   - 确保 App-specific password 有效
   - 检查 Team ID 是否正确

3. **签名失败**：
   - 确保证书已正确导入钥匙串
   - 检查证书密码是否正确

## 注意事项

1. 首次公证可能需要几个小时
2. 公证后应用可以在任何 Mac 上运行
3. 如果不进行公证，用户需要在系统设置中手动允许运行
4. 建议在发布前完成公证流程