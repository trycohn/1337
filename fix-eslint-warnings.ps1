# PowerShell скрипт для исправления ESLint предупреждений
Write-Host "🔧 Исправление ESLint предупреждений..."

# 1. Удаляем Unicode BOM из TournamentDetails.js
Write-Host "Удаление Unicode BOM из TournamentDetails.js..."
$content = Get-Content "frontend/src/components/TournamentDetails.js" -Raw -Encoding UTF8
$content = $content -replace '^[\uFEFF]', ''
$content | Set-Content "frontend/src/components/TournamentDetails.js" -Encoding UTF8NoBOM

# 2. Исправляем V4StatsDashboard.js - убираем неиспользуемые переменные
Write-Host "Исправление V4StatsDashboard.js..."
$v4Content = Get-Content "frontend/src/components/V4StatsDashboard.js" -Raw
$v4Content = $v4Content -replace 'const \{ ([^}]*?)leaderboards, ([^}]*?) \} = useV4ProfileData\(\);', 'const { $1$2 } = useV4ProfileData();'
$v4Content = $v4Content -replace 'const \{ ([^}]*?)isLoadingV4Stats([^}]*?) \} = useV4ProfileData\(\);', 'const { $1$2 } = useV4ProfileData();'
$v4Content | Set-Content "frontend/src/components/V4StatsDashboard.js" -Encoding UTF8

# 3. Исправляем V4ProfileHooks.js - добавляем default case
Write-Host "Исправление V4ProfileHooks.js..."
$hooksContent = Get-Content "frontend/src/components/V4ProfileHooks.js" -Raw
$hooksContent = $hooksContent -replace 'switch \(action\.type\) \{([^}]+)\}', 'switch (action.type) {$1default: return state; }'
$hooksContent | Set-Content "frontend/src/components/V4ProfileHooks.js" -Encoding UTF8

Write-Host "✅ Исправления применены!"
Write-Host "🚀 Теперь запустите: npm start" 