//! SIMD Hardware Acceleration for Galois Field GF(2^8) Matrix Operations
//!
//! Provides AVX2 (256-bit) and SSSE3 (128-bit) vectorized polynomial multiplication
//! for Reed-Solomon (4+2) encoding and reconstruction with portable fallback.

use crate::GaloisField;

#[cfg(target_arch = "x86_64")]
use std::arch::x86_64::*;

/// Generates low and high 4-bit nibble lookup tables for a given scalar coefficient
pub fn generate_nibble_tables(gf: &GaloisField, coeff: u8) -> ([u8; 16], [u8; 16]) {
    let mut lo = [0u8; 16];
    let mut hi = [0u8; 16];
    for i in 0..16 {
        lo[i] = gf.mul(i as u8, coeff);
        hi[i] = gf.mul((i as u8) << 4, coeff);
    }
    (lo, hi)
}

/// Checks if AVX2 hardware acceleration is supported on the running CPU
pub fn has_avx2_acceleration() -> bool {
    #[cfg(target_arch = "x86_64")]
    {
        is_x86_feature_detected!("avx2")
    }
    #[cfg(not(target_arch = "x86_64"))]
    {
        false
    }
}

/// Fast bitwise XOR of two byte slices: `dst[i] ^= src[i]`
#[inline]
pub fn xor_slice(src: &[u8], dst: &mut [u8]) {
    assert_eq!(src.len(), dst.len());
    let len = src.len();
    let mut offset = 0;

    #[cfg(target_arch = "x86_64")]
    if is_x86_feature_detected!("avx2") {
        unsafe {
            while offset + 32 <= len {
                let s = _mm256_loadu_si256(src.as_ptr().add(offset) as *const __m256i);
                let d = _mm256_loadu_si256(dst.as_ptr().add(offset) as *const __m256i);
                let res = _mm256_xor_si256(d, s);
                _mm256_storeu_si256(dst.as_mut_ptr().add(offset) as *mut __m256i, res);
                offset += 32;
            }
        }
    }

    // Process remaining 8-byte chunks
    while offset + 8 <= len {
        let s = u64::from_ne_bytes(src[offset..offset + 8].try_into().unwrap());
        let d = u64::from_ne_bytes(dst[offset..offset + 8].try_into().unwrap());
        dst[offset..offset + 8].copy_from_slice(&(s ^ d).to_ne_bytes());
        offset += 8;
    }

    // Process remainder single bytes
    while offset < len {
        dst[offset] ^= src[offset];
        offset += 1;
    }
}

/// Multiplies `src` by scalar `coeff` over GF(2^8) and XORs the result into `dst`.
/// Uses AVX2 vectorized nibble-shuffling when available.
pub fn mul_slice_add(gf: &GaloisField, src: &[u8], coeff: u8, dst: &mut [u8]) {
    assert_eq!(src.len(), dst.len());
    if coeff == 0 {
        return;
    }
    if coeff == 1 {
        xor_slice(src, dst);
        return;
    }

    #[cfg(target_arch = "x86_64")]
    if is_x86_feature_detected!("avx2") {
        unsafe {
            mul_slice_add_avx2(gf, src, coeff, dst);
            return;
        }
    }

    mul_slice_add_portable(gf, src, coeff, dst);
}

/// Portable unrolled multiplication using precomputed table
pub fn mul_slice_add_portable(gf: &GaloisField, src: &[u8], coeff: u8, dst: &mut [u8]) {
    let mut table = [0u8; 256];
    for i in 0..256 {
        table[i] = gf.mul(i as u8, coeff);
    }

    let len = src.len();
    let mut offset = 0;

    while offset + 8 <= len {
        dst[offset] ^= table[src[offset] as usize];
        dst[offset + 1] ^= table[src[offset + 1] as usize];
        dst[offset + 2] ^= table[src[offset + 2] as usize];
        dst[offset + 3] ^= table[src[offset + 3] as usize];
        dst[offset + 4] ^= table[src[offset + 4] as usize];
        dst[offset + 5] ^= table[src[offset + 5] as usize];
        dst[offset + 6] ^= table[src[offset + 6] as usize];
        dst[offset + 7] ^= table[src[offset + 7] as usize];
        offset += 8;
    }

    while offset < len {
        dst[offset] ^= table[src[offset] as usize];
        offset += 1;
    }
}

/// AVX2 256-bit SIMD implementation using parallel `vpshufb` nibble lookups
#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2")]
pub unsafe fn mul_slice_add_avx2(gf: &GaloisField, src: &[u8], coeff: u8, dst: &mut [u8]) {
    let (lo_nib, hi_nib) = generate_nibble_tables(gf, coeff);

    // Broadcast 16-byte tables into both 128-bit lanes of 256-bit registers
    let lo_128 = _mm_loadu_si128(lo_nib.as_ptr() as *const __m128i);
    let hi_128 = _mm_loadu_si128(hi_nib.as_ptr() as *const __m128i);
    let lo_tbl = _mm256_set_m128i(lo_128, lo_128);
    let hi_tbl = _mm256_set_m128i(hi_128, hi_128);

    let mask_0f = _mm256_set1_epi8(0x0f);
    let len = src.len();
    let mut offset = 0;

    while offset + 32 <= len {
        let src_vec = _mm256_loadu_si256(src.as_ptr().add(offset) as *const __m256i);
        let dst_vec = _mm256_loadu_si256(dst.as_ptr().add(offset) as *const __m256i);

        // Extract low and high 4-bit nibbles
        let lo_idx = _mm256_and_si256(src_vec, mask_0f);
        let hi_idx = _mm256_and_si256(_mm256_srli_epi16(src_vec, 4), mask_0f);

        // Perform parallel table lookups via byte shuffle
        let prod_lo = _mm256_shuffle_epi8(lo_tbl, lo_idx);
        let prod_hi = _mm256_shuffle_epi8(hi_tbl, hi_idx);

        // Multiply result is XOR of low and high nibble products
        let prod = _mm256_xor_si256(prod_lo, prod_hi);

        // Accumulate into destination: dst ^= prod
        let final_dst = _mm256_xor_si256(dst_vec, prod);
        _mm256_storeu_si256(dst.as_mut_ptr().add(offset) as *mut __m256i, final_dst);

        offset += 32;
    }

    // Remainder bytes
    if offset < len {
        mul_slice_add_portable(gf, &src[offset..], coeff, &mut dst[offset..]);
    }
}

/// Evaluates a linear combination of input shard slices using matrix row coefficients:
/// `output[b] = sum_i (inputs[i][b] * row_coeffs[i])` over GF(2^8)
pub fn gf_mat_mul_shards(
    gf: &GaloisField,
    inputs: &[&[u8]],
    row_coeffs: &[u8],
    output: &mut [u8],
) {
    assert_eq!(inputs.len(), row_coeffs.len());
    output.fill(0);
    for (i, &coeff) in row_coeffs.iter().enumerate() {
        if coeff != 0 {
            mul_slice_add(gf, inputs[i], coeff, output);
        }
    }
}
