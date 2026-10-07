# Diz se o build de producao do site (apps/web/.next-prod) esta desatualizado.
# Saida 0 = build em dia; 1 = precisa refazer (nao existe ou algum arquivo do
# site mudou depois dele). Usado pelo "Abrir Kactus.bat" no modo /inicio.
$web = Join-Path $PSScriptRoot '..\apps\web'
$buildId = Join-Path $web '.next-prod\BUILD_ID'
if (-not (Test-Path $buildId)) { exit 1 }
$feito = (Get-Item $buildId).LastWriteTime

$pastas = 'app', 'components', 'lib', 'public' | ForEach-Object { Join-Path $web $_ } | Where-Object { Test-Path $_ }
$mudou = Get-ChildItem $pastas -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -gt $feito } | Select-Object -First 1
$configMudou = Get-ChildItem $web -File |
    Where-Object { $_.Name -match '^(next\.config|tailwind\.config|postcss\.config|package\.json|tsconfig\.json|\.env)' -and $_.LastWriteTime -gt $feito } |
    Select-Object -First 1

if ($mudou -or $configMudou) { exit 1 }
exit 0
