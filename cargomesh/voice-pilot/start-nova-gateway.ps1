param(
  [string]$Origin = 'http://localhost:3218',
  [int]$Port = 8765
)
$envFile = Join-Path $PSScriptRoot '..\.env.local'
if (-not (Test-Path -LiteralPath $envFile)) { throw 'Create cargomesh/.env.local with the local voice configuration first.' }
$secretLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^CARGOMESH_VOICE_BRIDGE_SECRET=' } | Select-Object -Last 1
if (-not $secretLine) { throw 'CARGOMESH_VOICE_BRIDGE_SECRET is missing from cargomesh/.env.local.' }
$env:CARGOMESH_VOICE_BRIDGE_SECRET = $secretLine.Substring($secretLine.IndexOf('=') + 1)
if ($env:CARGOMESH_VOICE_BRIDGE_SECRET.Length -lt 32) { throw 'Voice bridge secret is too short.' }
try {
  & (Join-Path $PSScriptRoot '.venv\Scripts\python.exe') (Join-Path $PSScriptRoot 'nova_voice_gateway.py') --origin $Origin --port $Port --profile cargomesh-bedrock
} finally {
  Remove-Item Env:CARGOMESH_VOICE_BRIDGE_SECRET -ErrorAction SilentlyContinue
}
