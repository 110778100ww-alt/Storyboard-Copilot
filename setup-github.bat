@echo off
setlocal enabledelayedexpansion

echo ========================================
echo GitHub仓库设置和macOS构建脚本
echo ========================================
echo.

:: 检查是否在正确的目录
if not exist "package.json" (
    echo 错误：请在项目根目录运行此脚本
    pause
    exit /b 1
)

:: 初始化Git仓库
echo [1/5] 初始化Git仓库...
git init
if errorlevel 1 (
    echo Git初始化失败，请确保已安装Git
    pause
    exit /b 1
)

:: 添加所有文件
echo [2/5] 添加文件到Git...
git add .

:: 提交更改
echo [3/5] 提交更改...
git commit -m "Initial commit with macOS signing support"

:: 显示下一步操作说明
echo.
echo ========================================
echo 下一步操作：
echo ========================================
echo.
echo 1. 请在GitHub上创建新仓库：https://github.com/new
echo 2. 复制仓库URL，然后运行以下命令：
echo.
echo    git remote add origin [您的仓库URL]
echo    git branch -M main
echo    git push -u origin main
echo.
echo 3. 推送完成后，运行以下命令构建macOS版本：
echo.
echo    git tag v0.1.14
echo    git push origin v0.1.14
echo.
echo 4. 或者在GitHub页面手动触发Actions工作流
echo.
echo ========================================
echo.
echo 是否现在打开GitHub创建页面？ (Y/N)
set /p openGithub=

if /i "%openGithub%"=="Y" (
    start https://github.com/new
)

echo.
echo 按任意键退出...
pause > nul