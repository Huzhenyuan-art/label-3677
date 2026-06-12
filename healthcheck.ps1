param(
    [string]$BackendUrl = "http://localhost:8080",
    [string]$FrontendUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$pass = 0
$fail = 0

function Test-Endpoint($name, $url, $pattern) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        if ($pattern -and ($response.Content -notmatch $pattern)) {
            Write-Host "[FAIL] $name - response does not match pattern" -ForegroundColor Red
            $script:fail++
            return
        }
        Write-Host "[OK]   $name (HTTP $($response.StatusCode))" -ForegroundColor Green
        $script:pass++
    } catch {
        Write-Host "[FAIL] $name - $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Admin System - Health Inspection" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "--- Docker Containers ---" -ForegroundColor Yellow
docker compose ps 2>$null
Write-Host ""

Write-Host "--- Service Health Checks ---" -ForegroundColor Yellow
Test-Endpoint "MySQL" "$BackendUrl/actuator/health" ""
Start-Sleep -Milliseconds 200

$backendHealthUrl = "$BackendUrl/actuator/health"
try {
    $resp = Invoke-WebRequest -Uri $backendHealthUrl -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    $health = $resp.Content | ConvertFrom-Json
    if ($health.status -eq "UP") {
        Write-Host "[OK]   Backend Health (UP)" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "[FAIL] Backend Health ($($health.status))" -ForegroundColor Red
        $script:fail++
    }

    $components = $health.components
    if ($components.db) {
        $dbStatus = $components.db.status
        if ($dbStatus -eq "UP") {
            Write-Host "[OK]   MySQL Connection (UP)" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host "[FAIL] MySQL Connection ($dbStatus)" -ForegroundColor Red
            $script:fail++
        }
    }
    if ($components.redis) {
        $redisStatus = $components.redis.status
        if ($redisStatus -eq "UP") {
            Write-Host "[OK]   Redis Connection (UP)" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host "[FAIL] Redis Connection ($redisStatus)" -ForegroundColor Red
            $script:fail++
        }
    }
} catch {
    Write-Host "[FAIL] Backend Health - $($_.Exception.Message)" -ForegroundColor Red
    $script:fail++
}

Test-Endpoint "Frontend" "$FrontendUrl/login.html" ""
Test-Endpoint "Swagger UI" "$BackendUrl/swagger-ui.html" ""
Test-Endpoint "Spring Boot Admin" "$BackendUrl/admin" ""

Write-Host ""
Write-Host "--- API Functional Checks ---" -ForegroundColor Yellow

try {
    $loginResp = Invoke-RestMethod -Uri "$BackendUrl/api/auth/login" -Method Post -ContentType "application/json" -Body '{"username":"admin","password":"123456"}' -ErrorAction Stop
    if ($loginResp.code -eq 0 -and $loginResp.data.token) {
        Write-Host "[OK]   Login API (token received)" -ForegroundColor Green
        $script:pass++
        $token = $loginResp.data.token
    } else {
        Write-Host "[FAIL] Login API (unexpected response)" -ForegroundColor Red
        $script:fail++
        $token = $null
    }
} catch {
    Write-Host "[FAIL] Login API - $($_.Exception.Message)" -ForegroundColor Red
    $script:fail++
    $token = $null
}

if ($token) {
    $headers = @{ Authorization = "Bearer $token" }

    try {
        $dashResp = Invoke-RestMethod -Uri "$BackendUrl/api/dashboard/overview" -Headers $headers -ErrorAction Stop
        if ($dashResp.code -eq 0) {
            Write-Host "[OK]   Dashboard API (data received)" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host "[FAIL] Dashboard API (code=$($dashResp.code))" -ForegroundColor Red
            $script:fail++
        }
    } catch {
        Write-Host "[FAIL] Dashboard API - $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
    }

    try {
        $menuResp = Invoke-RestMethod -Uri "$BackendUrl/api/menus/tree" -Headers $headers -ErrorAction Stop
        if ($menuResp.code -eq 0) {
            Write-Host "[OK]   Menu API (data received)" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host "[FAIL] Menu API (code=$($menuResp.code))" -ForegroundColor Red
            $script:fail++
        }
    } catch {
        Write-Host "[FAIL] Menu API - $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
    }

    try {
        $userResp = Invoke-RestMethod -Uri "$BackendUrl/api/users/page?page=1&size=5" -Headers $headers -ErrorAction Stop
        if ($userResp.code -eq 0) {
            Write-Host "[OK]   Users API (data received)" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host "[FAIL] Users API (code=$($userResp.code))" -ForegroundColor Red
            $script:fail++
        }
    } catch {
        Write-Host "[FAIL] Users API - $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Results: $pass passed, $fail failed" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($fail -gt 0) {
    exit 1
}
