@echo off
:: Start UniversalPOS Server on port 5001
:: Run this from the project root

cd /d "%~dp0backend"
set POS_PORT=5001
set JWT_SECRET=pos_secret_key_dev
set NODE_ENV=development

echo Starting UniversalPOS server on port 5001...
echo Press Ctrl+C to stop

node server.js
