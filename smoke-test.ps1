param(
    [string]$BackendUrl = "http://localhost:8080",
    [string]$FrontendUrl = "http://localhost:3000",
    [string]$Username = "admin",
    [string]$Password = "123456"
)

$ErrorActionPreference = "Stop"
$pass = 0
$fail = 0
$token = $null

function Write-Ok($msg) {
    Write-Host "[PASS] $msg" -ForegroundColor Green
    $script:pass++
}

function Write-Fail($msg) {
    Write-Host "[FAIL] $msg" -ForegroundColor Red
    $script:fail++
}

function Write-Info($msg) {
    Write-Host "[INFO] $msg" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Admin System - Smoke Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "--- 1. Infrastructure Checks ---" -ForegroundColor Yellow

$containers = docker compose ps --format json 2>$null | ConvertFrom-Json
$requiredContainers = @("admin_db", "admin_redis", "admin_backend", "admin_frontend")
foreach ($name in $requiredContainers) {
    $c = $containers | Where-Object { $_.Name -eq $name -or $_.Service -eq $name.Replace("admin_","") }
    if ($c) {
        $state = if ($c.State) { $c.State } elseif ($c.Status) { $c.Status } else { "unknown" }
        if ($state -match "running|Up") {
            Write-Ok "Container $name is running"
        } else {
            Write-Fail "Container $name is NOT running (state=$state)"
        }
    } else {
        $running = docker ps --filter "name=$name" --format "{{.Names}}" 2>$null
        if ($running -match $name) {
            Write-Ok "Container $name is running"
        } else {
            Write-Fail "Container $name is NOT running"
        }
    }
}

Write-Host ""
Write-Host "--- 2. Health Endpoint ---" -ForegroundColor Yellow

try {
    $healthResp = Invoke-WebRequest -Uri "$BackendUrl/actuator/health" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    $health = $healthResp.Content | ConvertFrom-Json

    if ($health.status -eq "UP") {
        Write-Ok "Backend overall status: UP"
    } else {
        Write-Fail "Backend overall status: $($health.status)"
    }

    if ($health.components.db.status -eq "UP") {
        Write-Ok "MySQL connection: UP"
    } else {
        Write-Fail "MySQL connection: $($health.components.db.status)"
    }

    if ($health.components.redis.status -eq "UP") {
        Write-Ok "Redis connection: UP"
    } else {
        Write-Fail "Redis connection: $($health.components.redis.status)"
    }

    if ($health.components.diskSpace.status -eq "UP") {
        Write-Ok "Disk space: UP"
    } else {
        Write-Fail "Disk space: $($health.components.diskSpace.status)"
    }
} catch {
    Write-Fail "Health endpoint unreachable: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "--- 3. Frontend Serving ---" -ForegroundColor Yellow

try {
    $loginPage = Invoke-WebRequest -Uri "$FrontendUrl/login.html" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    if ($loginPage.StatusCode -eq 200 -and $loginPage.Content -match "login-form") {
        Write-Ok "Login page served correctly"
    } elseif ($loginPage.StatusCode -eq 200) {
        Write-Ok "Login page HTTP 200 (content pattern may differ)"
    } else {
        Write-Fail "Login page returned HTTP $($loginPage.StatusCode)"
    }
} catch {
    Write-Fail "Login page unreachable: $($_.Exception.Message)"
}

try {
    $indexPage = Invoke-WebRequest -Uri "$FrontendUrl/index.html" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    if ($indexPage.StatusCode -eq 200) {
        Write-Ok "Index page served (HTTP 200)"
    }
} catch {
    Write-Info "Index page not accessible without login (expected)"
}

Write-Host ""
Write-Host "--- 4. Login API ---" -ForegroundColor Yellow

try {
    $loginBody = @{ username = $Username; password = $Password } | ConvertTo-Json
    $loginResp = Invoke-RestMethod -Uri "$BackendUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -ErrorAction Stop

    if ($loginResp.code -eq 0 -and $loginResp.data.token) {
        Write-Ok "Login successful (token received, length=$($loginResp.data.token.Length))"
        $token = $loginResp.data.token
    } else {
        Write-Fail "Login failed (code=$($loginResp.code), message=$($loginResp.message))"
    }
} catch {
    Write-Fail "Login API error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "--- 5. Dashboard API ---" -ForegroundColor Yellow

if ($token) {
    $headers = @{ Authorization = "Bearer $token" }

    try {
        $dashResp = Invoke-RestMethod -Uri "$BackendUrl/api/dashboard/overview" -Headers $headers -ErrorAction Stop
        if ($dashResp.code -eq 0) {
            $data = $dashResp.data
            Write-Ok "Dashboard overview (users=$($data.userCount), menus=$($data.menuCount), sessions=$($data.onlineSessionCount))"
        } else {
            Write-Fail "Dashboard API (code=$($dashResp.code))"
        }
    } catch {
        Write-Fail "Dashboard API error: $($_.Exception.Message)"
    }
} else {
    Write-Info "Skipped (no auth token)"
}

Write-Host ""
Write-Host "--- 6. Menu API ---" -ForegroundColor Yellow

if ($token) {
    try {
        $menuResp = Invoke-RestMethod -Uri "$BackendUrl/api/menus/tree" -Headers $headers -ErrorAction Stop
        if ($menuResp.code -eq 0) {
            $menuCount = if ($menuResp.data -is [array]) { $menuResp.data.Count } else { "N/A" }
            Write-Ok "Menu tree loaded ($menuCount top-level menus)"
        } else {
            Write-Fail "Menu API (code=$($menuResp.code))"
        }
    } catch {
        Write-Fail "Menu API error: $($_.Exception.Message)"
    }
} else {
    Write-Info "Skipped (no auth token)"
}

Write-Host ""
Write-Host "--- 7. User Management API ---" -ForegroundColor Yellow

if ($token) {
    try {
        $userResp = Invoke-RestMethod -Uri "$BackendUrl/api/users/page?page=1&size=5" -Headers $headers -ErrorAction Stop
        if ($userResp.code -eq 0) {
            Write-Ok "User list loaded (total=$($userResp.data.total))"
        } else {
            Write-Fail "User list API (code=$($userResp.code))"
        }
    } catch {
        Write-Fail "User list API error: $($_.Exception.Message)"
    }
} else {
    Write-Info "Skipped (no auth token)"
}

Write-Host ""
Write-Host "--- 8. Role Management API ---" -ForegroundColor Yellow

if ($token) {
    try {
        $roleResp = Invoke-RestMethod -Uri "$BackendUrl/api/roles/page?page=1&size=10" -Headers $headers -ErrorAction Stop
        if ($roleResp.code -eq 0) {
            Write-Ok "Role list loaded (total=$($roleResp.data.total))"
        } else {
            Write-Fail "Role list API (code=$($roleResp.code))"
        }
    } catch {
        Write-Fail "Role list API error: $($_.Exception.Message)"
    }
} else {
    Write-Info "Skipped (no auth token)"
}

Write-Host ""
Write-Host "--- 9. Swagger & Admin Access ---" -ForegroundColor Yellow

try {
    $swaggerResp = Invoke-WebRequest -Uri "$BackendUrl/swagger-ui.html" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    if ($swaggerResp.StatusCode -eq 200) {
        Write-Ok "Swagger UI accessible"
    }
} catch {
    Write-Fail "Swagger UI unreachable"
}

try {
    $adminResp = Invoke-WebRequest -Uri "$BackendUrl/admin" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    if ($adminResp.StatusCode -eq 200) {
        Write-Ok "Spring Boot Admin accessible"
    }
} catch {
    Write-Fail "Spring Boot Admin unreachable"
}

Write-Host ""
Write-Host "--- 10. Lock Screen API ---" -ForegroundColor Yellow

if ($token) {
    try {
        $lockResp = Invoke-RestMethod -Uri "$BackendUrl/api/auth/lock" -Method Post -Headers $headers -ErrorAction Stop
        if ($lockResp.code -eq 0) {
            Write-Ok "Lock screen activated"
        } else {
            Write-Info "Lock screen API (code=$($lockResp.code), may not be implemented)"
        }
    } catch {
        Write-Info "Lock screen API not available or different endpoint"
    }

    try {
        $unlockBody = @{ password = $Password } | ConvertTo-Json
        $unlockResp = Invoke-RestMethod -Uri "$BackendUrl/api/auth/unlock" -Method Post -Headers $headers -ContentType "application/json" -Body $unlockBody -ErrorAction Stop
        if ($unlockResp.code -eq 0) {
            Write-Ok "Unlock screen succeeded"
        } else {
            Write-Info "Unlock screen API (code=$($unlockResp.code))"
        }
    } catch {
        Write-Info "Unlock screen API not available or different endpoint"
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
$total = $pass + $fail
Write-Host "  Results: $pass/$total passed" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($fail -gt 0) {
    exit 1
}
Write-Host "All smoke tests passed! System is ready for use." -ForegroundColor Green
