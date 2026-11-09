# NeXXUs Protocol — Спецификация Бинарного Сетевого Протокола (Wire Protocol)
## Файл: `PROTOCOL_WIRE_SPEC.md` | Версия: 2.0.0 (Big-Endian Network Byte Order)

> **Статус**: Канонический протокольный стандарт. Источник истины для сетевого взаимодействия между всеми платформами (`nexxus-core` на Rust, Android/Kotlin, Linux Daemon / Web на TypeScript/WASM).

---

## 1. Базовые правила кодирования данных

1. **Порядок байтов (Endianness)**: строго **Big-Endian (сетевой порядок байт)** для всех 16-, 32- и 64-битных целых чисел без исключений.
2. **Строки и переменная длина**: строки кодируются в UTF-8 без null-терминатора (`\0`), с обязательным префиксом длины `uint16_be` или `uint32_be` байт. Запрещено использование строковых разделителей для парсинга бинарных структур.
3. **Хэши и криптографические идентификаторы**:
   - `NodeID`: ровно 32 байта (256 бит).
   - `ChunkHash`: ровно 32 байта (SHA-256 дайджест полезной нагрузки).
   - `OnionAddress`: 35 сырых байт (32 байта Ed25519 PubKey + 2 байта чексуммы + 1 байт версии 0x03) или 56 символов Base32 без суффикса `.onion` в бинарном wire-фрейме.
4. **Размер чанка хранения**: полезная нагрузка чанка составляет ровно **16,384 байта (16 KB)**.

---

## 2. Общий заголовок фрейма (Canonical Wire Header)

Каждое сообщение, передаваемое через TCP/TLS/WebSocket/Tor-сокет, начинается с единого фиксированного заголовка размером **46 байт**:

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|       Magic: 'N' 'E' 'X' 'X' (0x4E 0x45 0x58 0x58)           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|  Version (0x02)| Opcode (1B)   |     Request ID (bytes 0..1)   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|     Request ID (bytes 2..3)   |    Payload Length (bytes 0..1)|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|    Payload Length (bytes 2..3)|                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+                               +
|                                                               |
+                    SHA-256 Checksum (32 bytes)                +
|          Computed over: Opcode || RequestID || Length || Data  |
+                                                               +
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                      Payload (variable length)                |
|                              ...                              |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

### Поля заголовка (Header Fields Layout):

| Смещение (Bytes) | Длина (Bytes) | Тип | Название | Назначение |
|---|---|---|---|---|
| `0..3` | 4 | `uint8[4]` | `Magic` | Константа `0x4E 0x45 0x58 0x58` (ASCII `"NEXX"`). |
| `4` | 1 | `uint8` | `Version` | Версия протокола (на текущий момент `0x02`). При несовпадении версий — немедленный разрыв соединения с ошибкой `VERSION_MISMATCH`. |
| `5` | 1 | `uint8` | `Opcode` | Код операции из таблицы Opcodes (см. раздел 3). |
| `6..9` | 4 | `uint32_be` | `RequestId` | Уникальный монотонный или псевдослучайный идентификатор запроса (RPC Correlation ID). Ответ на запрос обязан возвращать точно такой же `RequestId`. |
| `10..13` | 4 | `uint32_be` | `PayloadLength` | Длина тела сообщения (Payload) в байтах. Для сообщений без тела равна `0x00000000`. |
| `14..45` | 32 | `uint8[32]` | `Checksum` | SHA-256 от конкатенации: `Opcode (1) || RequestId (4) || PayloadLength (4) || Payload (N)`. Защита от повреждения данных в потоке. |
| `46..N` | $N$ | `bytes` | `Payload` | Бинарное тело сообщения. |

---

## 3. Таблица Opcodes (Operation Codes Enum)

Числовые коды закреплены в Rust-ядре (`crates/nexxus-wire/src/lib.rs`). Перестановка, смена значений или удаление кодов категорически запрещены:

```rust
#[repr(u8)]
pub enum P2POpcode {
    Ping                 = 0x01,
    Pong                 = 0x02,
    StoreChunk           = 0x10,
    FetchChunk           = 0x11,
    ChunkStoredAck       = 0x12,
    StoreShard           = 0x13,
    FetchShard           = 0x14,
    ShardStoredAck       = 0x15,
    PaymentRequired      = 0x16,
    PorChallenge         = 0x30,
    PorResponse          = 0x31,
    NodeAnnounce         = 0x50,
    SmpMessage           = 0x60,
    StateChannelVoucher  = 0x61,
    Unknown              = 0xFF,
}
```

---

## 4. Точный формат тел сообщений (Payload Layout)

### 4.1. `PING` (0x01) и `PONG` (0x02)
- **Тело запроса `PING`**:
  - `timestamp_ms` (`uint64_be`, 8 байт) — текущее время отправителя Unix Timestamp в миллисекундах.
  - `nonce` (`uint32_be`, 4 байта) — случайный проверочный код.
- **Тело ответа `PONG`**:
  - `echo_timestamp_ms` (`uint64_be`, 8 байт) — копия `timestamp_ms` из `PING`.
  - `echo_nonce` (`uint32_be`, 4 байта) — копия `nonce` из `PING`.
  - `responder_uptime_sec` (`uint32_be`, 4 байта) — аптайм узла в секундах.

### 4.2. `NODE_ANNOUNCE` (0x50) — Аутентификация сессии
Рукопожатие при установлении P2P соединения:
- `node_id` (`String` UTF-8, 32+ байт): криптографический идентификатор узла.
- `verifying_key` (`uint8[32]`, 32 байта): публичный ключ Ed25519.
- `onion_address` (`String` UTF-8): адрес Tor Onion v3.
- `signature` (`uint8[64]`, 64 байта): подпись Ed25519 над солью соединения.

### 4.3. `STORE_SHARD` (0x13) и `SHARD_STORED_ACK` (0x15)
Хранение шардов Reed-Solomon (4+2):
- **`STORE_SHARD` (0x13)**:
  - Полезная нагрузка: ровно 4096 байт данных шарда.
  - Сохраняется в Content-Addressable Storage (CAS) под именем `SHA-256(shard_data)`.
- **`SHARD_STORED_ACK` (0x15)**:
  - Возвращает 32 байта `SHA-256` подтверждённого сохранённого шарда.

### 4.4. `FETCH_SHARD` (0x14) и `FETCH_CHUNK` (0x11)
- **`FETCH_SHARD` (0x14)**:
  - Запрос: 32 байта `SHA-256` хеш запрашиваемого шарда.
  - Успешный ответ: 4096 байт тела шарда.
- **`FETCH_CHUNK` (0x11)**:
  - Запрос: 32 байта `SHA-256` хеш запрашиваемого чанка.
  - Успешный ответ: 16,384 байт тела чанка.

### 4.5. Экономический гейт и отказ `PAYMENT_REQUIRED` (0x16)
Для защиты от паразитных узлов (Anti-Free-Rider Defense):
- Перед отдачей данных по `FetchChunk` или `FetchShard` проверяется статус узла в децентрализованном движке `DePinBarterEngine`.
- Если узел-запросчик задротлен (`is_peer_throttled() == true`) из-за отрицательного баланса или падения репутации (reputation score $\le 0.2$), запрос немедленно отклоняется.
- Ответ формируется с опкодом `P2POpcode::PaymentRequired (0x16)` либо с телом `b"PAYMENT_REQUIRED"`.
- Для разблокировки узел обязан предоставить подписанный ваучер состояния (`StateChannelVoucher 0x61`) или накопить положительный взаимный баланс.

### 4.6. `POR_CHALLENGE` (0x30) и `POR_RESPONSE` (0x31)
Криптографический аудит хранения Proof-of-Retrievability:
- **`POR_CHALLENGE` (0x30)**:
  - `chunk_hash` (`uint8[32]`, 32 байта) — хэш проверяемого блока/шарда.
  - `challenge_seed` (`uint8[32]`, 32 байта) — случайное зерно аудитора $s \in \{0,1\}^{256}$.
- **`POR_RESPONSE` (0x31)**:
  - `response_hash` (`uint8[32]`, 32 байта) — криптографический ответ $\text{SHA-256}(\text{data} \parallel \text{challenge\_seed})$.
  - `chunk_hash` (`uint8[32]`, 32 байта)
  - `response_hash` (`uint8[32]`, 32 байта) — криптографический ответ $\text{SHA-256}(\text{chunk\_data} \parallel \text{challenge\_seed})$.
  - `duration_ms` (`uint32_be`, 4 байта) — замеренное время вычисления ответа.

### 4.6. `EPOCH_FINALIZE` (0x0C)
Завершение суточной эпохи и запуск 8-недельного (56 дней) вестинга:
- `epoch_number` (`uint32_be`, 4 байта) — монотонный счетчик эпохи.
- `epoch_merkle_root` (`uint8[32]`, 32 байта) — Merkle-корень распределения наград за хранение.
- `total_active_storage_bytes` (`uint64_be`, 8 байт) — суммарный подтвержденный объем полезного хранения в сети.
- `committee_signature_length` (`uint16_be`, 2 байта) — длина агрегированной подписи аудиторского комитета (BLS / Multi-Ed25519).
- `committee_signature` (`bytes`) — криптографическая подпись кворума.

---

## 5. Обработка ошибок (`ERROR_RESPONSE` 0xFF)
- `error_code` (`uint16_be`, 2 байта):
  - `0x0001` — `ERR_MALFORMED_HEADER`
  - `0x0002` — `ERR_CHECKSUM_INVALID`
  - `0x0003` — `ERR_VERSION_UNSUPPORTED`
  - `0x0004` — `ERR_UNKNOWN_OPCODE`
  - `0x0005` — `ERR_TIMEOUT_POR_DEADLINE`
  - `0x0006` — `ERR_CHURN_QUORUM_LOST`
- `message_len` (`uint16_be`, 2 байта)
- `message_utf8` (`bytes`) — читаемое описание ошибки на английском языке.
