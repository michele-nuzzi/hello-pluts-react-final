import { Address, AddressStr, Credential, IUTxO, UTxO, Value } from "@harmoniclabs/plu-ts"
import { defaultMainnetGenesisInfos, defaultProtocolParameters } from "@harmoniclabs/buildooor"
import { getRandomValues } from "crypto"
import { Emulator } from "../../package/Emulator"

/**
 * Generate a random Bech32 address.
 */
export function generateRandomBech32Address(): AddressStr {
    const hash28i = getRandomValues(new Uint8Array(28))
    const testnetAddr = new Address(
        "testnet",
        Credential.keyHash(hash28i)
    )
    return testnetAddr.toString()
}

/**
 * Initialize an emulator with UTxOs for testing
 * @param addresses Map of addresses and their initial balances in lovelaces
 * @returns Configured Emulator instance
 */
export function initializeEmulator(addresses: Map<Address, bigint> = new Map()): Emulator {
    const initialUtxos: IUTxO[] = [];
    let index = 0;
    
    // Create UTxOs for each address with specified amount
    for (const [address, lovelaces] of addresses.entries()) {
      const txHash = generateRandomTxHash(index);
      const utxo = createInitialUTxO(lovelaces, address, txHash);
      initialUtxos.push(utxo);
      index++;
    }
    
    return new Emulator(
      initialUtxos,
      defaultMainnetGenesisInfos, 
      defaultProtocolParameters,
      0 // Debug level
    );
  }

  /**
 * Initialize an emulator with a single address.
 * If the address already has a UTxO with 10 ADA, reuse it; otherwise, create a new UTxO.
 * @param singleAddress The address to initialize the emulator with.
 * @param existingBalances Map of existing addresses and their balances.
 * @returns Configured Emulator instance.
 */
export function initializeEmulatorWithWalletAddress(singleAddress: Address, utxos: UTxO[]): Emulator {
  const initialUtxos: IUTxO[] = [];
  let index = 0;

  // Check if the single address already has a UTxO with 10 ADA
  if (!utxos.length) 
    throw new Error("Wallet doesn't have enough funds. Have you requested funds from the faucet?");
  const utxo = utxos.find(u => u.resolved.value.lovelaces >= 15_000_000);
  if (utxo === undefined) 
    throw new Error("Not enough ADA");


  initialUtxos.push(utxo);

  return new Emulator(
    initialUtxos,
    defaultMainnetGenesisInfos, 
    defaultProtocolParameters,
    0 // Debug level
  );
}


  /**
   * Generate a random transaction hash for testing
   */
  function generateRandomTxHash(salt: number = 0): string {
    // Create a predictable but unique hash based on salt
    return Array.from(
      { length: 64 },
      (_, i) => "0123456789abcdef"[(i + salt) % 16]
    ).join("");
  }
  
  /**
   * Create an initial UTxO for the emulator
   */
  function createInitialUTxO(lovelaces: bigint, address: Address, txHash: string): IUTxO {
    return {
      utxoRef: {
        id: txHash,
        index: 0
      },
      resolved: {
        address: address,
        value: Value.lovelaces(lovelaces),
        datum: undefined,
        refScript: undefined
      }
    };
  }