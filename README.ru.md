<p align="center">
  <img src="assets/images/banner-top.jpg" alt="NeXXUs Sovereign Crypto-Cloud Hosting" width="100%" style="border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.6);" />
</p>

# 🌌 NeXXUs — Децентрализованное Криптооблако и Суверенная P2P Сеть Хранилищ

> **Суверенная Peer-to-Peer платформа для надёжного хранения конфиденциальных данных, секретов, ключей и приватных архивов, абсолютно независимая от облачных корпораций, датацентров и цензуры провайдеров.**

<p align="center">
  <b>🌐 Язык / Language / Idioma:</b><br>
  <a href="README.md"><b>English (EN)</b></a> •
  <b>Русский (RU)</b> •
  <a href="README.es.md"><b>Español (ES)</b></a>
</p>

---

[![Rust Core](https://img.shields.io/badge/Ядро-100%25_Нативный_Rust-orange?style=for-the-badge&logo=rust)](crates/)
[![Rust Audit](https://img.shields.io/badge/Аудит-ПРОЙДЕН_Tier--1-success?style=for-the-badge&logo=shield)](RUST_AUDIT.md)
[![Evolution Plan](https://img.shields.io/badge/План_Эволюции-RUST_2026-blueviolet?style=for-the-badge)](RUST_EVOLUTION_PLAN.md)
[![Legacy Archive](https://img.shields.io/badge/Архив_Legacy-Node.js_TypeScript-grey?style=for-the-badge)](legacy/)
[![Wire Protocol](https://img.shields.io/badge/Wire_Protocol-v2.0.0_Big--Endian-06b6d4?style=for-the-badge&logo=wireguard)](PROTOCOL_WIRE_SPEC.md)
[![Zero-Knowledge](https://img.shields.io/badge/Security-Zero--Knowledge_ChaCha20--Poly1305-10b981?style=for-the-badge&logo=shield)](PROTOCOL_WIRE_SPEC.md)
[![Erasure Coding](https://img.shields.io/badge/Fault_Tolerance-Reed--Solomon_(4+2)_GF(2^8)-f59e0b?style=for-the-badge&logo=speedtest)](test/protocol.test.ts)
[![Golden Vectors](https://img.shields.io/badge/Golden_Vectors-113%2F113_PASS-8b5cf6?style=for-the-badge&logo=checkmarx)](nexxus-vectors/)
[![Tor Onion](https://img.shields.io/badge/Transport-Tor_v3_Onion_P2P-ec4899?style=for-the-badge&logo=torproject)](PROTOCOL_WIRE_SPEC.md)
[![Ubuntu Installer](https://img.shields.io/badge/Linux_Deploy-Ubuntu_One--Liner-E95420?style=for-the-badge&logo=ubuntu)](install.sh)
[![Windows Installer](https://img.shields.io/badge/Windows_Deploy-PowerShell_One--Liner-0078D6?style=for-the-badge&logo=windows)](install.ps1)
[![Android Installer](https://img.shields.io/badge/Android_Deploy-Termux_One--Liner-3DDC84?style=for-the-badge&logo=android)](scripts/install-android-termux.sh)

---

## 📑 Содержание

1. [Манифест и Ключевые Принципы](#-манифест-проекта)
2. [Архитектура и Математика Надежности](#-архитектура-и-математика-надежности)
3. [⚡ Быстрая Установка на Linux (Ubuntu/Debian) Одной Командой](#-быстрая-установка-на-linux-ubuntudebian-одной-командой)
4. [🪟 Быстрая Установка на Windows Одной Командой](#-быстрая-установка-на-windows-одной-командой)
5. [📱 Установка на Android (Termux)](#-установка-на-android-termux)
6. [📦 Готовые Пакеты для Скачивания (.deb, .tar.gz, .zip)](#-готовые-пакеты-для-скачивания)
7. [🛠️ Полный Справочник Команд CLI (`nexxusd`)](#️-полный-справочник-команд-cli-nexxusd)
8. [⚙️ Конфигурация и Параметры Окружения](#️-конфигурация-и-параметры-окружения)
9. [🌐 Объединение Хостов в Меш-Кластер](#-объединение-хостов-в-меш-кластер)
10. [📈 Экономика и Модель Рынка (2026–2029)](#-экономика-и-модель-рынка-20262029)
11. [❓ FAQ и Решение Проблем](#-faq-и-решение-проблем)

---

## ⚡ Манифест Проекта

Централизованные облачные хранилища (AWS S3, Google Cloud, Microsoft OneDrive, Dropbox) несут фундаментальные риски:
* **Единая точка отказа (SPOF)**: аварии ЦОД, блокировки учетных записей или санкции в один миг отрезают доступ к секретам.
* **Иллюзия приватности**: метаданные, IP-адреса, размеры файлов и частота обращений анализируются и передаются третьим лицам.
* **Юрисдикционная уязвимость**: принудительный доступ со стороны спецслужб и коммерческих монополий.

**NeXXUs заменяет серверы корпораций чистой математикой и распределённым роем узлов.** Ваши файлы не хранятся целиком ни на одном компьютере мира. Они квантуются на микро-блоки ровно по 16 KB, шифруются локально шифром **ChaCha20-Poly1305**, кодируются помехоустойчивыми матрицами **Reed-Solomon (4+2)** и рассеиваются по глобальному рою независимых хостинг-узлов через анонимную сеть **Tor v3**.

---

## 🏛️ Архитектура и Математика Надежности

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                         ВАШЕ УСТРОЙСТВО (КЛИЕНТ)                       │
   │  1. Вход: Мастер-мнемоника BIP-39 (12/24 слова)                        │
   │  2. Квантование данных на микро-чанки ровно по 16 KB (16,384 байт)     │
   │  3. Клиентское шифрование: ChaCha20-Poly1305 (AEAD, 256-бит, RFC 8439) │
   │  4. Кодирование стирания: Reed-Solomon (4+2) над полем Галуа GF(2^8)   │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │
                Шарды 1-6 (4 данных + 2 проверочных по 4 KB каждый)
                                       │
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                       ДЕЦЕНТРАЛИЗОВАННЫЙ РОЙ P2P                       │
   │  • Анонимный транспорт: Tor v3 Onion (62-символьные адреса)            │
   │  • Kademlia 256-bit DHT с маршрутизацией по XOR-расстоянию             │
   │  • Anti-Outsource: верификация локального отклика диска (I/O < 50 мс)  │
   │  • Защита от монополий: ASN Herfindahl-Hirschman Index (HHI ≤ 2500)    │
   │  • Автономное самоисцеление (Self-Healing) при потере любых 2 нод      │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        ▼              ▼               ▼               ▼              ▼
   [Нода #1: 4KB] [Нода #2: 4KB] [Нода #3: 4KB] [Нода #4: 4KB] [Нода #5: 4KB]
     (Германия)     (Бразилия)      (Исландия)       (Япония)       (Канада)
```

### 1. Квантование и Избыточное Кодирование Reed-Solomon (4+2)
* **Размер блока**: ровно `16,384 байта` (16 KB).
* **Матрица Вандермонда над $GF(2^8)$** с примитивным полиномом `0x11D` ($x^8 + x^4 + x^3 + x^2 + 1$).
* Каждый чанк расщепляется на **4 информационных шарда** и **2 проверочных шарда** (по 4,096 байт каждый).
* **Математическая гарантия**: для 100% восстановления исходного файла достаточно любых 4 из 6 шардов. Даже при физическом выходе из строя двух серверов данные восстанавливаются бит-в-бит.

### 2. Клиентское Шифрование Zero-Knowledge (ChaCha20-Poly1305)
* Все данные шифруются **на клиенте до отправки в сеть**.
* Симметричный шифр **ChaCha20** с 256-битным ключом и аутентификацией сообщений **Poly1305** (RFC 8439).
* Узлы хранения видят только зашифрованный шум. Оператор ноды не имеет технической возможности узнать ни имя, ни тип, ни содержание файла.

### 3. Proof-of-Retrievability (PoR) Аудит
* Рой непрерывно валидирует узлы случайными криптографическими вызовами: $s \in \{0, 1\}^{256}$.
* Дедлайн вычисления ответа: **строго 3,000 мс** (фактическое время на NVMe: 1–4 мс).
* Попытка перенаправить трафик в медленное облако (AWS S3) приводит к таймауту задержки и немедленной дисквалификации узла.

---

## ⚡ Быстрая Установка на Linux (Ubuntu/Debian) Одной Командой

Инсталляционный скрипт позволяет развернуть суверенный узел на любом сервере Ubuntu (20.04, 22.04, 24.04 LTS) или Debian **одной командой**:

### 🚀 Способ 1: Удаленная установка через `curl | bash` (Рекомендуемый)

```bash
curl -fsSL https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/install.sh | bash
```

> 💡 **Что скрипт делает автоматически:**
> 1. Проверяет права `sudo` и системные ресурсы (CPU, RAM, диск).
> 2. При отсутствии Node.js автоматически ставит официальную LTS-версию (v20) из NodeSource.
> 3. Клонирует или обновляет репозиторий в `/opt/nexxus`.
> 4. Собирает оптимизированный автономный бандл демона `dist/nexxusd.cjs`.
> 5. Устанавливает глобальную команду `/usr/local/bin/nexxusd`.
> 6. Создает структуру каталогов `/var/lib/nexxus` (`chunks/`, `meta/`, `logs/`).
> 7. Применяет оптимизации ядра Linux через `/etc/sysctl.d/99-nexxus.conf` для максимального IOPS на NVMe-дисках.
> 8. Генерирует криптографический паспорт узла (`node_identity.json`) с Ed25519 ключами и адресом **Tor Onion v3**.
> 9. Устанавливает и запускает системную службу **systemd** (`nexxus-node.service`) с автозапуском.

#### Установка с кастомными параметрами:
```bash
curl -fsSL https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/install.sh | bash -s -- --storage-gb=500 --port=3999 --peers=192.168.1.10:3999
```

### 📦 Способ 2: Установка через Debian-пакет (.deb)
```bash
wget https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/public/packages/nexxus-node_latest_amd64.deb
sudo dpkg -i nexxus-node_latest_amd64.deb || sudo apt-get install -f -y
nexxusd init
sudo systemctl enable --now nexxus-node
```

### 🔨 Способ 3: Локальная установка из репозитория
```bash
git clone https://github.com/PerfectFriend/NeXXus-Node.git
cd NeXXus-Node
sudo bash install.sh
```

---

## 🪟 Быстрая Установка на Windows Одной Командой

Для Windows 10/11 доступна быстрая автоматическая установка.

### 🚀 Способ 1: PowerShell в одну строку (Рекомендуемый)

Откройте **PowerShell от имени Администратора** и выполните:

```powershell
irm https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/install.ps1 | iex
```

### 🖱️ Способ 2: Двойной клик на `install.bat` (Для локального репозитория)
Если вы скачали ZIP-архив или клонировали репозиторий:
1. Запустите файл `install.bat` от имени Администратора (правый клик → «Запуск от имени администратора»).
2. Скрипт сам обойдет политики выполнения PowerShell, установит Node.js LTS (при необходимости), скопирует бинарники и зарегистрирует службу.

### 🎮 Управление на Windows:
После установки вам доступны пакетные файлы и CLI:
* `nexxus-start.bat` — быстрый запуск демона в фоне/консоли.
* `nexxus-stop.bat` — остановка всех фоновых процессов NeXXUs.
* `nexxusd status` — проверка состояния ноды, памяти и сетевого паспорта.
* `nexxusd test-por` — запуск локального бенчмарка Proof-of-Retrievability.

---

## 📱 Установка на Android (Termux)

Превратите любой Android-смартфон с быстрым накопителем UFS в полноценную P2P-ноду криптооблака.

Откройте приложение **Termux** и введите:

```bash
curl -fsSL https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/scripts/install-android-termux.sh | bash
```

* **Wakelock**: утилита автоматически активирует `termux-wake-lock`, предотвращая засыпание CPU при заблокированном экране.
* **Автозапуск**: при наличии пакета `Termux:Boot` демон запускается автоматически при включении телефона.

---

## 📦 Готовые Пакеты для Скачивания

Все скомпилированные дистрибутивы находятся в папке `public/packages/`:

| Платформа | Формат | Ссылка для скачивания | Назначение |
|---|---|---|---|
| **Ubuntu / Debian** | `.deb` | [`nexxus-node_latest_amd64.deb`](public/packages/nexxus-node_latest_amd64.deb) | Нативная установка через `dpkg -i` |
| **Linux Universal** | `.tar.gz` | [`nexxus-node_latest_linux_x86_64.tar.gz`](public/packages/nexxus-node_latest_linux_x86_64.tar.gz) | Универсальный архив для любого Linux (Arch, Fedora, Alpine) |
| **Windows 10/11** | `.zip` | [`nexxus-node_latest_windows_x64.zip`](public/packages/nexxus-node_latest_windows_x64.zip) | Полный портативный бандл с `install.bat` и скриптами запуска |

---

## 🛠️ Полный Справочник Команд CLI (`nexxusd`)

| Команда | Описание | Пример вызова |
|---|---|---|
| `nexxusd serve` | Запуск P2P демона хранилища в фоновом/интерактивном режиме | `nexxusd serve --port=3999` |
| `nexxusd init` | Генерация суверенной крипто-идентичности, ключей и Tor Onion v3 | `nexxusd init` или с мнемоникой: `nexxusd init --mnemonic="..."` |
| `nexxusd id` | Вывод паспорта ноды, открытого ключа Ed25519 и адреса Onion v3 | `nexxusd id` |
| `nexxusd status` | Просмотр статуса ноды, занятого объема NVMe, пула и ранга сейфа | `nexxusd status` |
| `nexxusd peers` | Вывод списка всех подключенных активных меш-узлов и задержек RTT | `nexxusd peers` |
| `nexxusd peer add <IP:PORT>` | Подключение к удаленному узлу и взаимный обмен паспортами | `nexxusd peer add 192.168.1.50:3999` |
| `nexxusd test-por` | Запуск локального бенчмарка Proof-of-Retrievability (<3000 мс) | `nexxusd test-por` |
| `nexxusd test-interhost <IP:PORT>` | Полный 6-этапный P2P аудит сетевого взаимодействия с удаленным узлом | `nexxusd test-interhost 192.168.1.50:3999` |
| `nexxusd upload <file>` | Загрузка локального файла: нарезка на 16KB, RS (4+2) и рассеивание | `nexxusd upload /path/to/archive.tar.gz` |
| `nexxusd download <hash> <out>` | Сбор шардов из сети, восстановление через RS и дешифрование | `nexxusd download <sha256> /tmp/restored.bin` |
| `nexxusd logs [-n N]` | Просмотр структурированных записей операционного лога | `nexxusd logs -n 50` |
| `nexxusd benchmark` | Тестирование пропускной способности NVMe и скорости Merkle Tree | `nexxusd benchmark` |

---

## ⚙️ Конфигурация и Параметры Окружения

Основной файл конфигурации: `/etc/nexxus/nexxus.conf` (или `nexxus.conf` в папке программы):

```ini
# Сетевой интерфейс и порт
NEXXUS_HOST=0.0.0.0
NEXXUS_PORT=3999

# Каталог данных и размер выделенного пула NVMe (в ГБ)
NEXXUS_DATA_DIR=/var/lib/nexxus
NEXXUS_STORAGE_GB=384

# Параметры надежности (Reed-Solomon)
NEXXUS_REED_SOLOMON_DATA=4
NEXXUS_REED_SOLOMON_PARITY=2
NEXXUS_CHUNK_SIZE_KB=16

# Начальные узлы для присоединения к сети (через запятую)
NEXXUS_BOOTSTRAP_PEERS=192.168.1.10:3999,192.168.1.20:3999

# Уровень логирования (debug, info, warn, error)
NEXXUS_LOG_LEVEL=info
```

---

## 🌐 Объединение Хостов в Меш-Кластер

1. Установите NeXXUs на **Хост 1** (`192.168.1.10`) и **Хост 2** (`192.168.1.20`).
2. На **Хосте 1** подключите **Хост 2**:
   ```bash
   nexxusd peer add 192.168.1.20:3999
   ```
3. Проверьте сетевое взаимодействие и PoR аудит:
   ```bash
   nexxusd test-interhost 192.168.1.20:3999
   ```
4. Загрузите файл в распределённую сеть:
   ```bash
   nexxusd upload /path/to/secret.pdf
   ```

---

## 📈 Экономика и Модель Рынка (2026–2029)

Подробный анализ рынка и токеномика: 👉 [docs/MARKET_FORECAST_AND_TOKENOMICS_3Y.md](docs/MARKET_FORECAST_AND_TOKENOMICS_3Y.md)

* **Вторая жизнь старых смартфонов**: 5.3 миллиарда неиспользуемых телефонов в мире. Подключённые к домашнему Wi-Fi, они потребляют 1.5 Вт и работают как необнуляемые ноды с встроенным аккумулятором в роли ИБП.
* **Математическая защита от атак (Anti-Loop Invariant)**: $\text{Fee}_{\text{writer}} (1.30) > \text{Reward}_{\text{storer}} (1.25)$. Любая попытка фармить награды на собственных нодах приносит чистый убыток $-0.05$ NEXX.

---

## ❓ FAQ и Решение Проблем

#### Как открыть порт в фаерволе Ubuntu?
```bash
sudo ufw allow 3999/tcp comment "NeXXUs P2P Wire Protocol"
sudo ufw reload
```

#### Нужен ли белый статический IP-адрес?
Для прямого IP-соединения белый IP удобен, но **не обязателен**. В протокол встроена маршрутизация через **Tor Onion v3**, пробивающая NAT без настройки роутера.

#### Как перенести ноду на другой сервер?
Сохраните вашу мнемоническую фразу из 12 слов, сгенерированную при `nexxusd init`. На новом сервере выполните:
```bash
nexxusd init --mnemonic="ваша фраза из двенадцати слов..."
```

---

<p align="center">
  <b>Разработано для свободного, суверенного и несокрушимого хранения данных.</b><br>
  <sub>NeXXUs Protocol Core • Версия 2.0.0</sub>
</p>
