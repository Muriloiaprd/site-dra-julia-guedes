# Relógio Garmin ligado no USB como "dispositivo" (MTP): Forerunner, Fenix, Venu...
# Esses relógios não ganham letra de unidade; só o Shell do Windows enxerga a pasta
# GARMIN\Activity. Os que aparecem como pendrive (letra de unidade) o Python lê direto.
#
#   relogio.ps1                         lista os arquivos de treino (JSON)
#   relogio.ps1 -Destino C:\x -Nomes a,b   copia esses arquivos para C:\x
param(
    [string]$Destino = "",
    [string[]]$Nomes = @()
)
$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Achar-Pasta($pasta, $nome) {
    if (-not $pasta) { return $null }
    foreach ($i in $pasta.Items()) {
        if ($i.IsFolder -and $i.Name -ieq $nome) { return $i.GetFolder }
    }
    return $null
}

$shell = New-Object -ComObject Shell.Application
$pc = $shell.NameSpace(17)  # Este Computador
$achados = @()
$copiados = 0

foreach ($dev in $pc.Items()) {
    if ($dev.IsFileSystem) { continue }  # unidade com letra: o Python lê direto
    $raiz = $dev.GetFolder
    if (-not $raiz) { continue }
    # o relógio tem um armazenamento ("Internal Storage", "Primary"...) com GARMIN\Activity
    foreach ($arm in $raiz.Items()) {
        if (-not $arm.IsFolder) { continue }
        $activity = Achar-Pasta (Achar-Pasta $arm.GetFolder "GARMIN") "Activity"
        if (-not $activity) { continue }
        foreach ($f in $activity.Items()) {
            if ($f.IsFolder) { continue }
            if ($Destino -ne "") {
                if ($Nomes -contains $f.Name) {
                    $alvo = $shell.NameSpace($Destino)
                    # 4 sem janela de progresso, 16 sim para tudo, 1024 sem erro na tela
                    $alvo.CopyHere($f, 4 + 16 + 1024)
                    $copiados++
                }
            } else {
                $achados += [pscustomobject]@{ dispositivo = $dev.Name; nome = $f.Name; tamanho = $f.Size }
            }
        }
    }
}

if ($Destino -ne "") {
    # CopyHere volta antes de terminar: espera os arquivos aparecerem (até 2 min)
    $limite = (Get-Date).AddMinutes(2)
    while ((Get-Date) -lt $limite) {
        $prontos = @(Get-ChildItem -LiteralPath $Destino -File).Count
        if ($prontos -ge $copiados) { break }
        Start-Sleep -Milliseconds 500
    }
    Write-Output (ConvertTo-Json @{ copiados = $copiados } -Compress)
} else {
    Write-Output (ConvertTo-Json @($achados) -Compress)
}
