# 📋 Отчёт независимого технического аудита NeXXUs

> **Аудитор**: Grok (Гриша)  
> **Исполнитель / кодер**: AI Studio Engine / Женя (GAIS)  
> **Куратор**: Главный архитектор  
> **Канонический репозиторий**: https://github.com/PerfectFriend/NeXXUs-Node  
> **HEAD на момент аудита**: `d3a01bd`  
> **Дата**: 9 ноября 2026, 01:03 CET  
> **Кодекс**: [Манифест v1.1](./MANIFEST_CANONICAL_AI_DEVELOPER.md)

---

## Статус аудитов

| Аудит | Статус | HEAD |
|-------|--------|------|
| №1–№4 | ✅ ЗАКРЫТЫ | ≤ `718071f` / `d3a01bd` |
| **№5 Production hardening** | 🔴 **ВЫПОЛНЕН — замечания открыты** | этот отчёт |

---

## Аудит №5 — Production hardening

Цель: от «работает в lab / E2E test» к **безопасному beta mesh** (неполный prod, но без дыр в trust model).

### 1. ✅ Уже в синей зоне (не трогать без нужды)

| Компонент | Примечание |
|-----------|------------|
| WireCodec magic / version / CRC32 | Ок |
| `MAX_PAYLOAD_SIZE` = 16 MB в Decoder | Ок (есть) |
| CAS `store_chunk` / `fetch_chunk` | Ок |
| TCP P2P reactor + live/E2E tests | Ок |
| `[SIM]` маркеры на незавершённых столпах | Ок |
| `apply_signed_voucher` **в библиотеке** | Проверяет sequence + `verify_signature` |

---

### 2. ⚠️ Красная зона — новые требования

| ID | Критичность | Где | Проблема | Требование / рекомендация |
|----|-------------|-----|----------|---------------------------|
| **SEC-VOUCHER-01** | **Высокая** | `handle_p2p_peer` StateChannelVoucher | Reactor **не** вызывает `verify_signature`. При **неизвестном** `channel_id` отдаёт soft-ack (`VOUCHER_VERIFIED_AND_SETTLED`) без канала и без ключа. При известном канале обновляет commitment **без** проверки подписи. Библиотечный `apply_signed_voucher` сделан правильно — **wire path его обходит**. | 1) Reject-by-default unknown channel → `VOUCHER_UNKNOWN_CHANNEL`. 2) Всегда `verify_signature` с ключом peer из канала / announce. 3) Использовать `apply_signed_voucher`, не ручной assign. 4) Тест: bad sig → reject; unknown → reject; stale seq → reject. |
| **SEC-AUTH-01** | **Высокая** | P2P reactor | Любой TCP-клиент может StoreChunk / заполнять диск / слать voucher. Нет Hello / challenge-response / node identity на сессии. | Минимум: opcode `NodeHello` (0x50 уже NodeAnnounce) с Ed25519 pubkey + подпись challenge; session table `peer_addr → VerifyingKey`. Без hello — только Ping; Store/Voucher — после auth. |
| **SEC-IDENTITY-01** | Средняя | daemon startup | Нет persistent node passport (`node_identity.json`): SigningKey на диске, node_id, onion derivation. Hardcoded `"nx_node_beelink_ser9"` в telemetry. | При `serve`: load-or-create identity в `storage_dir`; status/WS показывают реальный node_id. |
| **SEC-RATE-01** | Средняя | reactor | Нет per-peer rate limit / max concurrent stores. 16MB frame limit есть, но flood StoreChunk возможен. | Token bucket или max N StoreChunk/sec/peer; опционально max disk for unauthenticated (после AUTH). |
| **DOC-CLI-01** | Средняя | README / install | Слабо задокументированы: `serve --p2p-bind`, `peer-dial`, layout `chunks/`, dual ports 3999/4000. README ещё упоминает `nexxusd upload` и др. CLI, которых нет. | Синхронизировать README с реальным clap; секция «P2P mesh quickstart» (2 ноды). |
| **CI-ARTIFACT-01** | Низкая | CI | Нет артефакта `cargo test` log для аудитора; workflow в `scripts/ci-release.yml`. | GitHub Action: test + upload log; или `tests-report.txt` в release. |
| **OPCODE-SIZE-01** | Низкая | StoreChunk path | Store принимает payload ≠ 16KB (hash-only branch). Для CAS строгий 16KB в `store_chunk` — ок, но peer может слать мусор. | Явный NACK opcode или error frame при wrong size (сейчас всё равно ACK с hash). |

---

### 3. Definition of Done — закрытие Аудита №5

**Must-have (без этого №5 не закрываем):**

1. **SEC-VOUCHER-01** — wire path = library path (verify + reject unknown/stale/bad sig) + ≥2 теста.  
2. **SEC-AUTH-01** — session auth до Store/Voucher (можно упрощённый Hello + static test keys) + тест.  
3. **SEC-IDENTITY-01** — persistent identity file load-or-create.  
4. **DOC-CLI-01** — README: реальные команды serve/peer-dial/status, ports, `chunks/`.

**Should-have:**

5. **SEC-RATE-01** — простой limit.  
6. **OPCODE-SIZE-01** — NACK на != 16KB Store.  
7. **CI-ARTIFACT-01** — test log в CI.

**Out of scope №5 (остаётся roadmap):** real Tor/Arti, real ML-KEM, Kad RPC, Gossip fan-out.

---

### 4. Приоритет для GAIS

```
P0  SEC-VOUCHER-01
P0  SEC-AUTH-01
P1  SEC-IDENTITY-01
P1  DOC-CLI-01
P2  SEC-RATE-01, OPCODE-SIZE-01, CI-ARTIFACT-01
```

---

### 5. Резолюция

**Аудит №5 не закрыт.**  

После №1–№4 mesh **функционально** живой. №5 требует **trust boundary**: подпись ваучеров на wire, auth сессии, identity ноды, честный README.

Как только push с P0+P1 — re-check и закрытие №5.

— Grok (Гриша)  
9 ноября 2026
