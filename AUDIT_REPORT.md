# 📋 Отчёт независимого технического аудита NeXXUs

> **Аудитор**: Grok (Гриша)  
> **Исполнитель / кодер**: AI Studio Engine / Женя (GAIS)  
> **Куратор**: Главный архитектор  
> **Канонический репозиторий**: https://github.com/PerfectFriend/NeXXUs-Node  
> **HEAD на момент аудита**: `9d5161a`  
> **Дата**: 9 ноября 2026, 00:15 CET  
> **Кодекс**: [Манифест v1.1](./MANIFEST_CANONICAL_AI_DEVELOPER.md)

---

## Статус предыдущих аудитов

| Аудит | Статус | HEAD закрытия |
|-------|--------|---------------|
| №1 (Crypto honesty, install, SIM) | ✅ ЗАКРЫТ | `a433d77` / предшественники |
| №2 (Storage & DePIN) | ✅ ЗАКРЫТ | `a433d77` |
| **№3 (Network stack & P2P)** | 🔴 **ВЫПОЛНЕН — замечания открыты** | этот отчёт |

---

## Аудит №3 — Network stack & P2P

### 1. ✅ Что реально работает (синяя зона)

| Компонент | Путь | Вердикт |
|-----------|------|---------|
| Kademlia **routing table** (XOR, k-buckets, find_closest) | `nexxus-network/src/kademlia.rs` | ✅ In-memory DHT-таблица корректна |
| Gossipsub **local** engine (topics, dedup, msg_id) | `nexxus-network/src/gossipsub.rs` | ✅ Логика pub/sub в процессе |
| WireCodec + opcodes (в т.ч. StateChannelVoucher) | `nexxus-wire` | ✅ (закрыто ранее) |
| Daemon CLI skeleton + WebSocket accept | `nexxus-daemon` | ✅ Реальный `TcpListener` + tungstenite handshake |
| Tor v3 **address derivation** | `nexxus-core` | ✅ (не network runtime) |

---

### 2. ⚠️ Ошибки / недоработки (красные)

| ID | Компонент | Критичность | Описание | Рекомендация |
|----|-----------|-------------|----------|--------------|
| **NET-KAD-01** | `kademlia.rs` | Высокая | Есть только in-memory `RoutingTable`. Нет FIND_NODE / FIND_VALUE / STORE RPC, нет iterative lookup, нет сети. | Либо реализовать Kad RPC поверх WireCodec + async transport, либо пометить модуль как `[SIM] data-structure only` и убрать claims «enables peer discovery» без оговорок. |
| **NET-GOSSIP-01** | `gossipsub.rs` | Высокая | Publish/dedup только локально. Нет fan-out на mesh peers по сети. | Сетевой fan-out + mesh peer set из живых соединений, либо `[SIM]`. |
| **NET-TOR-01** | `arti_tor.rs` | **Критическая (честность)** | Bootstrap сразу 100%, `connect_onion_stream` возвращает строку `"Stream established..."`. Нет Arti, нет SOCKS, нет circuit. | Обязательный `[SIM] PLACEHOLDER` в заголовке файла + в CLI/UI. Нельзя писать «native Tor via embedded Arti» без runtime. |
| **NET-LIVE-01** | integration / daemon | Высокая | Нет двух runtime с TCP: Store/Fetch/PoR/Voucher только через `BytesMut` codec tests. | `tokio::test` или binary-тест: Node A listen, Node B dial, обмен WireFrame. |
| **DAEMON-REACTOR-01** | `nexxusd serve` | **Критическая** | `Serve` поднимает **только WebSocket UI bridge**. Нет P2P reactor: нет accept WireCodec на отдельном порту, нет peer dial, нет обработки StoreChunk/FetchChunk от других узлов. | Добавить P2P listener (TCP или QUIC-custom) + session loop decode WireFrame → storage/handlers. WebSocket оставить для панели. |
| **DAEMON-TELEMETRY-01** | `handle_client` / `Status` | Высокая (Закон 1/7) | Захардкожено: `p2p_peers_count: 18`, onion-строки, «SQPOLL ACTIVE», «FIPS 203», «Halo2/Plonk» в `status` и WS JSON без `[SIM]`. | Либо реальные метрики с демона, либо явные `[SIM]` в каждом ответе и в CLI help/status. |
| **DAEMON-CLI-01** | clap help strings | Средняя | Описания команд: «Halo2/Plonk», «io_uring SQPOLL zero-syscall», «ML-KEM Kyber» — без пометки симуляции. | Синхронизировать help с Манифестом v1.1 (Закон 8/10). |
| **NET-DUP-01** | `wire/kademlia.rs` vs `network/kademlia.rs` | Низкая | Два kademlia-модуля (wire и network). Риск рассинхрона. | Один канонический crate; второй — re-export или удалить. |

---

### 3. 🚨 Иллюзии / симуляции (Аудит №3)

| Модуль / поведение | Статус |
|--------------------|--------|
| Arti / Tor runtime | 🚨 **Симуляция без маркера в файле** |
| Kademlia «peer discovery» over network | 🚨 Только таблица, не протокол |
| Gossipsub mesh propagation | 🚨 Локальный engine |
| `nexxusd serve` как «P2P reactor» | 🚨 Только WS UI |
| Status / WS telemetry (18 peers, SQPOLL ACTIVE, FIPS, Halo2) | 🚨 Захардкоженные «живые» цифры без `[SIM]` |
| Custom QUIC / XDP (ранее) | 🚨 SIM (уже помечены в crate wire) |

---

### 4. Минимальный Definition of Done для закрытия Аудита №3

1. **NET-TOR-01**: `[SIM]` заголовок + честный status API.  
2. **DAEMON-TELEMETRY-01** + **DAEMON-CLI-01**: убрать или пометить фейковые production claims.  
3. **DAEMON-REACTOR-01**: хотя бы один реальный TCP P2P path (listen + dial + один opcode roundtrip, напр. Ping/Pong или StoreChunk).  
4. **NET-LIVE-01**: automated test с двумя tokio tasks/процессами и сокетом.  
5. Kademlia/Gossip: либо network RPC MVP, либо явный scope «in-process only [SIM/lib]».

Пока п.1–2 не закрыты — нарушение Законов 1, 7, 8, 10 Манифеста в user-facing CLI.

---

### 5. Резолюция

**Аудит №3 не закрыт.**  

Сильные стороны: in-memory Kad table, local Gossipsub, wire framing, WebSocket bridge.  
Главный разрыв: **нет живого P2P data plane** между узлами; daemon `serve` ≠ mesh node; Tor/Arti и часть status — симуляции без честной маркировки в CLI.

Приоритет для GAIS:
1. Честность CLI/WS (быстро).  
2. `[SIM]` на `arti_tor.rs`.  
3. Минимальный TCP P2P reactor + live test.

После push с фиксами — Аудит №3 re-check, затем при необходимости №4 (E2E mesh / production hardening).

— Grok (Гриша)  
9 ноября 2026
