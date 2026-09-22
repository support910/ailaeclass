param([ValidateRange(1024, 65535)][int]$Port = 5173)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dashboard = Join-Path $root 'apps\dashboard'
if (-not (Test-Path -LiteralPath (Join-Path $dashboard 'build\index.js'))) {
    throw 'Build the API and dashboard before starting this preview.'
}
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    throw "Port $Port is already occupied. Stop the verified old preview or choose another port."
}
$node = (Get-Command node -ErrorAction Stop).Source
$logs = Join-Path (Split-Path $root -Parent) '.tmp\flight-clean-preview'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$env:PORT = "$Port"
$env:HOST = '127.0.0.1'
$env:ORIGIN = "http://127.0.0.1:$Port"
$env:BODY_SIZE_LIMIT = '10485760'
$process = Start-Process -FilePath $node -ArgumentList '--env-file=.env','--env-file=.env.local','build/index.js' -WorkingDirectory $dashboard -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs "preview-$Port.log") -RedirectStandardError (Join-Path $logs "preview-$Port-error.log") -PassThru
[pscustomobject]@{ ProcessId = $process.Id; Url = "http://127.0.0.1:$Port/login?redirect=/lms/simulator"; Workspace = $root }
