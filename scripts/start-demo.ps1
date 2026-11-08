param(
    [ValidateSet('ReadOnly', 'Practice')][string]$Mode = 'ReadOnly',
    [switch]$NoPrompt
)
$ErrorActionPreference = 'Stop'
$mavenCommand = Get-Command mvn.cmd -ErrorAction SilentlyContinue
if (-not $mavenCommand) { $mavenCommand = Get-Command mvn -ErrorAction SilentlyContinue }
if (-not (Get-Command java -ErrorAction SilentlyContinue) -or -not $mavenCommand) {
    throw 'Install Java 21 and Maven 3.9+, add them to PATH, then open a new PowerShell window.'
}
$createdPassword = $false
if (-not $env:DEMO_PASSWORD -and $Mode -eq 'Practice') {
    if ($NoPrompt) { throw 'Set DEMO_PASSWORD in this process before using -NoPrompt.' }
    $securePassword = Read-Host 'Choose a private demo password (12-72 characters)' -AsSecureString
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try { $env:DEMO_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
    $createdPassword = $true
}
if ($env:DEMO_PASSWORD -and ($env:DEMO_PASSWORD.Length -lt 12 -or $env:DEMO_PASSWORD.Length -gt 72)) {
    if ($createdPassword) { Remove-Item Env:DEMO_PASSWORD }
    throw 'The demo password must contain 12 to 72 characters.'
}
$profileName = if ($Mode -eq 'Practice') { 'demo-local' } else { 'demo' }
Write-Host "Starting Qayem ($Mode) at http://localhost:5020. Use the Try the demo button in ReadOnly mode, or your private demo password in Practice mode."
Push-Location (Join-Path (Split-Path -Parent $PSScriptRoot) 'backend-java')
try {
    & $mavenCommand.Source '-B' 'spring-boot:run' "-Dspring-boot.run.profiles=$profileName"
    if ($LASTEXITCODE -ne 0) { throw 'Backend startup failed. Review the preceding Maven output.' }
}
finally {
    Pop-Location
    if ($createdPassword) { Remove-Item Env:DEMO_PASSWORD -ErrorAction SilentlyContinue }
}
