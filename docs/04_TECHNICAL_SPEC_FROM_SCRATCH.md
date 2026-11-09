# Техническое задание: реализация аналога NeXXUs Node с нуля

**Документ для внешней команды разработки**  
**Цель:** воспроизвести функциональный уровень **NeXXUs v2.0.0-beta.1** (честный beta mesh storage node) без копирования кода под copyleft-ограничениями — как **независимая совместимая по идеям** реализация.  
**Язык реализации (рекомендуется):** Rust 2021, async на Tokio.  
**Оценка трудозатрат:** 20–40 чел.‑мес.; бюджет ориентир $350k–550k (см. экономический раздел).

---

## 1. Цели и границы

### 1.1 Must (MVP beta)

1. Content-addressed storage блоков 16 KiB и шардов 4 KiB (SHA-256).  
2. Reed-Solomon RS(4 data + 2 parity) на каждый 16 KiB chunk.  
3. File manifest (JSON): имя, размер, tail length, список chunk → 6 shard hashes.  
4. CLI: `serve`, `put`, `get`, `repair`, `status`, `peer-dial`.  
5. TCP binary framing: magic, version, opcode, request id, length, payload, CRC32.  
6. Session authentication (подписанный announce) до store/fetch данных.  
7. Persistent node identity (Ed25519), файл ключей с правами 0600.  
8. Опциональное шифрование at-rest (ChaCha20-Poly1305), **уникальный nonce на файл**.  
9. Раздача на пиры (`put --peers` / `get --peers`) и bootstrap list.  
10. Автотесты: unit RS, put/get bit-for-bit, потеря 2/6 шардов, live TCP auth, two-node mesh.  
11. Честный список нереализованных подсистем (не выдавать симуляции за production).

### 1.2 Should

- Reputation / throttle на fetch.  
- CLI challenge (PoR по хэшам).  
- CHANGELOG, smoke script, CI `cargo test`.  
- Repair с подтяжкой шардов с пиров.

### 1.3 Out of scope (фаза 2+)

- Реальный Tor/Arti onion services.  
- NIST ML-KEM production.  
- Полный Kademlia RPC поверх WAN.  
- NAT hole punching.  
- L1 токен и on-chain deals.  
- GUI.

---

## 2. Функциональные требования

### FR-1 Identity
- Генерация Ed25519; `node_id`, `verifying_key`, `onion_address` (опционально algorithm Tor v3).  
- `load_or_create(path)`.

### FR-2 CAS
- `store_blob(bytes) -> hash`, `fetch_blob(hash) -> bytes`, `delete_blob(hash)`.  
- Каталоги `shards/`, `manifests/`.

### FR-3 RS
- Вход строго 16384 байт; выход 6×4096.  
- Reconstruct при ≥4 любых шардах с корректными index.  
- Тест: все C(6,4) комбинации или эквивалентный quorum test.

### FR-4 Manifest
- Canonical JSON; `manifest_id = SHA-256(canonical_bytes)`.  
- Поля совместимы по смыслу с NeXXUs FileManifest.

### FR-5 Put/Get
- Put: chunk → pad → optional encrypt → RS → store shards → store manifest.  
- Get: reverse; bit-for-bit к исходному файлу.

### FR-6 Wire
- Спецификация кадра как в §3 техдокументации NeXXUs (или совместимый профиль).  
- Opcodes минимум: Ping/Pong, Store/Fetch Shard|Chunk + Ack, NodeAnnounce, error/payment reject.

### FR-7 Auth
- Без валидного announce — Store/Fetch прикладных данных отклонять.

### FR-8 Mesh
- Клиент: connect → auth → store/fetch shard.  
- `peers.json` + CLI bootstrap.

### FR-9 Repair
- Для каждого chunk: если шардов <6 но ≥4 — reconstruct missing и записать.

### FR-10 Encryption
- Random 96-bit file nonce; per-chunk unique derivation; key via env or file 0600; **запрещён** fixed global nonce.

---

## 3. Нефункциональные требования

| ID | Требование |
|----|------------|
| NFR-1 | `cargo test` зелёный в CI |
| NFR-2 | Release-сборка одного бинарника |
| NFR-3 | Логи без приватных ключей |
| NFR-4 | Документация: README + user guide + wire spec |
| NFR-5 | Явный `[SIM]` или «not implemented» для заготовок |
| NFR-6 | Время put 10 MiB локально: разумные секунды на commodity SSD (не жёсткий SLA) |

---

## 4. Этапы поставки

| Этап | Результат | Критерий приёмки |
|------|-----------|------------------|
| E1 | Core+CAS+RS | unit tests RS+CAS |
| E2 | Manifest put/get CLI | bit-for-bit file |
| E3 | Wire+auth+reactor | live TCP test |
| E4 | Mesh peers | two-node put wipe get |
| E5 | Enc+repair+release | nonce test, CHANGELOG, smoke |

---

## 5. Тест-план (минимум)

1. RS quorum 4/6.  
2. Put/get 1 byte, 16KiB, 16KiB+1, 50KiB.  
3. Encrypt put/get; disk ≠ plaintext.  
4. Two files same key → different nonces.  
5. Unauthenticated store rejected.  
6. Two processes mesh recovery.  
7. Repair after deleting 2 shards.

---

## 6. Стек (рекомендуемый)

- Rust, Tokio, tokio-util codec  
- ed25519-dalek, chacha20poly1305, sha2, crc32fast  
- clap, serde_json, tracing  

Допустимы Go/C++ при сохранении FR/NFR и тест-плана.

---

## 7. Критерии приёмки beta

- Все Must FR выполнены.  
- Тест-план зелёный.  
- README + user guide.  
- Нет заявлений «production Tor/PQC», если нет реализации.  
- Версия semver `x.y.z-beta.n`.

---

## 8. Экономика проекта (для заказчика)

| Статья | Оценка |
|--------|--------|
| Команда 4–6 | 6–10 мес. |
| Бюджет | **$350k–550k** realistic; $200k–350k lean; $550k–900k US/EU |

Не включает токен, мобильные клиенты, compliance.

---

## 9. Запреты

- Копировать код NeXXUs без соблюдения лицензии репозитория.  
- Подделывать бенчмарки и «fake peers» в status.  
- Использовать один nonce AEAD на много файлов с одним ключом.

---

## 10. Приложения

- Опираться на идеи: CAS (IPFS-like), EC (Storj/Sia-like), bilateral channels (Lightning-like offline), honest capability disclosure.  
- Референс поведения: публичный репозиторий NeXXUs и `docs/` настоящего комплекта.
