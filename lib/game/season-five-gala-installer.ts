/** Generated into the S5 archive; never runs during website deployment. */
export function createSeasonFiveGalaStartlistInstaller() {
  return `param(
  [Parameter(Mandatory = $true)][string]$Course,
  [int]$Groupe = 1,
  [switch]$VerifyOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$packageRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$manifestPath = Join-Path $packageRoot 'Startlists/manifest.json'
$audit = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$database = Join-Path $packageRoot 'OfficialRelease.cdb'
if ($audit.galaEdition -cne 'season-five' -or $audit.sourceSeason -ne 5 -or $audit.identitySeason -ne 6 -or
    (Get-FileHash -LiteralPath $database -Algorithm SHA256).Hash.ToLowerInvariant() -cne $audit.databaseSha256) {
  throw 'La base et les startlists S5 ne correspondent pas.'
}
$event = @($audit.events | Where-Object { $_.eventKey -ceq $Course -and $_.groupNumber -eq $Groupe })
if ($event.Count -ne 1) { throw 'Choisissez une course et un groupe presents dans Startlists/manifest.json.' }
$entry = $event[0]
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $packageRoot 'Startlists'))
$source = [IO.Path]::GetFullPath((Join-Path $sourceRoot $entry.file))
if (-not $source.StartsWith($sourceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
    [IO.Path]::GetExtension($source) -cne '.xml') { throw 'Chemin de startlist invalide.' }
if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) {
  throw 'La startlist a ete modifiee depuis la generation du package.'
}
if ($VerifyOnly) { Write-Output ('Base et startlist S5 verifiees : ' + $Course + ' / groupe ' + $Groupe); return }
$cloudRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Pro Cycling Manager 2026/Cloud'))
$destinationRoot = [IO.Path]::GetFullPath((Join-Path $cloudRoot 'Startlists'))
$filename = [IO.Path]::GetFileName($source)
$destination = [IO.Path]::GetFullPath((Join-Path $destinationRoot $filename))
if (-not $destination.StartsWith($destinationRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Destination de startlist invalide.'
}
New-Item -ItemType Directory -Path $destinationRoot -Force | Out-Null
$backup = Join-Path (Join-Path $cloudRoot 'Cyclostratege-Startlist-Backups') ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N'))
$existing = @(Get-ChildItem -LiteralPath $destinationRoot -File | Where-Object {
  $_.BaseName -match ('^' + [Regex]::Escape([IO.Path]::GetFileNameWithoutExtension($filename)) + '( \(\d+\))?$') -and $_.Extension -ieq '.xml'
})
foreach ($previous in $existing) {
  $resolved = [IO.Path]::GetFullPath($previous.FullName)
  if (-not $resolved.StartsWith($destinationRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Ancienne startlist hors du dossier prevu.' }
}
$moved = @()
$copyStarted = $false
try {
  if ($existing.Count) { New-Item -ItemType Directory -Path $backup -Force | Out-Null }
  foreach ($previous in $existing) {
    Move-Item -LiteralPath $previous.FullName -Destination (Join-Path $backup $previous.Name)
    $moved += $previous.Name
  }
  $copyStarted = $true
  Copy-Item -LiteralPath $source -Destination $destination
  if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) { throw 'Copie incomplete de la startlist.' }
} catch {
  if ($copyStarted -and (Test-Path -LiteralPath $destination -PathType Leaf)) { Remove-Item -LiteralPath $destination }
  foreach ($previous in $moved) { Move-Item -LiteralPath (Join-Path $backup $previous) -Destination (Join-Path $destinationRoot $previous) }
  throw
}
Write-Output ('Startlist S5 installee : ' + $Course + ' / groupe ' + $Groupe + '. Un seul groupe de cette course est actif.')
`;
}
