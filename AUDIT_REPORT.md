# 📋 Отчёт независимого технического аудита NeXXUs

> **Аудитор**: Grok (Гриша)  
> **Исполнитель / кодер**: AI Studio Engine / Женя (GAIS)  
> **Куратор**: Главный архитектор  
> **Канонический репозиторий**: https://github.com/PerfectFriend/NeXXUs-Node  
> **Базовый HEAD**: `c2e7819` (после Аудита №6)  
> **Дата**: 9 ноября 2026, 01:28 CET  
> **Тип**: **Аудит №7 — приоритетные задачи Sprint 1 (продуктовый контур)**  
> **Кодекс**: [Манифест v1.1](./MANIFEST_CANONICAL_AI_DEVELOPER.md)

---

## 0. Цель Аудита №7

Превратить beta **protocol node** в минимальный **продукт**:

```
файл → 16KB chunks → RS(4+2) shards → CAS → manifest
manifest → fetch shards → reconstruct → файл
```

Опираемся **только** на уже существующее:
- `encode_reed_solomon` / `reconstruct_reed_solomon` (`nexxus-crypto`)
- `StorageManager::store_chunk` / `fetch_chunk` (CAS)
- Wire Store/Fetch + auth (Аудит №5)
- Константы `CHUNK_SIZE_BYTES=16384`, `RS_DATA_SHARDS=4`, `RS_TOTAL_SHARDS=6`

Аудиты №1–№6 закрыты. №7 — **исполнимый backlog**, не закрыт до выполнения DoD.

---

## 1. Приоритетные задачи (P0 → P1)

### P0 — без этого Sprint 1 не принимается

| ID | Задача | Где | Детали / acceptance |
|----|--------|-----|---------------------|
| **FEAT-MANIFEST-01** | Формат манифеста файла | `nexxus-storage` (новый `manifest.rs` или в `lib.rs`) | Структура (serde JSON): `version`, `file_name`, `file_size`, `chunk_count`, `rs_data=4`, `rs_total=6`, `chunks[]` где каждый chunk: `index`, `chunk_sha256`, `shard_hashes[6]` (hex). Content-address манифеста = SHA-256 канонического JSON (или отдельное поле `manifest_id`). Unit-тест roundtrip serialize. |
| **FEAT-RS-PIPE-01** | Encode path: chunk → 6 shards → CAS | `StorageManager` или `FileIngestEngine` | На каждый 16KB (последний chunk — zero-pad до 16KB, в манифесте `original_tail_len`): `encode_reed_solomon` → store каждого shard как отдельный CAS-объект (ключ = hash shard payload **или** явный shard id в meta; предпочтительно CAS по hash содержимого shard). Не хранить полный chunk, если политика «только shards» — тогда reconstruct на get; **допустимо** хранить и chunk, и shards для MVP, но в манифесте должны быть **shard_hashes**. Тест: encode → 6 store → reconstruct из любых 4. |
| **FEAT-FILE-PUT-01** | CLI `nexxusd put <path>` | `nexxus-daemon` | Читает файл, режет на 16KB, RS-pipe, пишет manifest в `storage_dir/manifests/<manifest_id>.json`, печатает `manifest_id` + size. Exit 0. Ошибка на missing file. |
| **FEAT-FILE-GET-01** | CLI `nexxusd get <manifest_id> [-o out]` | `nexxus-daemon` | Грузит manifest, для каждого chunk собирает ≥4 shards (fetch_chunk), `reconstruct_reed_solomon`, пишет файл (обрезает tail). Bit-for-bit compare с исходником в тесте. |

### P1 — сильно желательно в том же спринте

| ID | Задача | Где | Acceptance |
|----|--------|-----|------------|
| **FEAT-FILE-PUT-NET-01** | `put --peers host:port,...` | daemon | После local RS-store: для каждого shard (или replica policy 2-of-6) auth+StoreChunk на peer. Минимум 1 remote peer в integration-тесте. |
| **FEAT-FILE-GET-NET-01** | `get` с fallback на peers | daemon | Если локального shard нет — FetchChunk с bootstrap/peer list. |
| **TEST-FILE-E2E-01** | Интеграционный тест | `nexxus-storage` или `nexxus-network/tests` | Temp dir: put random 50KB → get → bytes equal; удалить 2 shards → get всё ещё ok (RS); удалить 3 → fail. |
| **DOC-FILE-01** | README | `README.md` | Секция Put/Get + формат manifest + пример двух команд. Убрать/не обещать несуществующий `upload`, если его нет. |

### P2 — не блокирует закрытие №7 (можно №8)

| ID | Задача |
|----|--------|
| **FEAT-REPAIR-01** | Background repair из Аудита №6 |
| **FEAT-BOOTSTRAP-01** | `--bootstrap` auto-dial |
| **FEAT-ENC-REST-01** | Encrypt before CAS |
| **FEAT-RETRIEVE-PAY-01** | Fetch gated by voucher |

---

## 2. Definition of Done — закрытие Аудита №7

Обязательно (все пункты):

1. ✅ `nexxusd put <file>` создаёт manifest + RS shards в CAS  
2. ✅ `nexxusd get <manifest_id>` восстанавливает файл bit-for-bit  
3. ✅ Тест: RS переживает потерю **2** shards из 6 на chunk  
4. ✅ Манифест документирован (структура в коде + README)  
5. ✅ `cargo test --workspace` зелёный; новые тесты в отчёте GAIS  
6. ✅ DEVELOPMENT_LOG: Этап под Аудит №7 с ID FEAT-*  

Опционально для «№7+»: put/get через один remote peer (P1 net).

---

## 3. Нефункциональные ограничения (Манифест)

- Не выдавать put/get за «полный Filecoin» — это **local (+ optional peer) RS CAS**.  
- Любой новый SIM только с `[SIM]` и Audit ID.  
- Не тащить token/on-chain в Sprint 1.  
- Signing key / identity — не логировать в plaintext в put/get output.

---

## 4. Подсказки по API (уже в репо)

```text
encode_reed_solomon(data: &[u8; 16384-ish]) -> Vec<Shard>  // len == CHUNK_SIZE_BYTES
reconstruct_reed_solomon(available: &[Shard]) -> Vec<u8>   // need >= 4 shards
StorageManager::store_chunk(&[u8]) -> [u8; 32]
StorageManager::fetch_chunk(&[u8; 32]) -> Vec<u8>
```

Рекомендация: shard в CAS как raw `shard.data` фиксированной `SHARD_SIZE_BYTES`; в manifest — hash этого blob. При reconstruct собирать `Shard { index, data }`.

---

## 5. Резолюция

**Аудит №7 открыт.**  
Приоритет для GAIS: **P0** (MANIFEST → RS-PIPE → PUT → GET → TEST) за один спринт.  
После push с DoD — re-check и закрытие №7; затем №8 = repair + bootstrap (Tier A хвост / Tier B).

— Grok (Гриша)  
9 ноября 2026
