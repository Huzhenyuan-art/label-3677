param(
    [ValidateSet("dev","test","prod")]
    [string]$Env = "dev",
    [switch]$Build,
    [switch]$Reset,
    [switch]$SkipHealthCheck
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

function Write-Step($msg) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-Ok($msg) {
    Write-Host "[OK] $msg" -ForegroundColor Green
}

function Write-Fail($msg) {
    Write-Host "[FAIL] $msg" -ForegroundColor Red
}

function Write-Info($msg) {
    Write-Host "[INFO] $msg" -ForegroundColor Yellow
}

Write-Step "Admin System - One-Click Startup (env=$Env)"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Fail "Docker is not installed or not in PATH"
    exit 1
}

$dockerRunning = $null
try {
    $dockerRunning = docker info 2>&1
} catch {}

if ($LASTEXITCODE -ne 0) {
    Write-Fail "Docker Desktop is not running. Please start it first."
    exit 1
}
Write-Ok "Docker is running"

$envFile = Join-Path $ProjectRoot ".env.$Env"
if (-not (Test-Path $envFile)) {
    Write-Fail "Environment file not found: $envFile"
    exit 1
}
Write-Ok "Found environment file: .env.$Env"

$targetEnv = Join-Path $ProjectRoot ".env"
Copy-Item $envFile $targetEnv -Force
Write-Ok "Copied .env.$Env -> .env"

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

if ($Reset) {
    Write-Step "Resetting data volumes"
    docker compose down -v 2>$null
    Write-Ok "Volumes removed"
}

$buildArg = ""
if ($Build) {
    $buildArg = "--build"
    Write-Step "Building Docker images"
}

Write-Step "Starting services"
$composeCmd = "docker compose up -d $buildArg"
Invoke-Expression $composeCmd
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Failed to start services"
    docker compose logs
    exit 1
}
Write-Ok "Docker Compose services started"

if ($SkipHealthCheck) {
    Write-Info "Health check skipped"
    Write-Step "Startup Complete"
    Write-Host ""
    Write-Host "Frontend:   http://localhost:$env:FRONTEND_PORT" -ForegroundColor White
    Write-Host "Backend:    http://localhost:$env:BACKEND_PORT" -ForegroundColor White
    Write-Host "Swagger:    http://localhost:$env:BACKEND_PORT/swagger-ui.html" -ForegroundColor White
    exit 0
}

Write-Step "Waiting for MySQL (port $env:MYSQL_PORT)"
$maxWait = 120
$elapsed = 0
while ($elapsed -lt $maxWait) {
    try {
        $result = docker exec admin_db mysqladmin ping -h localhost -uroot -p"$env:MYSQL_ROOT_PASSWORD" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "MySQL is ready"
            break
        }
    } catch {}
    Start-Sleep -Seconds 3
    $elapsed += 3
    Write-Info "Waiting for MySQL... ($elapsed/${maxWait}s)"
}
if ($elapsed -ge $maxWait) {
    Write-Fail "MySQL did not become ready in time"
    docker compose logs db
    exit 1
}

Write-Step "Waiting for Redis (port $env:REDIS_PORT)"
$elapsed = 0
while ($elapsed -lt 60) {
    try {
        $result = docker exec admin_redis redis-cli ping 2>$null
        if ($result -match "PONG") {
            Write-Ok "Redis is ready"
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
    $elapsed += 2
    Write-Info "Waiting for Redis... ($elapsed/60s)"
}
if ($elapsed -ge 60) {
    Write-Fail "Redis did not become ready in time"
    docker compose logs redis
    exit 1
}

Write-Step "Waiting for Backend (health check)"
$elapsed = 0
$backendUrl = "http://localhost:$env:BACKEND_PORT/actuator/health"
while ($elapsed -lt 180) {
    try {
        $response = Invoke-WebRequest -Uri $backendUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($response.Content -match '"status"\s*:\s*"UP"') {
            Write-Ok "Backend is healthy"
            break
        }
    } catch {}
    Start-Sleep -Seconds 5
    $elapsed += 5
    Write-Info "Waiting for backend... ($elapsed/180s)"
}
if ($elapsed -ge 180) {
    Write-Fail "Backend did not become healthy in time"
    docker compose logs backend
    exit 1
}

Write-Step "Waiting for Frontend"
$elapsed = 0
$frontendUrl = "http://localhost:$env:FRONTEND_PORT/login.html"
while ($elapsed -lt 60) {
    try {
        $response = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Ok "Frontend is serving pages"
            break
        }
    } catch {}
    Start-Sleep -Seconds 3
    $elapsed += 3
    Write-Info "Waiting for frontend... ($elapsed/60s)"
}
if ($elapsed -ge 60) {
    Write-Fail "Frontend did not become ready in time"
    docker compose logs frontend
    exit 1
}

Write-Step "Startup Complete - All Services Healthy"
Write-Host ""
Write-Host "  Frontend:    http://localhost:$env:FRONTEND_PORT" -ForegroundColor White
Write-Host "  Login Page:  http://localhost:$env:FRONTEND_PORT/login.html" -ForegroundColor White
Write-Host "  Backend API: http://localhost:$env:BACKEND_PORT/api" -ForegroundColor White
Write-Host "  Swagger:     http://localhost:$env:BACKEND_PORT/swagger-ui.html" -ForegroundColor White
Write-Host "  Admin:       http://localhost:$env:BACKEND_PORT/admin" -ForegroundColor White
Write-Host "  MySQL:       localhost:$env:MYSQL_PORT (root/$env:MYSQL_ROOT_PASSWORD)" -ForegroundColor White
Write-Host "  Redis:       localhost:$env:REDIS_PORT" -ForegroundColor White
Write-Host ""
Write-Host "  Test Account: admin / 123456" -ForegroundColor Green
Write-Host ""
