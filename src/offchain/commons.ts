import { CborArray, CborBytes } from "@harmoniclabs/cbor";
import { decode } from "cbor";
import { VKey, VKeyWitness, Signature} from "@harmoniclabs/plu-ts";

/**
 * Converts a hexadecimal string to a `Uint8Array` of bytes.
 *
 * @param hex - The hexadecimal string to convert. Must have an even length.
 * @returns A `Uint8Array` representing the bytes of the hexadecimal string.
 * @throws {Error} If the input hexadecimal string has an uneven length.
 */
export function hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) throw new Error("hexToBytes: uneven hex string length");
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; ++i) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }


/**
 * Extracts a signature from a CBOR-encoded hexadecimal string.
 *
 * @param hex - The CBOR-encoded hexadecimal string to decode.
 * @returns A `Uint8Array` containing the 64-byte signature.
 * @throws {Error} If the decoded value is not an array.
 * @throws {Error} If the extracted signature is not a `Uint8Array` or does not have a length of 64 bytes.
 */
export function extractSignatureFromCbor(hex: string): Uint8Array {
    const decoded = decode(hexToBytes(hex));
  
    if (!Array.isArray(decoded)) {
      throw new Error("Decoded signature is not an array");
    }
  
    const sigBytes = decoded[3];
  
    if (!(sigBytes instanceof Uint8Array) || sigBytes.length !== 64) {
      throw new Error("Invalid signature length; expected 64 bytes");
    }
  
    return sigBytes;
  }
  
/**
 * Extracts the public key from a COSE key represented as a hexadecimal string.
 *
 * @param hex - The hexadecimal string representation of the COSE key.
 * @returns A `Uint8Array` containing the 32-byte public key.
 * @throws {Error} If the extracted public key is not a valid 32-byte `Uint8Array`.
 */
export function extractPubKeyFromCoseKey(hex: string): Uint8Array {
    const decoded = decode(hexToBytes(hex));
    const pubKeyBytes = decoded.get(-2);
    if (!(pubKeyBytes instanceof Uint8Array) || pubKeyBytes.length !== 32) {
      throw new Error("Invalid public key extracted from COSE");
    }
    return pubKeyBytes;
  }
  

/**
 * Creates a `VKeyWitness` instance from the provided key and signature data.
 *
 * @param key - The COSE-encoded public key as a string.
 * @param signature - The CBOR-encoded signature as a string.
 * @returns A `VKeyWitness` object containing the extracted public key and signature.
 */
export function vkeyWitnessFromSignData(key: string, signature: string): VKeyWitness {
    const pubKeyBytes = extractPubKeyFromCoseKey(key);
    const sigBytes = extractSignatureFromCbor(signature);

    return new VKeyWitness(
        new VKey(pubKeyBytes),
        new Signature(sigBytes)
    );
  }
  
  /**
   * Converts a wallet.signData signature into a CBOR vkey_witness
   * to be used in a transaction witness set.
   * TODO: Move to someplace else, or maybe it already exists in a library?
   * @param key - hex-encoded public key (from `signData`)
   * @param signature - hex-encoded Ed25519 signature (from `signData`)
   * @returns a CBOR array representing a single `vkey_witness`
   */
  export function witnessFromSignData(key: string, signature: string): CborArray {
    return new CborArray([
      new CborBytes(hexToBytes(key)),        // vkey
      new CborBytes(hexToBytes(signature))   // signature
    ]);
  }