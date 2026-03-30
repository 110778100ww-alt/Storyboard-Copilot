# 设置GitHub仓库并构建macOS版本指南

## 步骤1：初始化Git仓库

打开终端或命令行，进入项目目录：

```bash
cd "E:\分镜助手\Storyboard-Copilot-main"
```

初始化Git仓库：

```bash
git init
git add .
git commit -m "Initial commit"
```

## 步骤2：创建GitHub仓库

1. 登录 GitHub (https://github.com)
2. 点击右上角 "+" 按钮，选择 "New repository"
3. 填写仓库信息：
   - Repository name: `Storyboard-Copilot` (或您喜欢的名称)
   - 选择 Public 或 Private
   - **不要**勾选 "Add a README file"
   - **不要**勾选 "Add .gitignore"
4. 点击 "Create repository"

## 步骤3：连接GitHub仓库

复制GitHub仓库的HTTPS URL，然后运行：

```bash
# 将下面的URL替换为您的GitHub仓库URL
git remote add origin https://github.com/您的用户名/Storyboard-Copilot.git
git branch -M main
git push -u origin main
```

## 步骤4：构建macOS版本

有两种方式触发GitHub Actions工作流：

### 方式A：推送标签触发（推荐）

```bash
# 创建标签（版本号格式为 v*，例如 v0.1.14）
git tag v0.1.14
git push origin v0.1.14
```

### 方式B：手动触发

1. 访问您的GitHub仓库页面
2. 点击 "Actions" 选项卡
3. 选择 "Build Storyboard-Copilot" 工作流
4. 点击 "Run workflow"
5. 在 "Release tag" 输入框中输入版本号（例如：`v0.1.14`）
6. 点击 "Run workflow" 按钮

## 步骤5：配置代码签名（可选，但推荐）

如果不配置代码签名，macOS应用将无法在其他Mac上正常运行。

### 需要配置的GitHub Secrets：

1. `APPLE_CERTIFICATE` - .p12证书的base64编码
2. `APPLE_CERTIFICATE_PASSWORD` - 证书密码
3. `APPLE_TEAM_ID` - Apple开发者团队ID
4. `APPLE_ID` - Apple ID邮箱
5. `APPLE_PASSWORD` - App-specific password

详细配置方法请参考 `docs/macos-signing-guide.md`

## 步骤6：下载构建产物

构建完成后：

1. 访问GitHub仓库的 "Actions" 选项卡
2. 点击最新的构建
3. 在 "Artifacts" 部分下载：
   - `windows-installer` - Windows安装程序
   - `macos-dmg` - macOS DMG安装包
   - `macos-app` - macOS应用包

## 常见问题

### Q: 如何更新版本号？
A: 在 `package.json` 和 `src-tauri/tauri.conf.json` 中修改 `version` 字段

### Q: 构建失败怎么办？
A: 查看GitHub Actions的构建日志，检查错误信息

### Q: 如何添加代码签名？
A: 参考 `docs/macos-signing-guide.md` 文档

### Q: 支持哪些平台？
A: 
- Windows: x64 (NSIS安装程序)
- macOS: Universal Binary (支持Intel和Apple Silicon)