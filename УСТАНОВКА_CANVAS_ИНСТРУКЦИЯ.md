# 🎨 Инструкция по установке Canvas для генерации изображений

## 📋 **Что это дает:**
- **PNG изображения** высокого качества для превью в соцсетях
- **Кастомные шрифты** для лучшего внешнего вида
- **Лучшая совместимость** с социальными сетями
- **Автоматический fallback** на SVG если canvas не установлен

---

## 🖥️ **Установка на VDS сервере (Ubuntu/CentOS)**

### **1. Установка системных зависимостей:**

#### **Для Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

#### **Для CentOS/RHEL:**
```bash
sudo yum groupinstall -y "Development Tools"
sudo yum install -y cairo-devel pango-devel libjpeg-turbo-devel giflib-devel librsvg2-devel
```

### **2. Установка Node.js пакета:**
```bash
cd /var/www/1337community.com/backend
npm install canvas --save
```

### **3. Проверка установки:**
```bash
node -e "console.log(require('canvas').createCanvas(100, 100).toBuffer().length)"
```
*Если выводится число - установка прошла успешно!*

---

## 🎨 **Установка кастомных шрифтов (опционально):**

### **1. Создайте папку для шрифтов:**
```bash
mkdir -p /var/www/1337community.com/backend/assets/fonts
```

### **2. Скачайте шрифт Roboto:**
```bash
cd /var/www/1337community.com/backend/assets/fonts
wget https://github.com/google/fonts/raw/main/apache/roboto/Roboto-Bold.ttf
```

### **3. Установите права доступа:**
```bash
chmod 644 /var/www/1337community.com/backend/assets/fonts/Roboto-Bold.ttf
chown www-data:www-data /var/www/1337community.com/backend/assets/fonts/Roboto-Bold.ttf
```

---

## 🔧 **Перезапуск сервисов:**

### **1. Перезапустите backend:**
```bash
pm2 restart 1337-backend
```

### **2. Проверьте логи:**
```bash
pm2 logs 1337-backend --lines 50
```

### **3. Проверьте статус:**
```bash
pm2 status
```

---

## ✅ **Тестирование:**

### **1. Проверьте endpoint изображений:**
```bash
curl -I "https://1337community.com/api/tournaments/1/match/14/share-image"
```

**Ожидаемый результат:**
```
HTTP/1.1 200 OK
Content-Type: image/png
Cache-Control: public, max-age=3600
```

### **2. Проверьте в браузере:**
Откройте: `https://1337community.com/api/tournaments/1/match/14/share-image`

**Должно показать PNG изображение с результатом матча**

---

## 🚨 **Решение проблем:**

### **Проблема: "node-gyp rebuild failed"**
```bash
# Переустановите build tools
sudo apt install -y python3-dev
npm rebuild canvas
```

### **Проблема: "libcairo.so.2: cannot open shared object"**
```bash
sudo ldconfig
pm2 restart 1337-backend
```

### **Проблема: "Permission denied"**
```bash
sudo chown -R www-data:www-data /var/www/1337community.com/backend/node_modules
```

### **Проблема: Canvas не найден**
- Система автоматически переключится на SVG
- Проверьте логи: `pm2 logs 1337-backend`
- Сообщение: `⚠️ Canvas не установлен, используем SVG генерацию`

---

## 📊 **Сравнение PNG vs SVG:**

| Характеристика | PNG (Canvas) | SVG (Fallback) |
|----------------|--------------|----------------|
| **Качество** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Размер файла** | ~50-100KB | ~5-10KB |
| **Совместимость** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Кастомные шрифты** | ✅ | ❌ |
| **Скорость генерации** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 **Итоговая команда установки:**

```bash
# Полная установка одной командой
cd /var/www/1337community.com && \
git pull origin main && \
cd backend && \
sudo apt install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev && \
npm install canvas --save && \
mkdir -p assets/fonts && \
wget -O assets/fonts/Roboto-Bold.ttf https://github.com/google/fonts/raw/main/apache/roboto/Roboto-Bold.ttf && \
chmod 644 assets/fonts/Roboto-Bold.ttf && \
pm2 restart 1337-backend && \
echo "✅ Canvas установлен успешно!"
```

---

## 📝 **Что изменилось в коде:**

1. **Автоматическое определение** доступности Canvas
2. **Graceful fallback** на SVG если Canvas не установлен  
3. **Улучшенная обработка ошибок** импорта
4. **Поддержка кастомных шрифтов** (Roboto)
5. **Обрезка длинных названий** команд и турниров
6. **Лучшее качество PNG** изображений

**Система работает в любом случае - с Canvas или без него!** 🚀