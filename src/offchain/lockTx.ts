import { Value, DataB, Address, Tx, UTxO } from "@harmoniclabs/buildooor";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import { BrowserWallet, IWallet } from "@meshsdk/core";
import { Emulator } from "@harmoniclabs/pluts-emulator";

import { vkeyWitnessFromSignData } from "./commons";
import { loadContract } from "../onchain/contract";
import getTxBuilder from "./getTxBuilder";

export async function getLockTx(wallet: IWallet | BrowserWallet, provider: BlockfrostPluts | Emulator, isEmulator: boolean): Promise<Tx> {
  // creates an address form the bech32 form
  const myAddr = Address.fromString(
    await wallet.getChangeAddress()
  );

  const txBuilder = await getTxBuilder(provider);

  const utxos = await provider.getUtxos(myAddr.toString());
  if (utxos.length === 0) {
    throw new Error(isEmulator ? "No UTxOs have been found at this address on the emulated ledger" : "Have you requested funds from the faucet?");
  }  
  const utxo = utxos.find(u => u.resolved.value.lovelaces >= 15_000_000n);

  if (!utxo) {
    throw new Error("not enough ada");
  }

  const { testnetAddress } = await loadContract();

  return txBuilder.buildSync({
    inputs: [{ utxo: utxo as UTxO }],
    outputs: [{ // output holding the founds that we'll spend later
      address: testnetAddress,
      // 10M lovelaces === 10 ADA
      value: Value.lovelaces(10_000_000),
      // remember to include a datum
      datum: new DataB(
        // remember we set the datum to be the public key hash?
        // we can extract it from the address as follows
        myAddr.paymentCreds.hash.toBuffer()
      )
    }],
    // send everything left back to us
    changeAddress: myAddr
  });
}

export async function lockTx(wallet: IWallet | BrowserWallet, provider: Emulator | BlockfrostPluts | null, isEmulator: boolean): Promise<string> {
  if (!provider) {
    throw new Error("Cannot proceed without a Emulator or Blockfrost provider");
  }

  const myAddr = Address.fromString(await wallet.getChangeAddress());
  const unsignedTx = await getLockTx(wallet, provider, isEmulator);
  
  // Sign the tx body hash
  const txHashHex = unsignedTx.body.hash.toString();

  console.log("Unsigned");
  console.log(unsignedTx.body.hash.toString());
  console.log(unsignedTx.body.toCbor().toString());
  console.log(unsignedTx.toJson());

  // Build the witness set data
  const {key, signature} = await wallet.signData(txHashHex, myAddr.toString());
  const witness = vkeyWitnessFromSignData(key, signature);

  // inject it to the unsigned tx
  unsignedTx.addVKeyWitness(witness);

  console.log("Signed");
  console.log(unsignedTx.body.hash.toString());
  console.log(unsignedTx.body.toCbor().toString());
  console.log(unsignedTx.toJson());

  const txHash = await provider.submitTx(unsignedTx.toCbor().toString());
  console.log("Transaction Hash:", txHash);

  if (provider instanceof Emulator) { // emulator
    provider.awaitBlock(1);
    const ledgerState = provider.prettyPrintLedgerState();
    console.log("Ledger State:", ledgerState);
  }

  return txHash;

}
