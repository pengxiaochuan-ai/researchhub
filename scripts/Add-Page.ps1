[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$ArchivePath,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z0-9][a-z0-9-]*$')]
  [string]$PageId,

  [Parameter(Mandatory = $true)]
  [string]$Title,

  [string]$Screen = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = Split-Path -Parent $PSScriptRoot
$pagesRoot = Join-Path $projectRoot 'pages'
$destination = Join-Path $pagesRoot $PageId
$manifestPath = Join-Path $projectRoot 'platform-pages.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if (Test-Path -LiteralPath $destination) {
  throw "页面目录已存在，已停止以避免覆盖：$destination"
}
if ($manifest.pages.id -contains $PageId) {
  throw "页面清单中已存在 $PageId，已停止以避免重复接入。"
}

New-Item -ItemType Directory -Path $destination | Out-Null
$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ArchivePath))

try {
  $fileEntries = @($archive.Entries | Where-Object { -not [string]::IsNullOrEmpty($_.Name) })
  if ($fileEntries.Count -eq 0) {
    throw '压缩包中没有可提取的文件。'
  }

  $firstSegments = @(
    $fileEntries | ForEach-Object { ($_.FullName -replace '\\', '/').Split('/')[0] } | Select-Object -Unique
  )
  $stripPrefix = if ($firstSegments.Count -eq 1 -and $fileEntries[0].FullName.Contains('/')) {
    $firstSegments[0] + '/'
  } else {
    ''
  }

  $destinationRoot = [System.IO.Path]::GetFullPath($destination) + [System.IO.Path]::DirectorySeparatorChar
  foreach ($entry in $fileEntries) {
    $relativePath = ($entry.FullName -replace '\\', '/')
    if ($stripPrefix -and $relativePath.StartsWith($stripPrefix)) {
      $relativePath = $relativePath.Substring($stripPrefix.Length)
    }
    if ([string]::IsNullOrWhiteSpace($relativePath)) { continue }

    $outputPath = [System.IO.Path]::GetFullPath((Join-Path $destination $relativePath))
    if (-not $outputPath.StartsWith($destinationRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "压缩包包含越界路径，已停止：$relativePath"
    }

    $outputDirectory = Split-Path -Parent $outputPath
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    $inputStream = $entry.Open()
    $outputStream = [System.IO.File]::Create($outputPath)
    try {
      $inputStream.CopyTo($outputStream)
    } finally {
      $outputStream.Dispose()
      $inputStream.Dispose()
    }
  }
} finally {
  $archive.Dispose()
}

$indexPath = Join-Path $destination 'index.html'
if (-not (Test-Path -LiteralPath $indexPath)) {
  throw "页面缺少 index.html：$destination"
}

$indexContent = Get-Content -LiteralPath $indexPath -Raw
$indexContent = $indexContent.Replace('src="/src/main.jsx"', 'src="./src/main.jsx"')
$linkingScript = '<script type="module" src="../../src/page-linking.js"></script>'
if (-not $indexContent.Contains('../../src/page-linking.js')) {
  if ($indexContent.Contains('</body>')) {
    $indexContent = $indexContent.Replace('</body>', "$linkingScript</body>")
  } else {
    $indexContent += $linkingScript
  }
}
Set-Content -LiteralPath $indexPath -Value $indexContent -Encoding utf8NoBOM

$archiveFile = Get-Item -LiteralPath $ArchivePath
$hash = (Get-FileHash -LiteralPath $archiveFile.FullName -Algorithm SHA256).Hash
$manifest.pages += [pscustomobject]@{
  id = $PageId
  title = $Title
  route = "/pages/$PageId/"
  entry = "pages/$PageId/index.html"
  screen = $Screen
  sourceArchive = $archiveFile.Name
  sourceSha256 = $hash
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM

Write-Output "页面已独立接入：$PageId -> /pages/$PageId/"
Write-Output '下一步：在 src/platform-navigation.js 中补充入口映射，并只给原页面现有元素添加跳转。'
