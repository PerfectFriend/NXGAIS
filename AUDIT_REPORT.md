# 📋 Отчёт независимого технического аудита NeXXUs

> **Аудитор**: Grok (Гриша)  
> **Исполнитель / кодер**: AI Studio Engine / Женя (GAIS)  
> **Куратор**: Главный архитектор  
> **Канонический репозиторий**: https://github.com/PerfectFriend/NeXXUs-Node  
> **Проверенный HEAD**: `e611ad5`  
> **Дата**: 9 ноября 2026, 22:37 CET  
> **Кодекс**: [Манифест v1.1](./MANIFEST_CANONICAL_AI_DEVELOPER.md)

---

## Статус аудитов

| Аудит | Статус | HEAD |
|-------|--------|------|
| №1–№9 | ✅ ЗАКРЫТЫ | ≤ `8788c07` |
| **№10 Release Candidate** | ✅ **ЗАКРЫТ** | **`e611ad5`** |

**Вердикт: `v2.0.0-beta.1` — РЕКОМЕНДОВАН к публичному beta-релизу**  
(с явным списком `[SIM]` и known limitations из CHANGELOG).

---

## Аудит №10 — закрытие по `e611ad5`

| ID | Статус | Проверка |
|----|--------|----------|
| **REL-NONCE-01** | ✅ | Random 96-bit file nonce + XOR chunk_idx; тест двух файлов один key → разные nonce/ciphertext |
| **REL-VER-01** | ✅ | `env!("CARGO_PKG_VERSION")` в CLI/WS/logs |
| **REL-SPEC-01** | ✅ | PROTOCOL_WIRE_SPEC + `PaymentRequired=0x16` |
| **REL-KEY-01** | ✅ | `NEXXUS_FILE_KEY` / `--key-file`; argv deprecated + warning |
| **REL-CHANGELOG-01** | ✅ | CHANGELOG.md Keep a Changelog + SIM disclaimer |
| **REL-BIND-01** | ✅ | README public bind + ufw |
| **REL-SMOKE-01** | ✅ | `scripts/smoke_test.sh` |
| **REL-INSTALL-01** | ✅ | install.sh post-check put/get --help |
| **REL-IDENTITY-KEY-01** | ✅ | identity file mode 0600 |
| **REL-SIM-BANNER-01** | ✅ | Одна строка `[SIM] Modules:` в status |

---

## Сравнение: до первого аудита → сейчас

### Было (около `44e43d1` / pre-audit honesty)

| Область | Состояние |
|---------|-----------|
| Честность | PQC/ZK/QUIC/io_uring/XDP позиционировались как production-grade (FIPS-203, Halo2, SQPOLL) |
| Маркеры | Почти нет `[SIM]` |
| PQC | Roundtrip encapsulate/decapsulate ломался |
| Install | Node.js LTS в основном пути |
| Daemon | В основном WebSocket UI + **захардкоженная** телеметрия (18 peers, SQPOLL ACTIVE) |
| P2P data plane | Фактически отсутствовал (codec in-memory) |
| Файл как продукт | Нет put/get |
| Auth / identity | Нет session auth, нет passport |
| Mesh | Нет distribute/repair/bootstrap |
| At-rest crypto | Нет default path |
| Тесты | «Много PASS» без live TCP / mesh / economy |
| Релиз | Нет CHANGELOG, smoke, единого version |

### Стало (`e611ad5`)

| Область | Состояние |
|---------|-----------|
| Честность | Манифест v1.1, `[SIM]` на всех незавершённых столпах, status banner |
| Crypto core | RS(4+2), ChaCha AEAD, Merkle PoR — **live** |
| Wire | Magic/CRC/opcodes, Store/Fetch shard+chunk, auth, payment reject |
| Daemon | Dual listener WS + **P2P TCP reactor** |
| Продукт | `put` / `get` / `repair` / `challenge` / `peers` / `peer-dial` |
| Mesh | `--peers`, bootstrap/`peers.json`, two-node E2E |
| Security | NodeAnnounce auth, voucher verify, identity 0600, enc-at-rest + unique nonces, rate limit |
| Economy | Reputation throttle → PAYMENT_REQUIRED |
| Ops | CI artifact, smoke_test.sh, CHANGELOG, install checks |
| Тесты | ~59 workspace tests, включая live TCP, mesh file, economy/at-rest |

**Смысл сдвига:** из «маркетингового прототипа с симуляциями» — в **честный beta mesh storage node** с работающим file pipeline и trust boundary.  
Это не Filecoin/Storj mainnet, но уже **проверяемый артефакт**, который можно ставить тестерам.

---

## Оценка: если бы делала человеческая команда

Оценка **порядка величины** (не коммерческий оффер), для достижения **сопоставимого** результата:

| Роль | Уровень | Занятость |
|------|---------|-----------|
| Rust systems / networking | Senior | 1 FTE |
| Storage / protocol (CAS, RS, manifests) | Mid–Senior | 1 FTE |
| Security / crypto integration | Senior (0.5–1) | part–full |
| QA / integration (mesh E2E, CI) | Mid | 0.5–1 FTE |
| Tech lead / product hygiene (docs, release) | Mid–Senior | 0.25–0.5 |

**Итого: 3–5 человек** (ядро 3: senior Rust + storage + QA/security hybrid).

| Сценарий | Календарное время |
|----------|-------------------|
| Старт с уже имеющимся «сырым» Rust-прототипом (как у вас до аудита) + жёсткий фокус | **3–5 месяцев** |
| С нуля до того же beta-качества | **6–10 месяцев** |
| С размытым scope и без дисциплины «честных SIM» | **9–15+ месяцев** (типичный срыв сроков на «почти как Kyber/QUIC») |

По трудозатратам грубо **8–18 человеко-месяцев** до RC beta при хорошей команде; меньше — только если резать mesh/economy/enc.

Что люди обычно делают **дольше**, чем AI-тандем здесь:
- вычищение ложных production claims и политическое «признание SIM»;
- стабилизация async TCP + auth edge cases;
- E2E multi-node flakiness;
- release hygiene (version/changelog/smoke), которую часто откладывают.

---

## Резолюция

1. **Аудиты №1–№10 закрыты.**  
2. **Рекомендация:** тег **`v2.0.0-beta.1`**, релиз notes = CHANGELOG + SIM list.  
3. Post-beta backlog (не блок релиза): real Tor/PQC, Kad RPC, NAT, default encryption policy, opcode-only payment path уже частично есть.

— Grok (Гриша)  
9 ноября 2026
