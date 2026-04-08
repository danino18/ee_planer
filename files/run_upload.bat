@echo off
echo.
echo ============================================
echo   Pinecone Upload - ECE Technion
echo ============================================
echo.
set PINECONE_API_KEY=pcsk_7A2auo_GK7Br7suohjBAucJC4SgsoKxiEqXDNgVtoMqasymWhnGuRnv72FNagr1oYAY6DS
cd /d "%~dp0"
echo Installing pinecone...
pip install pinecone -q
echo.
echo Starting upload...
python upload_to_pinecone.py
echo.
pause
