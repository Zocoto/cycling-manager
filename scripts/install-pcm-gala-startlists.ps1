param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('World-Tour', 'Continental')]
    [string]$Programme,
    [Parameter(Mandatory = $true)]
    [string]$BasePcm,
    [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$sourceRoot = Join-Path $PSScriptRoot 'Startlists'
$audit = Get-Content -LiteralPath (Join-Path $sourceRoot 'audit.json') -Raw | ConvertFrom-Json
$database = Get-Item -LiteralPath $BasePcm
if ($database.Name -ne 'OfficialRelease.cdb' -or
    (Get-FileHash -LiteralPath $database.FullName -Algorithm SHA256).Hash -ne $audit.databaseSha256) {
    throw 'Choisissez le fichier OfficialRelease.cdb correspondant a ces startlists.'
}

$programmes = @{
    'World-Tour' = @('top_tdf.xml', 'topclas_maastricht.xml', 'topclas_roubaix.xml')
    'Continental' = @('top_tdf.xml', 'topclas_maastricht.xml', 'c0_classiquedunkerque.xml')
}
$sources = foreach ($name in $programmes[$Programme]) {
    $event = @($audit.events | Where-Object { $_.file -ceq ($Programme + '/' + $name) })
    if ($event.Count -ne 1) { throw ('Controle absent pour ' + $name) }
    $source = Join-Path (Join-Path $sourceRoot $Programme) $name
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $event[0].sha256) {
        throw ('Startlist modifiee ou incomplete : ' + $name)
    }
    [pscustomobject]@{ Name = $name; Path = $source; Hash = $event[0].sha256 }
}
if ($VerifyOnly) { Write-Output ('Base et trois startlists verifiees : ' + $Programme); return }

$cloudRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Pro Cycling Manager 2026\Cloud'))
$destination = Join-Path $cloudRoot 'Startlists'
$suffix = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$backup = Join-Path (Join-Path $cloudRoot 'Cyclostratege-Startlist-Backups') $suffix
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$existing = @(Get-ChildItem -LiteralPath $destination -File | Where-Object {
    $_.Name -match '^(top_tdf|topclas_maastricht|topclas_roubaix|c0_classiquedunkerque|c0_schelde)( \(\d+\))?\.xml$'
})

# Sauvegarde hors de Startlists pour que PCM ne trouve aucune ancienne composition.
$backedUp = @()
$copied = @()
try {
    if ($existing.Count) {
        New-Item -ItemType Directory -Path $backup -Force | Out-Null
        foreach ($file in $existing) {
            Move-Item -LiteralPath $file.FullName -Destination (Join-Path $backup $file.Name)
            $backedUp += $file.Name
        }
    }
    foreach ($source in $sources) {
        $target = Join-Path $destination $source.Name
        $copied += $target
        Copy-Item -LiteralPath $source.Path -Destination $target
        if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $source.Hash) {
            throw ('Copie incomplete : ' + $source.Name)
        }
    }
} catch {
    foreach ($target in $copied) {
        if (Test-Path -LiteralPath $target -PathType Leaf) { Remove-Item -LiteralPath $target }
    }
    foreach ($name in $backedUp) {
        Move-Item -LiteralPath (Join-Path $backup $name) -Destination (Join-Path $destination $name)
    }
    throw
}

Write-Output ('Trois startlists installees dans ' + $destination)
if ($backedUp.Count) { Write-Output ('Anciennes startlists sauvegardees dans ' + $backup) }
Write-Output ('Relancez PCM26 et selectionnez ' + $audit.title)
