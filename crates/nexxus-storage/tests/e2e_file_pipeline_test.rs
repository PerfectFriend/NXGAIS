//! Integration tests for End-to-End File Put/Get & Reed-Solomon Pipeline
//!
//! Audit ID: TEST-FILE-E2E-01
//! Acceptance:
//! - Temp dir: put random 50KB -> get -> bytes equal (bit-for-bit)
//! - Delete 2 shards -> get всё ещё ok (RS 4+2 resilience)
//! - Delete 3 shards -> fail (below quorum threshold)

use nexxus_storage::{FileIngestEngine, StorageManager};

#[test]
fn test_e2e_file_put_get_and_rs_fault_tolerance() {
    let base_temp = std::env::temp_dir().join(format!("nexxus_e2e_file_test_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&base_temp);
    std::fs::create_dir_all(&base_temp).unwrap();

    let storage_dir = base_temp.join("storage");
    let storage = StorageManager::new(&storage_dir).unwrap();
    let engine = FileIngestEngine::new(&storage);

    // 1. Создаем псевдослучайный 50KB файл с высокой энтропией
    let test_file = base_temp.join("random_50kb.dat");
    let mut file_payload = vec![0u8; 50 * 1024];
    let mut seed = 0x12345678u64;
    for b in file_payload.iter_mut() {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        *b = (seed >> 33) as u8;
    }
    std::fs::write(&test_file, &file_payload).unwrap();

    // 2. Put: поглощение файла в CAS через RS(4+2)
    let (manifest, manifest_id) = engine.ingest_file(&test_file).unwrap();
    assert_eq!(manifest.file_size, 50 * 1024);
    assert_eq!(manifest.chunk_count, 4); // 50KB / 16KB = 3 full + 1 tail (2KB)
    assert_eq!(manifest.original_tail_len, 2 * 1024);

    // 3. Get: bit-for-bit восстановление
    let loaded_manifest = storage.load_manifest(&manifest_id).unwrap();
    let reconstructed = engine.retrieve_file(&loaded_manifest).unwrap();
    assert_eq!(reconstructed, file_payload, "Bit-for-bit verification failed!");

    for (ci, chunk) in manifest.chunks.iter().enumerate() {
        println!("Chunk {}:", ci);
        for s in &chunk.shard_hashes {
            println!("  idx {}: {}", s.index, s.hash);
        }
    }

    // 4. Потеря 2 шардов для первого чанка (где все 6 шардов имеют уникальные хеши):
    // удаляем шарды с индексом 1 и 4
    let target_chunk = &manifest.chunks[0];
    let h1 = hex::decode(&target_chunk.shard_hashes[1].hash).unwrap();
    let mut hash_bytes1 = [0u8; 32];
    hash_bytes1.copy_from_slice(&h1);
    let _ = storage.delete_shard(&hash_bytes1);

    let h4 = hex::decode(&target_chunk.shard_hashes[4].hash).unwrap();
    let mut hash_bytes4 = [0u8; 32];
    hash_bytes4.copy_from_slice(&h4);
    let _ = storage.delete_shard(&hash_bytes4);

    // Проверяем: при потере 2 шардов в чанке 0 файл ВСЁ ЕЩЁ восстанавливается bit-for-bit!
    let reconstructed_after_loss = engine.retrieve_file(&loaded_manifest).unwrap();
    assert_eq!(
        reconstructed_after_loss, file_payload,
        "RS(4+2) reconstruction failed after 2 lost shards!"
    );

    // 5. Потеря 3 шардов в чанке 0 (осталось 3 < 4): должно упасть с QuorumFailure
    let h2 = hex::decode(&target_chunk.shard_hashes[2].hash).unwrap();
    let mut hash_bytes2 = [0u8; 32];
    hash_bytes2.copy_from_slice(&h2);
    let _ = storage.delete_shard(&hash_bytes2);

    let fail_res = engine.retrieve_file(&loaded_manifest);
    assert!(
        fail_res.is_err(),
        "Reconstruction must fail when < 4 shards are available!"
    );

    let _ = std::fs::remove_dir_all(&base_temp);
}
