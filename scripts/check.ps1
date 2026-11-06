# Acceptance check. Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check.ps1
# Prints a short summary; full output goes to .check.log. Exit 1 on failure.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$log = Join-Path $root '.check.log'
Set-Content -Path $log -Value "check $(Get-Date -Format s)" -Encoding UTF8
$failed = @()
$steps = 0

function Step($name, $cmdline) {
  $script:steps++
  Add-Content -Path $log -Value "`n=== $name ===" -Encoding UTF8
  Push-Location $root
  try { cmd /c "$cmdline >> `"$log`" 2>&1" } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { Write-Output "FAIL $name"; $script:failed += $name }
  else { Write-Output "ok   $name" }
}

Step 'typecheck' 'npm run typecheck'
Step 'test' 'npm test'
Step 'build' 'npm run build'

if (-not $steps) { Write-Output 'FAIL: no check steps yet; add real ones to scripts/check.ps1'; exit 1 }

if ($failed.Count) { Write-Output "FAIL: $($failed -join ', ')"; exit 1 }
Write-Output 'OK'
exit 0
