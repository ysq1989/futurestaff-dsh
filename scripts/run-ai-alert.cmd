@echo off
setlocal
cd /d "%~dp0\.."
if not exist ".dsh" mkdir ".dsh"
node --import=./scripts/load-env.mjs scripts/quota-alert.mjs >> ".dsh\ai-alert.log" 2>&1
