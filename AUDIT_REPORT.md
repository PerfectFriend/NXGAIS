# 📋 Отчёт независимого технического аудита NeXXUs

> **Аудитор**: Grok (Гриша)  
> **Исполнитель / кодер**: AI Studio Engine / Женя (GAIS)  
> **Куратор**: Главный архитектор  
> **Канонический репозиторий**: https://github.com/PerfectFriend/NeXXUs-Node  
> **HEAD**: `d30f103`  
> **Дата**: 9 ноября 2026, 01:24 CET  
> **Тип**: Аудит №6 — стратегический срез зрелости + roadmap функциональных улучшений  
> **Кодекс**: [Манифест v1.1](./MANIFEST_CANONICAL_AI_DEVELOPER.md)

---

## 0. Контекст

Аудиты **№1–№5 закрыты**. Beta mesh с trust boundary принят.  
Этот цикл — не «поиск багов», а **куда расти**, с опорой на то, что уже сильное в коде, и на рабочие идеи 2025–2026 в DePIN / P2P storage (Filecoin Pin + daily proofs, Storj EC+S3 UX, Swarm postage, Lightning/HTLC atomic retrieval, agentic P2P capability discovery, Ember PoP auth).

---

## 1. Карта зрелости (честный срез)

| Слой | Статус | Комментарий |
|------|--------|-------------|
| Content-addressed 16KB chunks | 🟢 LIVE | CAS `chunks/<sha256>` |
| Wire framing + CRC + auth session | 🟢 LIVE | NodeAnnounce Ed25519 |
| Store/Fetch/PoR/Voucher over TCP | 🟢 LIVE | E2E tests |
| DePIN state channels (offline settle) | 🟢 LIVE | verify_and_apply + persist |
| RS(4+2) codec | 🟡 LIB ONLY | Есть encode/reconstruct; **не вставлен** в store/disperse path |
| Self-healing + ASN HHI | 🟡 LIB ONLY | Логика выбора peer есть; **нет сетевого repair loop** |
| Kademlia table | 🟡 IN-PROC | Нет FIND_NODE RPC / bootstrap |
| Gossipsub | 🟡 IN-PROC | Нет fan-out |
| Client encrypt (ChaCha) | 🟡 LIB | Не default at-rest на CAS |
| Tor / Arti | 🔴 SIM | Маркер честный |
| PQC / ZK-SNARK PoR | 🔴 SIM | Маркер честный |
| User CLI upload/download file | 🔴 ABSENT | README ещё местами обещает; clap — нет |
| Multi-peer discovery | 🔴 ABSENT | Только ручной `peer-dial` |
| Periodic PoR schedule (PoSt-like) | 🔴 ABSENT | PoR по запросу, не по таймеру |

**Вывод:** ядро «chunk + wire + auth + bilateral DePIN» — готово.  
Нет **продуктового контура**: файл → шарды → N peers → retrieve → repair → оплата за retrieval.

---

## 2. Функциональные улучшения (приоритетный backlog)

### Tier A — максимальный ROI на уже существующем коде (1–2 спринта)

| ID | Идея | Зачем | Опора в коде / в индустрии |
|----|------|-------|----------------------------|
| **FEAT-FILE-01** | CLI `nexxusd put <file>` / `get <hash|manifest>` | Без этого нода — протокол, не продукт | Storj/S3 UX; README уже намекает |
| **FEAT-RS-PIPE-01** | Put: slice 16KB → RS(4+2) → 6 shard hashes в manifest → store shards | Использует **уже написанный** `encode_reed_solomon` | Storj/Sia EC; Filecoin piece packing |
| **FEAT-MANIFEST-01** | JSON/CBOR manifest: file_id, chunk digests, shard map, RS params, optional encryption envelope | Retrieve и repair без «угадывания» | IPFS DAG / CAR-like; Filecoin Pin pack |
| **FEAT-REPAIR-01** | Фоновый worker: detect missing shard → reconstruct из RS → push на peer (self_healing + dial) | Включает **MeshSelfHealingEngine** в runtime | Filecoin repair; Swarm recovery |
| **FEAT-PROVIDE-01** | `NodeAnnounce` + периодический provide: «держу hash X» в local Kad table + опционально gossip | Первый шаг к discovery без full Kad RPC | IPFS provider records |

### Tier B — экономика и доверие (как у лидеров DePIN 2026)

| ID | Идея | Зачем | Опора |
|----|------|-------|-------|
| **FEAT-RETRIEVE-PAY-01** | Fetch только после voucher/credit (atomic: pay ↔ bytes) | Сейчас Fetch бесплатен после auth — free-rider на download | IPFS-Sats HTLC/block-for-sats; ваши state channels |
| **FEAT-CHALLENGE-LOOP-01** | Scheduled PoR: раз в N часов challenge random sector по held chunks; лог/метрика | Аналог WindowPoSt / Filecoin Pin daily proofs — **без** chain | Filecoin PoSt cadence |
| **FEAT-REP-01** | Репутация peer: success fetch, PoR pass/fail, uptime → throttle (уже есть anti-free-rider зачатки) | Связать `PeerReputation` с reactor decisions | Storj reputation; Ember ban/filter |
| **FEAT-ENC-REST-01** | Default client-side ChaCha20-Poly1305 before CAS write; key в identity/envelope | CAS на диске сейчас plaintext | Storj client-side encrypt |

### Tier C — сеть и UX mesh

| ID | Идея | Зачем | Опора |
|----|------|-------|-------|
| **FEAT-BOOTSTRAP-01** | `peers.json` / `--bootstrap host:port,host:port` + auto-dial on serve | Иначе только ручной peer-dial | libp2p bootstrap; p2p-storage mDNS+DHT |
| **FEAT-KAD-RPC-01** | FIND_NODE / FIND_VALUE поверх WireCodec | Настоящий discovery content→peers | Классика Kademlia |
| **FEAT-NAT-01** | Hole punching или simple relay opcode | Домашние ноды за NAT | Ember/libp2p DCUtR |
| **FEAT-QUIC-REAL-01** | Заменить custom UDP SIM на `quinn` (опциональный transport) | Мультипоток, 0-RTT | Индустриальный стандарт |
| **FEAT-WS-API-01** | WebSocket: не только telemetry, а put/get/status JSON API для UI | Сближает daemon и dashboard | Уже есть WS bridge |

### Tier D — позже / осознанный SIM → LIVE

| ID | Идея |
|----|------|
| **PROD-TOR-01** | `arti-client` onion services |
| **PROD-PQC-01** | `ml-kem` / FIPS 203 crate hybrid |
| **PROD-ZK-01** | Реальный succinct PoR (arkworks/halo2) — только если нужен light client |
| **FEAT-AGENTIC-01** | Capability descriptors (storage_gb, asn, latency) для intent-routing — research track 2026 |

---

## 3. Рекомендуемый порядок (Definition of Roadmap)

```
Sprint 1 (продукт):   FEAT-FILE-01 + FEAT-MANIFEST-01 + FEAT-RS-PIPE-01
Sprint 2 (живучесть): FEAT-REPAIR-01 + FEAT-BOOTSTRAP-01 + FEAT-PROVIDE-01
Sprint 3 (экономика): FEAT-RETRIEVE-PAY-01 + FEAT-CHALLENGE-LOOP-01 + FEAT-ENC-REST-01
Sprint 4 (сеть):      FEAT-KAD-RPC-01 + FEAT-REP-01 + FEAT-WS-API-01
Later:                NAT, real QUIC, Tor, PQC
```

Критерий «готово к внешнему alpha»: Sprint 1–2 + auth/voucher из №5.

---

## 4. Чего **не** делать сейчас

- Не раздувать SIM-модули (io_uring/XDP/PQC) до «почти как настоящие» — либо crate, либо оставить `[SIM]`.  
- Не тащить on-chain FIL/токен, пока нет put/get/repair offline.  
- Не обещать в README CLI, которого нет в clap (уже чинили DOC-CLI-01 — держать sync).

---

## 5. Резолюция Аудита №6

**Статус:** информационный / roadmap — **замечания не блокирующие**.  
Проект после №5 — честный **beta protocol node**.  
Следующий качественный скачок — **file-level API + RS pipeline + repair**, опираясь на уже написанные `encode_reed_solomon` и `MeshSelfHealingEngine`.

Предложение куратору: выбрать Sprint 1 (FILE+MANIFEST+RS) как Аудит №7 DoD для GAIS.

— Grok (Гриша)  
9 ноября 2026
