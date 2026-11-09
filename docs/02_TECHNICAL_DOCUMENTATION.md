# Техническая документация NeXXUs Node v2.0.0-beta.1

## 1. Назначение

NeXXUs — суверенная нода децентрализованного хранения: файл режется на блоки 16 KB, кодируется Reed-Solomon RS(4+2), хранится в content-addressed storage (CAS), может быть распределён по mesh-пирам по бинарному TCP-протоколу с аутентификацией сессии.

## 2. Архитектура workspace

```
crates/
  nexxus-core      — константы, ошибки, Tor v3 address derivation
  nexxus-crypto    — RS(4+2), ChaCha20-Poly1305, Merkle, [SIM] PQC/ZK
  nexxus-wire      — WireCodec, opcodes, NodeAnnounce, [SIM] QUIC/XDP
  nexxus-storage   — CAS, manifest, file_ingest, state_channel, identity, direct_io
  nexxus-network   — Kademlia table [in-proc], gossip [in-proc], arti [SIM]
  nexxus-daemon    — CLI nexxusd, WS bridge, P2P reactor, mesh_client
  nexxus-wasm      — WASM bindings (ограниченный surface)
```

Бинарник: **`nexxusd`**.

## 3. Константы протокола

| Имя | Значение |
|-----|----------|
| Magic | `NEXX` (`0x4E455858`) |
| Protocol version | `2` |
| CHUNK_SIZE | 16384 bytes |
| RS data / parity / total | 4 / 2 / 6 |
| SHARD_SIZE | 4096 bytes |
| Default WS bind | `127.0.0.1:3999` |
| Default P2P bind | `127.0.0.1:4000` |

## 4. Wire frame

```
Magic(4) | Version(1) | Opcode(1) | RequestId(4) | Length(4) | Payload(N) | CRC32(4)
```

Ключевые opcodes: Ping/Pong, StoreChunk/FetchChunk/ChunkStoredAck, StoreShard/FetchShard/ShardStoredAck, PaymentRequired, PorChallenge/Response, NodeAnnounce, StateChannelVoucher.

Лимит payload: 16 MB (Decoder).

## 5. File pipeline

1. **put**: read file → pad last chunk → optional ChaCha (random file nonce, per-chunk nonce = file_nonce⊕idx) → RS encode → `store_shard` ×6 → write `manifests/<id>.json`.
2. **get**: load manifest → fetch ≥4 shards/chunk (local or `--peers`) → reconstruct → decrypt if envelope → strip tail → write output.
3. **repair**: missing shards → reconstruct → store; optional peer pull/push.

Manifest fields: version, file_name, file_size, chunk_count, rs_data, rs_total, original_tail_len, chunks[], optional encryption envelope.

## 6. Security model (beta)

- **Identity:** Ed25519 in `node_identity.json` (mode 0600), Tor v3 address derived.
- **Session:** NodeAnnounce signed payload before Store/Fetch of economic interest.
- **Voucher:** `verify_and_apply_voucher` — unknown/stale/bad sig/conservation reject.
- **At-rest:** opt-in AEAD; unique per-file nonce (REL-NONCE-01).
- **Anti-freerider:** reputation decay; throttled peer gets PAYMENT_REQUIRED on fetch.

## 7. Storage layout

```
$STORAGE_DIR/
  node_identity.json
  peers.json
  depin_state.json
  chunks/          # legacy/full chunk CAS (where used)
  shards/          # 4KB RS shard CAS by sha256
  manifests/       # <manifest_id>.json
```

## 8. CLI (основные)

```bash
nexxusd serve --p2p-bind 0.0.0.0:4000 --storage-dir /var/lib/nexxus --bootstrap host:4000
nexxusd put ./file.pdf -s /var/lib/nexxus --peers 10.0.0.2:4000 --key-file ./file.key
nexxusd get <manifest_id> -o ./out.pdf -s /var/lib/nexxus --peers 10.0.0.2:4000 --key-file ./file.key
nexxusd repair <manifest_id> -s /var/lib/nexxus --peers 10.0.0.2:4000
nexxusd challenge --all -s /var/lib/nexxus
nexxusd peers -s /var/lib/nexxus
nexxusd status -s /var/lib/nexxus
nexxusd peer-dial --addr 10.0.0.2:4000
```

Ключ: `NEXXUS_FILE_KEY` (64 hex chars) или `--key-file` (предпочтительно). `--key` в argv устарел.

## 9. Сборка и проверка

```bash
cargo build -p nexxusd --release
cargo test --workspace
./scripts/smoke_test.sh
```

## 10. [SIM] modules

Tor transport, PQC ML-KEM, ZK-SNARK PoR, io_uring SQPOLL, eBPF/XDP, Kademlia network RPC — см. CHANGELOG и `nexxusd status`.

## 11. Ссылки в репозитории

- `PROTOCOL_WIRE_SPEC.md` — бинарный протокол  
- `CHANGELOG.md` — релизы  
- `AUDIT_REPORT.md` — журнал аудита  
- `MANIFEST_CANONICAL_AI_DEVELOPER.md` — правила честной разработки  
