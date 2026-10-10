param([int]$Port=8080,[switch]$OpenBrowser,[ValidateSet('entrance','dashboard','carrier')][string]$View='entrance')
$ErrorActionPreference='Stop'
$appRoot=Join-Path $PSScriptRoot 'cargomesh'
$viewPath=switch($View){'dashboard'{'/v2-workspace#/dashboard'} 'carrier'{'/carrier-portal'} default{'/'}}
$url="http://127.0.0.1:$Port$viewPath"
$nodeCommand=Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath=if($nodeCommand){$nodeCommand.Source}else{Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'}
if(!(Test-Path -LiteralPath $nodePath)){throw 'Instala Node.js 22 o superior para iniciar CargoMesh V2.'}
$nextPath=Join-Path $appRoot 'node_modules\next\dist\bin\next'
if(!(Test-Path -LiteralPath $nextPath)){throw 'Faltan las dependencias locales de cargomesh. Sigue el README local antes de iniciar.'}
function Test-CargoMesh {
 try{$response=Invoke-WebRequest -Uri $url -TimeoutSec 3 -UseBasicParsing;return $response.StatusCode -eq 200 -and $response.Content -match 'CargoMesh'}catch{return $false}
}
if(!(Test-CargoMesh)){
 if(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue){throw "El puerto $Port lo ocupa otro servicio. No se detuvo ningún proceso."}
 $logRoot=Join-Path $env:LOCALAPPDATA 'CargoMeshV2Local'
 New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
 $mode=if(Test-Path -LiteralPath (Join-Path $appRoot '.next\BUILD_ID')){'start'}else{'dev'}
 $arguments='"'+$nextPath+'" '+$mode+' --hostname 127.0.0.1 --port '+$Port
 $process=Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'stdout.log') -RedirectStandardError (Join-Path $logRoot 'stderr.log')
 [IO.File]::WriteAllText((Join-Path $logRoot 'process.json'),(@{pid=$process.Id;port=$Port;project=$PSScriptRoot;mode=$mode}|ConvertTo-Json))
 $ready=$false
 for($attempt=0;$attempt -lt 40;$attempt++){if(Test-CargoMesh){$ready=$true;break};Start-Sleep -Milliseconds 500}
 if(!$ready){throw "El servidor no respondió. Revisa los logs en $logRoot. No se abrió una página vacía."}
}
Write-Output "CargoMesh V2 disponible: $url"
if($OpenBrowser){Start-Process $url}
