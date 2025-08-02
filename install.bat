@echo off
REM 帕金森輔助裝置系統安裝腳本 (Windows)

echo ===============================================
echo 帕金森輔助裝置系統安裝程序
echo ===============================================
echo.

REM 檢查Python是否安裝
python --version >nul 2>&1
if errorlevel 1 (
    echo 錯誤: 未找到Python，請先安裝Python 3.8+
    echo 下載地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo 檢測到Python版本:
python --version
echo.

REM 檢查pip是否可用
pip --version >nul 2>&1
if errorlevel 1 (
    echo 錯誤: pip未安裝或不可用
    pause
    exit /b 1
)

echo 更新pip...
python -m pip install --upgrade pip
echo.

echo 安裝Python依賴包...
pip install -r requirements.txt
if errorlevel 1 (
    echo 錯誤: 依賴包安裝失敗
    pause
    exit /b 1
)
echo.

echo 安裝系統包...
pip install -e .
if errorlevel 1 (
    echo 錯誤: 系統包安裝失敗
    pause
    exit /b 1
)
echo.

echo 創建必要目錄...
if not exist "data" mkdir data
if not exist "models" mkdir models
if not exist "logs" mkdir logs
echo.

echo ===============================================
echo 安裝完成！
echo ===============================================
echo.
echo 接下來的步驟:
echo 1. 連接Arduino設備
echo 2. 上傳Arduino代碼 (arduino/main/complete_parkinson_device.ino)
echo 3. 運行: python python/deployment/system_integration.py
echo.
echo 更多信息請參考: docs/user_manual.md
echo.
pause