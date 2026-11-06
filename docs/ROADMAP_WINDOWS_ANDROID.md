# 🗺️ NeXXUs Storage Node — Архитектурный План Реализации: Windows & Android

> **Стратегия мультиплатформенного расширения суверенной децентрализованной P2P-сети хранения с автоматической установкой и обновлениями через GitHub.**

---

## 📑 Содержание

1. [Архитектурный фундамент: Единое криптографическое ядро](#1-архитектурный-фундамент-единое-криптографическое-ядро)
2. [План реализации для Windows](#2-план-реализации-для-windows)
   - [Фаза W1: PowerShell One-Liner и портативный бандл](#фаза-w1-powershell-one-liner-и-портативный-бандл-готов)
   - [Фаза W2: Нативная системная служба Windows (Windows Service)](#фаза-w2-нативная-системная-служба-windows-windows-service)
   - [Фаза W3: Сборка единого бинарного файла nexxusd.exe](#фаза-w3-сборка-единого-бинарного-файла-nexxusdexe)
   - [Фаза W4: MSI-пакет и инсталлятор InnoSetup / WiX Toolset](#фаза-w4-msi-пакет-и-инсталлятор-innosetup--wix-toolset)
   - [Фаза W5: Windows Tray Companion (GUI в трее на Tauri / WebView2)](#фаза-w5-windows-tray-companion-gui-в-трее-на-tauri--webview2)
3. [План реализации для Android](#3-план-реализации-для-android)
   - [Фаза A1: Termux Headless Daemon с Wakelock](#фаза-a1-termux-headless-daemon-с-wakelock-готов)
   - [Фаза A2: Нативное Android-приложение (Kotlin + Jetpack Compose)](#фаза-a2-нативное-android-приложение-kotlin--jetpack-compose)
   - [Фаза A3: Android Foreground Service и управление энергосбережением](#фаза-a3-android-foreground-service-и-управление-энергосбережением)
   - [Фаза A4: Scoped Storage и поддержка MicroSD карт](#фаза-a4-scoped-storage-и-поддержка-microsd-карт)
   - [Фаза A5: Автообновление через GitHub Releases API](#фаза-a5-автообновление-через-github-releases-api)
4. [Сетевой слой: NAT Traversal, STUN и Tor v3 на Windows и Android](#4-сетевой-слой-nat-traversal-stun-и-tor-v3-на-windows-и-android)
5. [Таблица сопоставления платформ и график реализации](#5-таблица-сопоставления-платформ-и-график-реализации)

---

## 1. Архитектурный фундамент: Единое криптографическое ядро

Вся сеть NeXXUs построена вокруг детерминированных инвариантов протокола:
- **Размер кванта**: строго `16,384 байта` (16 KB).
- **Симметричное шифрование**: `ChaCha20-Poly1305` (RFC 8439, 256-битный ключ, 12-байтный nonce, 16-байтный MAC).
- **Кодирование стирания (Erasure Coding)**: Reed-Solomon `4+2` над полем Галуа $GF(2^8)$ с примитивным полиномом `0x11D`.
- **Протокол провода (Wire Protocol)**: бинарный big-endian формат с magic `0x584E` (`NX`), опкодами `0x01`–`0x0D` и 32-битным requestId.
- **Proof-of-Retrievability (PoR)**: детерминированное Merkle-дерево с ответом на вызов `SHA-256(chunk + challenge)` с лимитом ответа `<3000 ms`.
- **Идентификация узла**: Ed25519 криптографическая пара ключей, Tor v3 Onion адрес (56 символов base32 + контрольная сумма), 12-словная мнемоника BIP-39.

Благодаря изоляции ядра в файлах `scripts/linux-daemon.ts` и `src/services/storageEngine.ts`, код полностью переносим и запускается в любой среде с Node.js runtime, либо транслируется в нативный бинарник (через Node SEA, Bun или Rust-обертку).

---

## 2. План реализации для Windows

### Фаза W1: PowerShell One-Liner и портативный бандл (ГОТОВ)
* **Статус**: реализован скрипт `install.ps1` в корне репозитория.
* **Механика**:
  Пользователь на любой машине Windows 10/11 открывает PowerShell от имени администратора и запускает:
  ```powershell
  irm https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/install.ps1 | iex
  ```
* **Автоматические действия**:
  1. Проверка наличия Node.js LTS (при отсутствии — автоматическая тихая установка через `winget install OpenJS.NodeJS.LTS` или MSI).
  2. Загрузка последнего standalone-бандла `nexxusd.cjs` с GitHub.
  3. Создание каталогов `$env:ProgramData\NeXXUs` (`chunks`, `meta`, `logs`).
  4. Генерация исполняемых обёрток `nexxusd.cmd` и `nexxusd.ps1` и автоматическое добавление в системный `PATH`.
  5. Инициализация суверенного паспорта узла (`nexxusd init`) с генерацией Ed25519 ключей и Tor Onion v3 адреса.

### Фаза W2: Нативная системная служба Windows (Windows Service)
Для непрерывной работы ноды 24/7 без необходимости держать открытым окно консоли:
* **Инструмент**: интеграция [WinSW](https://github.com/winsw/winsw) (Windows Service Wrapper) или NSSM.
* **Конфигурация WinSW (`nexxus-service.xml`)**:
  ```xml
  <service>
    <id>NeXXUsStorageNode</id>
    <name>NeXXUs Sovereign Storage Node</name>
    <description>Peer-to-Peer Encrypted Storage Daemon with Reed-Solomon Erasure Coding</description>
    <executable>node.exe</executable>
    <arguments>"%ProgramFiles%\NeXXUs\nexxusd.cjs" serve --config="%ProgramData%\NeXXUs\nexxus.conf"</arguments>
    <logpath>%ProgramData%\NeXXUs\logs</logpath>
    <log mode="roll-by-size">
      <sizeThreshold>10240</sizeThreshold>
      <keepFiles>5</keepFiles>
    </log>
    <onfailure action="restart" delay="5 sec"/>
  </service>
  ```
* **Команды управления службой**:
  ```powershell
  Start-Service NeXXUsStorageNode
  Stop-Service NeXXUsStorageNode
  Get-Service NeXXUsStorageNode
  ```

### Фаза W3: Сборка единого бинарного файла nexxusd.exe
* Создание автономного `.exe` файла без внешних зависимостей (node.js не требуется на целевой машине).
* **Стек**: Node.js Single Executable Applications (Node SEA) или `@yao-pkg/pkg`.
* **GitHub Actions Pipeline**:
  ```yaml
  - name: Build Windows Executable
    run: |
      npx @yao-pkg/pkg dist/nexxusd.cjs --target node20-win-x64 --output dist/nexxusd.exe
  ```
* Готовый файл `nexxusd.exe` автоматически прикрепляется к GitHub Releases при публикации тегов `v*`.

### Фаза W4: MSI-пакет и инсталлятор InnoSetup / WiX Toolset
* Создание инсталлятора `NeXXUs-Node-Setup-x64.exe` или `.msi`:
  - Выбор диска и размера пула хранения (например, 128 GB, 256 GB, 500 GB на быстрых NVMe/SSD).
  - Автоматическая регистрация службы Windows.
  - Настройка брандмауэра Windows (добавление правила `New-NetFirewallRule -DisplayName "NeXXUs P2P" -Direction Inbound -LocalPort 3999 -Protocol TCP -Action Allow`).
  - Создание ярлыков и добавление в автозагрузку.

### Фаза W5: Windows Tray Companion (GUI в трее на Tauri / WebView2)
* Легковесное приложение в системном трее Windows:
  - Иконка статуса (зелёный — в сети, синий — идёт аудит PoR, оранжевый — самоисцеление).
  - Всплывающее окно: заполненность пула NVMe, список подключенных пиров, текущий Onion v3 адрес, заработанные награды.
  - Кнопка "Пауза" / "Форсировать аудит PoR" / "Открыть веб-дашборд".

---

## 3. План реализации для Android

Смартфоны на Android оснащены современными хранилищами UFS 3.1/4.0 и быстрыми MicroSD картами емкостью 128–512 ГБ. Превращение Android-устройств в ноды сети NeXXUs даёт миллионы географически распределённых точек хранения.

### Фаза A1: Termux Headless Daemon с Wakelock (ГОТОВ)
* **Статус**: реализован скрипт `scripts/install-android-termux.sh`.
* **Установка на телефоне через Termux в одну команду**:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/scripts/install-android-termux.sh | bash
  ```
* **Ключевые фичи**:
  1. Захват `termux-wake-lock`, блокирующий засыпание CPU при выключенном экране.
  2. Размещение пула хранения в `$HOME/.nexxus-storage`.
  3. Поддержка автозапуска при загрузке телефона через пакет `termux-boot` (`~/.termux/boot/start-nexxus.sh`).
  4. Полноценная работа протокола: прием шардов, участие в PoR-аудитах за доли миллисекунд.

---

### Фаза A2: Нативное Android-приложение (Kotlin + Jetpack Compose)

Для массовых пользователей без опыта работы с консолью Termux создаётся нативное APK-приложение **NeXXUs Node Mobile**.

#### Архитектура APK:
```
┌────────────────────────────────────────────────────────┐
│             UI Слой (Jetpack Compose, Material 3)      │
│  • Статус узла (Online / Syncing / Self-Healing)        │
│  • Слайдер выделения памяти (16 GB - 128 GB)           │
│  • QR-код и кнопка копирования Onion v3 адреса         │
│  • Список подключенных пиров и карта задержек          │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│      Android Foreground Service (START_STICKY)         │
│  • Постоянное уведомление в шторке (Low Memory Killer) │
│  • Контроль батареи: пауза при заряде < 20%           │
│  • Wi-Fi Only режим (защита мобильного трафика)        │
└───────────────────────────┬────────────────────────────┘
                            │ IPC / Localhost Socket
┌───────────────────────────▼────────────────────────────┐
│      Встроенное Ядро Демона (Embedded Engine)          │
│  • Вариант 1: NodeJS-Mobile JNI Runtime                │
│  • Вариант 2: Скомпилированное Rust/C Core через JNI   │
│  • Полноценный ChaCha20, RS 4+2, Kademlia DHT, PoR     │
└────────────────────────────────────────────────────────┘
```

---

### Фаза A3: Android Foreground Service и управление энергосбережением

Главный вызов на Android — агрессивные механизмы энергосбережения (Doze Mode, App Standby Buckets).

1. **Неубиваемый Foreground Service**:
   ```kotlin
   class NexxusDaemonService : Service() {
       override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
           val notification = NotificationCompat.Builder(this, CHANNEL_ID)
               .setContentTitle("NeXXUs Sovereign Storage Node")
               .setContentText("Узел активен • 32 GB выделено • 8 пиров в сети")
               .setSmallIcon(R.drawable.ic_nexxus_node)
               .setOngoing(true)
               .setPriority(NotificationCompat.PRIORITY_LOW)
               .build()
           
           startForeground(NOTIFICATION_ID, notification)
           return START_STICKY
       }
   }
   ```
2. **Исключение из оптимизации батареи**:
   При первом запуске приложение запрашивает системное разрешение:
   ```kotlin
   val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
       data = Uri.parse("package:$packageName")
   }
   startActivity(intent)
   ```
3. **Умные политики синхронизации**:
   - `Sync on Wi-Fi Only` (по умолчанию включено): тяжелая передача шардов происходит только по безлимитному Wi-Fi.
   - `Sync on Charging Only`: интенсивные дисковые операции и самоисцеление выполняются, когда телефон стоит на зарядке.
   - `Thermal Throttling Guard`: при температуре аккумулятора выше 41°C интенсивность I/O снижается на 50%.

---

### Фаза A4: Scoped Storage и поддержка MicroSD карт

Начиная с Android 11 (API 30), доступ к файловой системе ограничен:
- **Основной пул**: выделяется в изолированной директории приложения `context.getExternalFilesDir("chunks")` (не требует системных разрешений `MANAGE_EXTERNAL_STORAGE`).
- **Съемные MicroSD-карты**: пользователь через Storage Access Framework (SAF) может выбрать директорию на внешней SD-карте емкостью 128–512 ГБ, превращая старый телефон в автономный холодный NAS.

---

### Фаза A5: Автообновление через GitHub Releases API

Так как NeXXUs распространяется через GitHub без привязки к цензуре Google Play Store:
1. Встроенный сервис проверки обновлений:
   `GET https://api.github.com/repos/PerfectFriend/NeXXus-Node/releases/latest`
2. Сравнение версий `v2.0.0` vs `v2.1.0`.
3. Загрузка подписанного файла `nexxus-node-release.apk`.
4. Запуск системного интента установки пакета:
   ```kotlin
   val installIntent = Intent(Intent.ACTION_VIEW).apply {
       setDataAndType(apkUri, "application/vnd.android.package-archive")
       flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
   }
   startActivity(installIntent)
   ```

---

## 4. Сетевой слой: NAT Traversal, STUN и Tor v3 на Windows и Android

| Задача | Решение на Ubuntu Linux | Решение на Windows | Решение на Android |
|---|---|---|---|
| **Обход серых IP / NAT** | Tor Onion v3 демон / UPnP | Tor Expert Bundle / UPnP | Встроенный Tor (Tor.framework / Guardian Project) |
| **Прямое P2P соединение** | STUN / WebRTC Hole Punching | STUN / WebRTC Hole Punching | STUN over Wi-Fi, fallback на Tor |
| **Порт по умолчанию** | `3999` (TCP/WS) | `3999` (TCP/WS) | `3999` (TCP/WS) |
| **Файрвол** | `ufw allow 3999/tcp` | `New-NetFirewallRule` | Разрешено локально, NAT via UPnP |

---

## 5. Таблица сопоставления платформ и график реализации

| Платформа | Метод установки с GitHub | Формат артефакта | Фоновый процесс | Статус |
|---|---|---|---|---|
| **Ubuntu / Debian** | `curl -fsSL .../install.sh \| bash` | `.deb` пакет / esbuild cjs | Systemd unit (`nexxus-node.service`) | **ГОТОВ (v2.0)** |
| **Windows (CLI/Headless)** | `irm .../install.ps1 \| iex` | `.ps1` / `nexxusd.cjs` / `.cmd` | Windows Scheduled Task / WinSW | **ГОТОВ (v2.0)** |
| **Windows (Native EXE/MSI)** | Скачивание из GitHub Releases | `nexxusd.exe` / `.msi` | Windows Native Service | **Фаза W3-W4** |
| **Android (Termux)** | `curl -fsSL .../install-android-termux.sh \| bash` | Termux package / NodeJS bundle | Termux Wakelock + Boot script | **ГОТОВ (v2.0)** |
| **Android (Native APK)** | Скачивание `APK` из GitHub Releases | `nexxus-node.apk` | Android Foreground Service | **Фаза A2-A5** |

---

### 📅 План спринтов разработки:

```
[Текущий релиз]  v2.0.0 — Ubuntu One-Liner, DEB-пакет, Windows PowerShell, Android Termux
      │
      ▼
[Спринт 1]      v2.1.0 — Windows Service (WinSW), автономный nexxusd.exe для Windows x64
      │
      ▼
[Спринт 2]      v2.2.0 — Android APK (Alpha): Jetpack Compose UI + Foreground Service
      │
      ▼
[Спринт 3]      v2.3.0 — Wi-Fi Only / Charging Only политики, Scoped Storage & MicroSD
      │
      ▼
[Спринт 4]      v2.4.0 — Windows Tray Companion (Tauri) + GitHub Auto-Updater в APK
```
