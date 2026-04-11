$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [string]$Label,
    [string]$Command,
    [string[]]$Arguments
  )

  Write-Host ""
  Write-Host "==> Running $Label"
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

Invoke-Step -Label "lint" -Command "npm.cmd" -Arguments @("run", "lint")
Invoke-Step -Label "typecheck" -Command "npm.cmd" -Arguments @("run", "typecheck")
Invoke-Step -Label "tests" -Command "npm.cmd" -Arguments @("run", "test")
Invoke-Step -Label "sync general requirements" -Command "node" -Arguments @("scripts/sync-general-requirements.mjs")
Invoke-Step -Label "build" -Command ".\\node_modules\\.bin\\vite.cmd" -Arguments @("build")
Invoke-Step -Label "bundle analysis" -Command "npm.cmd" -Arguments @("run", "analyze:bundle")
Invoke-Step -Label "functions build" -Command "npm.cmd" -Arguments @("run", "build:functions")
Invoke-Step -Label "functions lint" -Command "npm.cmd" -Arguments @("run", "lint:functions")
