$base = "http://localhost:4000/api/v1"
$lr = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"AdminAsmun2026!"}'
$token = $lr.accessToken
$H = New-Object "System.Collections.Generic.Dictionary[String,String]"
$H.Add("Authorization", "Bearer $token")
$H.Add("Content-Type", "application/json")

# Obtener el participante de prueba
$srch = Invoke-RestMethod -Uri "$base/participants?search=VerMVP&isActive=false" -Headers $H
$p = $srch.data[0]
$partId = $p.id
$code = $p.code
Write-Host "partId=$partId code=$code"

# Probar by-code con el code correcto
Write-Host "=== by-code/$code ==="
try {
    $bc = Invoke-RestMethod -Uri "$base/participants/by-code/$code" -Headers $H
    Write-Host "by-code OK id=$($bc.id)"
} catch { Write-Host "by-code fallo: $_" }

# Probar scan con el code
Write-Host "=== GET checkpoints ==="
$cps = Invoke-RestMethod -Uri "$base/checkpoints" -Headers $H
$cp = $cps.data | Where-Object { $_.isActive -eq $true } | Select-Object -First 1
Write-Host "checkpoint: $($cp.name) id=$($cp.id)"

Write-Host "=== POST scans ==="
$cpid = $cp.id
$sb = "{""code"":""$code"",""checkpointId"":$cpid,""source"":""manual""}"
try {
    $sc = Invoke-RestMethod -Uri "$base/scans" -Method POST -Headers $H -Body $sb
    Write-Host "scan OK result=$($sc.result)"
} catch { Write-Host "scan fallo: $_" }
