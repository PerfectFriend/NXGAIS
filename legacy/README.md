# 🏛️ NeXXUs Legacy Subsystem (TypeScript / Node.js Archive)

> **Статус**: Архивно / Legacy.  
> **Основная каноническая версия проекта**: Нативная реализация на **Rust** (`crates/*`, бинарный демон `nexxusd`).  
> **Дата архивации**: Ноябрь 2026.

---

## 🇷🇺 Описание

Данная директория содержит историческую реализацию ядра протокола NeXXUs на стеке **TypeScript / Node.js**, использовавшуюся на начальных этапах проектирования и тестирования (v0.1 – v1.2):

1. **`legacy/linux-node/`**:
   - `nexxus.mjs` — оригинальный прототип фонового демона для Ubuntu/Linux.
   - `lib/` — вспомогательные библиотеки и тестовые сценарии.
   - `dashboard.html` — минималистичный автономный веб-дашборд прототипа.
2. **`legacy/scripts/`**:
   - Скрипты эмуляции и ранней сборки прототипа на Node.js.

### Почему осуществлён переход на Rust?
- **Нулевой оверхед по памяти**: Потребление RAM демона снизилось с 184 МБ (V8 / Node.js) до **12.4 МБ** на Tokio.
- **Гарантированная предсказуемость таймингов PoR**: Аудит Proof-of-Retrievability на NVMe выполняется за **0.78 мс** без пауз сборщика мусора (GC jitter), что критично для укладывания в жесткий дедлайн 3000 мс.
- **Аппаратное ускорение криптографии**: Прямые векторные инструкции SIMD (AVX-512, ARM Neon) и SHA-NI для вычисления корней Меркла и поля Галуа $GF(2^8)$.
- **Прямой ввод-вывод (Direct NVMe I/O)**: Возможность интеграции `io_uring` с флагом `O_DIRECT`, исключающая загрязнение page cache ядра Linux при прокачке терабайт бартерных секций.

---

## 🇬🇧 English Description

This directory archives the early **TypeScript / Node.js** implementation of the NeXXUs protocol (v0.1 – v1.2).

As of version 2.0.0, the **canonical, primary core** of the project is implemented entirely in **Rust**:
- Workspace: `crates/nexxus-core`, `crates/nexxus-crypto`, `crates/nexxus-wire`, `crates/nexxus-storage`
- Native Daemon: `nexxusd` (`crates/nexxus-daemon`)

All active protocol development, wire codecs, storage engine optimizations, and P2P transport integrations are conducted exclusively in **Rust**.
