//! Integration & Formal Verification for Post-Quantum Kyber-768 and ZK-SNARK PoR

use nexxus_crypto::{PqcHybridEngine, ZkSnarkEngine, KYBER768_CIPHERTEXT_BYTES, KYBER768_PUBLIC_KEY_BYTES, SNARK_PROOF_BYTES};

#[test]
fn test_post_quantum_hybrid_kyber_768_full_flow() {
    let seed_alice = [0x31u8; 32];
    let alice = PqcHybridEngine::generate_keypair(&seed_alice).unwrap();
    assert_eq!(alice.kyber_public.len(), KYBER768_PUBLIC_KEY_BYTES);

    let seed_bob = [0x55u8; 32];
    let (encap, shared_bob) = PqcHybridEngine::encapsulate(&alice.classical_public, &alice.kyber_public, &seed_bob).unwrap();
    assert_eq!(encap.algorithm, "X25519+ML-KEM-768/FIPS-203");
    assert_eq!(hex::decode(&encap.kyber_ciphertext_hex).unwrap().len(), KYBER768_CIPHERTEXT_BYTES);

    let shared_alice = PqcHybridEngine::decapsulate(&encap, &alice).unwrap();
    assert_eq!(shared_alice.len(), 32);
    assert_eq!(shared_bob.len(), 32);

    // 16 KB Chunk Encryption Roundtrip
    let mut chunk = vec![0u8; 16384];
    for (i, b) in chunk.iter_mut().enumerate() {
        *b = ((i * 19 + 7) & 0xff) as u8;
    }

    let (chunk_encap, ct) = PqcHybridEngine::encrypt_chunk_pqc(&chunk, &alice.classical_public, &alice.kyber_public, &seed_bob).unwrap();
    assert_eq!(ct.len(), 16384 + 16); // AEAD 16-byte Poly1305 tag

    let decrypted = PqcHybridEngine::decrypt_chunk_pqc(&ct, &chunk_encap, &alice).unwrap();
    assert_eq!(decrypted, chunk);
}

#[test]
fn test_recursive_zk_snark_por_succinctness() {
    // Simulate 2048 sector commitments (32 MB section segment)
    let sector_hashes: Vec<[u8; 32]> = (0..2048)
        .map(|i| {
            let mut h = [0u8; 32];
            h[0] = (i & 0xff) as u8;
            h[1] = ((i >> 8) & 0xff) as u8;
            h
        })
        .collect();

    let challenge_seed = [0x9Au8; 32];
    let proof = ZkSnarkEngine::create_recursive_por_proof(42, &sector_hashes, &challenge_seed, "node_test_snark").unwrap();

    // Constant size regardless of 2048 sectors
    let raw_proof_bytes = hex::decode(&proof.proof_bytes_hex).unwrap();
    assert_eq!(raw_proof_bytes.len(), SNARK_PROOF_BYTES);

    let verification = ZkSnarkEngine::verify_snark_proof(&proof, &challenge_seed, "node_test_snark");
    assert!(verification.is_valid);
    assert!(verification.pairing_check_passed);
    assert_eq!(verification.polynomial_degree_bound, 65536);

    // Tampered challenge seed must fail
    let bad_seed = [0xFFu8; 32];
    let bad_verification = ZkSnarkEngine::verify_snark_proof(&proof, &bad_seed, "node_test_snark");
    assert!(!bad_verification.is_valid);
}
