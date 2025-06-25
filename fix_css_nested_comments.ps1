# PowerShell скрипт для исправления вложенных CSS комментариев
Write-Host "🔧 ИСПРАВЛЕНИЕ ВЛОЖЕННЫХ CSS КОММЕНТАРИЕВ" -ForegroundColor Green
Write-Host "=" * 50

$cssFiles = Get-ChildItem -Path "frontend\src\components" -Recurse -Filter "*.css"
$totalFixed = 0

foreach ($file in $cssFiles) {
    Write-Host "🔧 Обрабатываем: $($file.FullName)" -ForegroundColor Yellow
    
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Создаем backup
    $backupPath = "$($file.FullName).ps-backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
    $originalContent | Out-File -FilePath $backupPath -Encoding UTF8
    
    # Исправляем вложенные комментарии
    # Паттерн: /* /* REMOVED ANIMATION: ... */ заменяем на /* REMOVED ANIMATION: ... */
    $content = $content -replace '/\* /\* REMOVED ANIMATION: ([^*]+(?:\*[^/])*)\*/', '/* REMOVED ANIMATION: $1*/'
    
    # Сохраняем исправленный файл
    $content | Out-File -FilePath $file.FullName -Encoding UTF8
    
    if ($content -ne $originalContent) {
        Write-Host "✅ Исправлен: $($file.Name)" -ForegroundColor Green
        Write-Host "📦 Backup: $backupPath" -ForegroundColor Blue
        $totalFixed++
    } else {
        Write-Host "✅ Корректный: $($file.Name)" -ForegroundColor Cyan
        Remove-Item $backupPath  # Удаляем backup если изменений не было
    }
}

Write-Host "=" * 50
Write-Host "✅ ЗАВЕРШЕНО! Исправлено файлов: $totalFixed" -ForegroundColor Green 