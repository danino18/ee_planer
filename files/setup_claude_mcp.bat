@echo off
echo.
echo ============================================
echo   Claude MCP Setup - Technion ECE
echo ============================================
echo.

set CONFIG_DIR=%APPDATA%\Claude
set CONFIG_FILE=%CONFIG_DIR%\claude_desktop_config.json

:: יצירת תיקייה אם לא קיימת
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

:: גיבוי קובץ קיים
if exist "%CONFIG_FILE%" (
    echo מגבה קובץ קיים...
    copy "%CONFIG_FILE%" "%CONFIG_FILE%.backup" >nul
    echo גיבוי נשמר ב: %CONFIG_FILE%.backup
)

:: כתיבת הconfig החדש
echo כותב קובץ config...
(
echo {
echo   "mcpServers": {
echo     "technion-ece": {
echo       "command": "python",
echo       "args": ["C:/Users/eyald/OneDrive - Technion/planer_ee/files/mcp_server.py"],
echo       "env": {
echo         "PINECONE_API_KEY": "pcsk_7A2auo_GK7Br7suohjBAucJC4SgsoKxiEqXDNgVtoMqasymWhnGuRnv72FNagr1oYAY6DS"
echo       }
echo     }
echo   }
echo }
) > "%CONFIG_FILE%"

echo.
echo ✅ הושלם! הקובץ נכתב ל:
echo    %CONFIG_FILE%
echo.
echo ⚠️  עכשיו סגור ופתח את Claude מחדש!
echo.
pause
