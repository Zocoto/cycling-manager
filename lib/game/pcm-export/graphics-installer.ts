/** Immutable graphic payload shared by the compatible Steam Workshop release. */
export const PCM_GRAPHICS_FILES = [
  { name: "PCMAssets_cyclostratege-local_P.pak", sha256: "8922cbb2b3f53fd342b3093934402953f35baf14d6c3ba85d1984ac9462fd393" },
  { name: "PCMAssets_cyclostratege-local_Add_P.pak", sha256: "7380442905c30a8074f6ea669874c140d75e66c241db24c73e8c1828dab9024b" },
  { name: "PCMAssets_cyclostratege-local_Flags_P.pak", sha256: "2bac9caeeaca95eb8c51ef160da8699be05eab5539a078669bf4583d8ad78cf2" },
  { name: "PCMAssets_cyclostratege-gala-s4-20261102-r1_Add_P.pak", sha256: "df1ad7ffaee2feccd8e160ea23e3bf6efa43c08c3ba38c743d65e23f92655ec9" },
] as const;

export function createPcmGraphicsInstaller(): string {
  return String.raw`# Copie uniquement les quatre fichiers graphiques Steam a cote de cette base.
param([string]$SteamLibrary, [switch]$VerifyOnly)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'OfficialRelease.cdb') -PathType Leaf) -or
    -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'mod.xml') -PathType Leaf)) {
  throw 'Placez cet outil dans le dossier de la base exportee (OfficialRelease.cdb et mod.xml).'
}
$expected = '${JSON.stringify(PCM_GRAPHICS_FILES)}' | ConvertFrom-Json
$libraries = [System.Collections.Generic.List[string]]::new()
if ($SteamLibrary) { $libraries.Add([IO.Path]::GetFullPath($SteamLibrary)) }
foreach ($entry in @(
  @{Path='HKCU:\Software\Valve\Steam';Name='SteamPath'},
  @{Path='HKLM:\SOFTWARE\WOW6432Node\Valve\Steam';Name='InstallPath'},
  @{Path='HKLM:\SOFTWARE\Valve\Steam';Name='InstallPath'}
)) {
  try { $value = Get-ItemPropertyValue -LiteralPath $entry.Path -Name $entry.Name -ErrorAction Stop }
  catch { continue }
  if ($value -and (Test-Path -LiteralPath $value -PathType Container)) { $libraries.Add([string]$value) }
}
$programFiles = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
if ($programFiles) {
  $defaultSteam = Join-Path $programFiles 'Steam'
  if (Test-Path -LiteralPath $defaultSteam -PathType Container) { $libraries.Add($defaultSteam) }
}
foreach ($steam in @($libraries.ToArray() | Select-Object -Unique)) {
  $config = Join-Path $steam 'steamapps\libraryfolders.vdf'
  if (Test-Path -LiteralPath $config -PathType Leaf) {
    $text = [IO.File]::ReadAllText($config)
    foreach ($match in [regex]::Matches($text, '"path"\s+"([^"]+)"') | Select-Object -First 64) {
      $libraries.Add($match.Groups[1].Value.Replace('\\','\'))
    }
  }
}
$source = $null
foreach ($library in @($libraries.ToArray() | Select-Object -Unique | Select-Object -First 64)) {
  $candidate = Join-Path $library 'steamapps\workshop\content\3936530\3811779261'
  $complete = $true
  foreach ($file in $expected) {
    if (-not (Test-Path -LiteralPath (Join-Path $candidate $file.name) -PathType Leaf)) { $complete = $false; break }
  }
  if ($complete) { $source = $candidate; break }
}
if (-not $source) {
  throw 'Pack introuvable : abonnez-vous au Workshop Cyclostratege 3811779261 et attendez la fin du telechargement Steam.'
}
# Verifier tout le lot avant la premiere copie : ne jamais installer un melange de versions.
foreach ($file in $expected) {
  $actual = (Get-FileHash -LiteralPath (Join-Path $source $file.name) -Algorithm SHA256).Hash
  if ($actual -ne $file.sha256) { throw ('Version graphique incompatible : '+$file.name+'. Mettez le Workshop a jour dans Steam.') }
}
if ($VerifyOnly) { Write-Output 'Les quatre fichiers graphiques Steam sont compatibles.'; return }
$backup = $null
foreach ($file in $expected) {
  $target = Join-Path $PSScriptRoot $file.name
  if (Test-Path -LiteralPath $target -PathType Leaf) {
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -eq $file.sha256) { continue }
    if (-not $backup) {
      $backup = Join-Path $PSScriptRoot ('Sauvegarde-graphismes-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8))
      New-Item -ItemType Directory -Path $backup | Out-Null
    }
    Copy-Item -LiteralPath $target -Destination (Join-Path $backup $file.name)
  }
  Copy-Item -LiteralPath (Join-Path $source $file.name) -Destination $target -Force
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $file.sha256) { throw ('Copie graphique incomplete : '+$file.name) }
}
Write-Output 'Les quatre PAK sont installes dans le dossier de cette base. Relancez PCM et selectionnez cette base.'
`;
}
