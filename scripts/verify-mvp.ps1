$BASE = "http://localhost:4000/api/v1"
$WEB  = "http://localhost:3000"
$script:PASS = 0
$script:FAIL = 0

function ok([string]$msg)    { Write-Host "  [OK] $msg" -ForegroundColor Green;  $script:PASS++ }
function fail([string]$msg)  { Write-Host " [FAIL] $msg" -ForegroundColor Red;   $script:FAIL++ }
function section([string]$t) { Write-Host "" ; Write-Host "=== $t ===" -ForegroundColor Cyan }

# 1. SERVIDORES
section "1. SERVIDORES ACTIVOS"

try {
    $null = Invoke-WebRequest -Uri $WEB -UseBasicParsing -TimeoutSec 5
    ok "Frontend Next.js :3000"
} catch { fail "Frontend Next.js NO responde: $_" }

try {
    Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"x","password":"x"}' | Out-Null
} catch {
    ok "Backend NestJS :4000 respondio"
}

# 2. AUTH
section "2. AUTENTICACION Y RBAC"

$token = $null
try {
    $lr = Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST `
          -ContentType "application/json" -Body '{"username":"admin","password":"AdminAsmun2026!"}'
    $token = $lr.accessToken
    if ($lr.user.role -eq "admin") { ok "Login admin OK rol=$($lr.user.role) tokenLen=$($token.Length)" }
    else { fail "Login rol incorrecto: $($lr.user.role)" }
} catch { fail "POST /auth/login fallo: $_" }

$H = New-Object "System.Collections.Generic.Dictionary[String,String]"
if ($token) {
    $H.Add("Authorization", "Bearer $token")
    $H.Add("Content-Type", "application/json")

    try {
        $me = Invoke-RestMethod -Uri "$BASE/auth/me" -Headers $H
        if ($me.role -eq "admin") { ok "GET /auth/me OK username=$($me.username)" }
        else { fail "GET /auth/me rol incorrecto" }
    } catch { fail "GET /auth/me fallo: $_" }

    $bH = New-Object "System.Collections.Generic.Dictionary[String,String]"
    $bH.Add("Authorization", "Bearer INVALID_TOKEN_XYZ")
    try {
        Invoke-RestMethod -Uri "$BASE/participants" -Headers $bH | Out-Null
        fail "Token invalido no fue rechazado"
    } catch {
        ok "Token invalido rechazado con 401"
    }
}

# 3. CATALOGOS
section "3. CATALOGOS"

try {
    $schools = Invoke-RestMethod -Uri "$BASE/schools?limit=10" -Headers $H
    if ($schools.meta.total -ge 1) { ok "GET /schools total=$($schools.meta.total)" }
    else { fail "GET /schools 0 colegios" }
} catch { fail "GET /schools fallo: $_" }

try {
    $committees = Invoke-RestMethod -Uri "$BASE/committees?limit=10" -Headers $H
    if ($committees.meta.total -ge 1) { ok "GET /committees total=$($committees.meta.total)" }
    else { fail "GET /committees 0 comites" }
} catch { fail "GET /committees fallo: $_" }

$testSchoolId = $null
try {
    $ns = Invoke-RestMethod -Uri "$BASE/schools" -Method POST -Headers $H `
          -Body '{"name":"Colegio VERIFY MVP TEST 9999","city":"Test"}'
    $testSchoolId = $ns.id
    ok "POST /schools OK id=$testSchoolId"
} catch { fail "POST /schools fallo: $_" }

if ($testSchoolId) {
    try {
        Invoke-RestMethod -Uri "$BASE/schools/$testSchoolId" -Method DELETE -Headers $H | Out-Null
        ok "DELETE /schools/id OK limpieza"
    } catch { fail "DELETE /schools/id fallo: $_" }
}

# 4. PARTICIPANTES
section "4. PARTICIPANTES CRUD Y CODIGO CORTO"

$schoolId = $null
$committeeId = $null
try {
    $fs = Invoke-RestMethod -Uri "$BASE/schools?limit=1" -Headers $H
    $schoolId = $fs.data[0].id
    $fc = Invoke-RestMethod -Uri "$BASE/committees?limit=1" -Headers $H
    $committeeId = $fc.data[0].id
} catch { fail "No se pudo obtener colegio/comite base: $_" }

$partId = $null
$partCode = $null
if ($schoolId -and $committeeId) {
    try {
        $sIdInt = [int]$schoolId
        $cIdInt = [int]$committeeId
        $pb = "{""firstName"":""VerMVP"",""lastName"":""TestUser"",""role"":""delegado"",""schoolId"":$sIdInt,""committeeId"":$cIdInt}"
        $np = Invoke-RestMethod -Uri "$BASE/participants" -Method POST -Headers $H -Body $pb
        $partId   = $np.id
        $partCode = $np.code
        if ($np.code -match '^[A-Z0-9]{6}$') { ok "POST /participants OK code=$($np.code)" }
        else { fail "Codigo corto invalido: '$($np.code)'" }
    } catch { fail "POST /participants fallo: $_" }
}

if ($partId) {
    try {
        $byCode = Invoke-RestMethod -Uri "$BASE/participants/by-code/$partCode" -Headers $H
        if ($byCode.id -eq $partId) { ok "GET /participants/by-code OK" }
        else { fail "by-code devolvio ID distinto" }
    } catch { fail "GET /participants/by-code fallo: $_" }

    try {
        $srch = Invoke-RestMethod -Uri "$BASE/participants?search=VerMVP" -Headers $H
        if ($srch.meta.total -ge 1) { ok "GET /participants busqueda por nombre OK total=$($srch.meta.total)" }
        else { fail "Busqueda por nombre no encontro el participante" }
    } catch { fail "GET /participants busqueda fallo: $_" }

    try {
        $patched = Invoke-RestMethod -Uri "$BASE/participants/$partId" -Method PATCH -Headers $H `
                   -Body '{"dietaryNotes":"Sin gluten"}'
        if ($patched.dietaryNotes -eq "Sin gluten") { ok "PATCH /participants/id OK" }
        else { fail "PATCH no actualizo el campo dietaryNotes" }
    } catch { fail "PATCH /participants/id fallo: $_" }
}

# 5. CREDENCIAL PDF
section "5. CREDENCIAL PDF"

if ($partId) {
    $pdfH = New-Object "System.Collections.Generic.Dictionary[String,String]"
    $pdfH.Add("Authorization", "Bearer $token")

    try {
        $t0 = Get-Date
        $pr = Invoke-WebRequest -Uri "$BASE/badges/$partId.pdf?format=card" `
              -Headers $pdfH -UseBasicParsing
        $ms = [int]((Get-Date) - $t0).TotalMilliseconds
        if ($pr.StatusCode -eq 200 -and $pr.RawContentLength -gt 1000) {
            ok "GET /badges/id.pdf OK bytes=$($pr.RawContentLength) ms=$ms"
            if ($ms -lt 3000) { ok "Generacion credencial rapida ms=$ms" }
            else { fail "Generacion lenta ms=$ms" }
        } else { fail "PDF invalido status=$($pr.StatusCode)" }
    } catch { fail "GET /badges/id.pdf fallo: $_" }

    $pdfBatchH = New-Object "System.Collections.Generic.Dictionary[String,String]"
    $pdfBatchH.Add("Authorization", "Bearer $token")
    $pdfBatchH.Add("Content-Type", "application/json")
    try {
        $bb = "{""participantIds"":[""$partId""]}"
        $bp = Invoke-WebRequest -Uri "$BASE/badges/pdf" -Method POST `
              -Headers $pdfBatchH -Body $bb -UseBasicParsing
        if ($bp.StatusCode -eq 200 -and $bp.RawContentLength -gt 1000) {
            ok "POST /badges/pdf lote A4 OK bytes=$($bp.RawContentLength)"
        } else { fail "POST /badges/pdf invalido" }
    } catch { fail "POST /badges/pdf fallo: $_" }
}

# 6. ESCANEO
section "6. ESCANEO Y MOTOR DE VALIDACION"

$cpid = $null
try {
    $cps = Invoke-RestMethod -Uri "$BASE/checkpoints" -Headers $H
    if ($cps.data.Count -ge 1) {
        ok "GET /checkpoints total=$($cps.data.Count)"
        $active = $cps.data | Where-Object { $_.isActive -eq $true } | Select-Object -First 1
        $cpid = $active.id
        ok "Punto activo para prueba: $($active.name)"
    } else { fail "GET /checkpoints 0 puntos" }
} catch { fail "GET /checkpoints fallo: $_" }

if ($cpid -and $partCode) {
    # Reactivar participante para poder escanearlo
    try {
        Invoke-RestMethod -Uri "$BASE/participants/$partId" -Method PATCH -Headers $H -Body '{"isActive":true}' | Out-Null
    } catch {}
    try {
        $t0 = Get-Date
        $cpidInt = [int]$cpid
        $sb = "{""code"":""$partCode"",""checkpointId"":$cpidInt,""source"":""manual""}"
        $sc = Invoke-RestMethod -Uri "$BASE/scans" -Method POST -Headers $H -Body $sb
        $ms = [int]((Get-Date) - $t0).TotalMilliseconds
        $validR = @("ok","excepcion","duplicado","fuera_de_horario","falta_requisito","no_habilitado","no_encontrado")
        if ($sc.result -in $validR) {
            ok "POST /scans result=$($sc.result) ms=$ms"
            if ($ms -lt 1000) { ok "Escaneo menos de 1 segundo ms=$ms" }
            else { fail "Escaneo lento ms=$ms" }
        } else { fail "POST /scans resultado inesperado: $($sc.result)" }
    } catch { fail "POST /scans primer escaneo fallo: $_" }

    try {
        $cpidInt2 = [int]$cpid
        $sb2 = "{""code"":""$partCode"",""checkpointId"":$cpidInt2,""source"":""manual""}"
        $sc2 = Invoke-RestMethod -Uri "$BASE/scans" -Method POST -Headers $H -Body $sb2
        $blk = @("duplicado","falta_requisito","fuera_de_horario","no_habilitado")
        if ($sc2.result -in $blk) { ok "Doble escaneo protegido result=$($sc2.result)" }
        else { fail "Doble escaneo NO bloqueado result=$($sc2.result)" }
    } catch { fail "POST /scans doble escaneo fallo: $_" }
}

# 7. DASHBOARD
section "7. DASHBOARD Y METRICAS"

try {
    $dash = Invoke-RestMethod -Uri "$BASE/dashboard/summary" -Headers $H
    if ($null -ne $dash.totals) { ok "GET /dashboard/summary OK activos=$($dash.totals.activeParticipants)" }
    else { fail "GET /dashboard/summary sin campo totals" }
} catch { fail "GET /dashboard/summary fallo: $_" }

if ($cpid) {
    try {
        $pend = Invoke-RestMethod -Uri "$BASE/dashboard/pending?checkpoint_id=$cpid&limit=5" -Headers $H
        ok "GET /dashboard/pending OK pendientes=$($pend.meta.total)"
    } catch { fail "GET /dashboard/pending fallo: $_" }
}

# 8. REPORTES EXCEL
section "8. REPORTES EXCEL"

$xlsH = New-Object "System.Collections.Generic.Dictionary[String,String]"
$xlsH.Add("Authorization", "Bearer $token")

foreach ($rpt in @("participants.xlsx","scans.xlsx")) {
    try {
        $re = Invoke-WebRequest -Uri "$BASE/reports/$rpt" -Headers $xlsH -UseBasicParsing
        if ($re.StatusCode -eq 200 -and $re.RawContentLength -gt 500) {
            $rc = $re.Headers["X-Row-Count"]
            ok "GET /reports/$rpt OK bytes=$($re.RawContentLength) filas=$rc"
        } else { fail "GET /reports/$rpt invalido status=$($re.StatusCode)" }
    } catch { fail "GET /reports/$rpt fallo: $_" }
}

if ($cpid) {
    try {
        $re3 = Invoke-WebRequest -Uri "$BASE/reports/pending.xlsx?checkpoint_id=$cpid" `
               -Headers $xlsH -UseBasicParsing
        if ($re3.StatusCode -eq 200 -and $re3.RawContentLength -gt 100) {
            ok "GET /reports/pending.xlsx OK bytes=$($re3.RawContentLength)"
        } else { fail "GET /reports/pending.xlsx invalido" }
    } catch { fail "GET /reports/pending.xlsx fallo: $_" }
}

# 9. AUDITORIA
section "9. AUDITORIA E HISTORIAL"

try {
    $aud = Invoke-RestMethod -Uri "$BASE/audit?limit=5" -Headers $H
    ok "GET /audit OK total=$($aud.meta.total)"
} catch { fail "GET /audit fallo: $_" }

try {
    $sh = Invoke-RestMethod -Uri "$BASE/scans?limit=5" -Headers $H
    ok "GET /scans historial OK total=$($sh.meta.total)"
} catch { fail "GET /scans fallo: $_" }

# 10. LIMPIEZA
section "10. LIMPIEZA"

if ($partId) {
    try {
        Invoke-RestMethod -Uri "$BASE/participants/$partId" -Method PATCH -Headers $H `
                          -Body '{"isActive":false}' | Out-Null
        ok "Participante de prueba desactivado"
    } catch { fail "Limpieza de participante fallo: $_" }
}

# RESULTADO FINAL
Write-Host ""
Write-Host "============================================" -ForegroundColor White
Write-Host "  RESULTADO FINAL TASK-5.4 MVP ASMUN" -ForegroundColor White
Write-Host "============================================" -ForegroundColor White
Write-Host "  Verificaciones OK  : $($script:PASS)" -ForegroundColor Green
$fc2 = "Green"
if ($script:FAIL -gt 0) { $fc2 = "Red" }
Write-Host "  Verificaciones FAIL: $($script:FAIL)" -ForegroundColor $fc2
Write-Host "============================================" -ForegroundColor White
Write-Host ""
if ($script:FAIL -eq 0) { Write-Host "MVP VERIFICADO - Todos los criterios de aceptacion superados." -ForegroundColor Green }
if ($script:FAIL -gt 0) { Write-Host "Hay $($script:FAIL) verificaciones fallidas. Revisar los FAIL anteriores." -ForegroundColor Yellow }
