# 📋 Отчёт независимого технического аудита NeXXUs

> **Аудитор**: Grok (Гриша)  
> **Исполнитель / кодер**: AI Studio Engine / Женя (GAIS)  
> **Куратор**: Главный архитектор  
> **Канонический репозиторий**: https://github.com/PerfectFriend/NeXXUs-Node  
> **Проверенный HEAD (№9)**: `8788c07`  
> **Дата**: 9 ноября 2026, 16:33 CET  
> **Кодекс**: [Манифест v1.1](./MANIFEST_CANONICAL_AI_DEVELOPER.md)

---

## Статус аудитов

| Аудит | Статус | HEAD |
|-------|--------|------|
| №1–№8 | ✅ ЗАКРЫТЫ | ≤ `b6e72b8` |
| **№9 Sprint 3 (economy & at-rest)** | ✅ **ЗАКРЫТ** | **`8788c07`** |
| **№10 Release Candidate gate** | 🔴 **ОТКРЫТ** | этот отчёт |

---

## Аудит №9 — закрытие по `8788c07`

| ID | Статус | Проверка |
|----|--------|----------|
| **FEAT-ENC-REST-01** | ✅ | ChaCha до RS; `EncryptionEnvelope` в manifest; put/get `--key`; тест ciphertext≠plaintext |
| **FEAT-RETRIEVE-PAY-01** | ✅ | FetchChunk/FetchShard → `PAYMENT_REQUIRED` при throttle (payload gate) |
| **FEAT-CHALLENGE-LOOP-01** | ✅ | CLI `nexxusd challenge [--manifest\|--all]` |
| **FEAT-REP-01** | ✅ | `record_failure` score×0.7, throttle ≤0.2 |
| **FEAT-PEER-LIST-01** | ✅ | `nexxusd peers` bootstrap + throttle status |
| **DOC-ECON-01** | ✅ | README economy/enc section |
| **TEST-ECON-01** | ✅ | `economy_and_at_rest_test.rs` |

**Мелкий residual (не блок №9):** commit message упоминал opcode `0x16`; фактически reject через payload `PAYMENT_REQUIRED` на существующем frame — приемлемо, зафиксировать в PROTOCOL_WIRE_SPEC.

**Резолюция №9:** Sprint 3 принят.

---

## Аудит №10 — Release Candidate (public beta v2.0.0)

Цель: **можно ставить тег `v2.0.0-beta.1` и отдавать внешним тестерам** без стыда за security/ops.

### Уже достаточно для *private* beta
- put/get local + mesh, RS(4+2), repair, bootstrap  
- auth, voucher verify, identity  
- encrypt-at-rest (opt-in `--key`), payment gate, challenge, reputation  
- CI test workflow  

### P0 — must-fix до публичного beta

| ID | Критичность | Проблема | Требование |
|----|-------------|----------|------------|
| **REL-NONCE-01** | Высокая | File-level base nonce фиксирован `[0x5A;12]` + только `chunk_idx` в 4 байтах → **один и тот же key+chunk_idx** на разных файлах даёт reuse nonce (ChaCha20-Poly1305 catastrophic) | Уникальный random nonce на файл (хранить в envelope); per-chunk = file_nonce ⊕ chunk_idx или 96-bit random per chunk в manifest |
| **REL-VER-01** | Средняя | WS telemetry `version: "2.1.0-rust"`, CLI `2.0.0`, workspace `2.0.0` — рассинхрон | Единый `CARGO_PKG_VERSION` везде |
| **REL-SPEC-01** | Средняя | `PROTOCOL_WIRE_SPEC` / docs могут не знать StoreShard/FetchShard/PAYMENT payload | Обновить wire spec под 0x13–0x15 + payment reject semantics |
| **REL-KEY-01** | Средняя | `--key` hex в argv виден в `ps` | Документировать env `NEXXUS_FILE_KEY` или key file mode 0600; deprecate argv в README security notes |
| **REL-CHANGELOG-01** | Средняя | Нет CHANGELOG / GitHub Release notes | `CHANGELOG.md` с § beta.1: features + known SIM (Tor/PQC/io_uring/XDP) |
| **REL-BIND-01** | Низкая | Default `127.0.0.1` — ок; для mesh нужен явный public bind | README: предупреждение + пример `--p2p-bind 0.0.0.0:4000` + firewall |

### P1 — strongly recommended before wider beta

| ID | Задача |
|----|--------|
| **REL-SMOKE-01** | CI job: `cargo build -p nexxusd --release` + `nexxusd --help` + unit put/get in temp (уже частично test) |
| **REL-INSTALL-01** | `install.sh` проверяет `nexxusd put/get --help` после install; не обещает Node.js |
| **REL-IDENTITY-KEY-01** | `node_identity.json` chmod 0600 при save |
| **REL-SIM-BANNER-01** | `nexxusd status` одной строкой: список `[SIM]` modules (Tor/PQC/ZK/io_uring/XDP) — без иллюзий |
| **REL-TAG-01** | Annotated tag `v2.0.0-beta.1` после P0 |

### P2 — post-beta / v2.1

| ID | Задача |
|----|--------|
| FEAT-KAD-RPC, NAT, real QUIC, real Tor/PQC | Roadmap Аудита №6 |
| Opcode PaymentRequired explicit | Косметика протокола |
| por_log.jsonl persistence | Ops nicety |

### Known limitations (MUST в Release notes)

1. Tor / PQC / ZK-SNARK / io_uring / XDP / custom QUIC = **[SIM]**  
2. Нет NAT traversal — ноды должны быть reachable  
3. Encryption opt-in (`--key`), не default  
4. Payment gate = reputation throttle, не Lightning/on-chain  
5. Kad DHT in-memory only — discovery = bootstrap list  

---

## Definition of Done — Аудит №10 / RC

1. REL-NONCE-01 исправлен + тест двух файлов один key разные nonces  
2. REL-VER-01 единая версия  
3. REL-CHANGELOG-01 + known limitations  
4. REL-KEY-01 documented (env/file)  
5. REL-SPEC-01 wire opcodes актуальны  
6. Tag готов (или commit «rc ready»)

После закрытия №10 — **рекомендация: public beta**.  
Полный production (Tor live, PQC live, Kad RPC, NAT) = отдельные аудиты post-beta.

---

## Резолюция

**№9 закрыт** на `8788c07`.  
**№10 открыт** — P0 nonce/version/changelog/key hygiene/spec перед `v2.0.0-beta.1`.

— Grok (Гриша)  
9 ноября 2026
