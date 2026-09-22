$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dashboard = Join-Path $root 'apps\dashboard'
if (Get-NetTCPConnection -State Listen -LocalPort 5190 -ErrorAction SilentlyContinue) { throw 'Port 5190 is already occupied; no process was stopped.' }
$runtime = Join-Path (Split-Path $root -Parent) '.tmp\simulator-drive-qa\node_modules\@electric-sql\pglite\dist\index.js'
if (-not (Test-Path -LiteralPath $runtime)) { throw 'Install the isolated PGlite QA runtime first. Do not point this preview at Supabase.' }
$env:SIMULATOR_QA_PGLITE = ([uri]$runtime).AbsoluteUri
$logs = Join-Path (Split-Path $root -Parent) '.tmp\flight-sharing-preview'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$node = (Get-Command node -ErrorAction Stop).Source
$process = Start-Process -FilePath $node -ArgumentList 'tests/flight-sharing-preview.mjs' -WorkingDirectory $dashboard -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'preview.log') -RedirectStandardError (Join-Path $logs 'preview-error.log') -PassThru
[pscustomobject]@{ ProcessId = $process.Id; Url = 'http://127.0.0.1:5190'; Mode = 'Isolated PostgreSQL; fixture accounts; no production writes' }
