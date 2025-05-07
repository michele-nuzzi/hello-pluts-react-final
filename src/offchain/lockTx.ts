import { Value, DataB, Address, Tx, forceTxOutRefStr } from "@harmoniclabs/plu-ts";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import { BrowserWallet, IWallet, UTxO } from "@meshsdk/core";
import { scriptTestnetAddr } from "../../contracts/helloPluts";
import { toPlutsUtxo } from "./mesh-utils";
import getTxBuilder from "./getTxBuilder";
import { Emulator } from "../../package";
import { vkeyWitnessFromSignData } from "./commons";

export async function getLockTx(wallet: IWallet | BrowserWallet, provider: BlockfrostPluts | Emulator, isEmulator: boolean): Promise<Tx> {
  // creates an address form the bech32 form
  const myAddr = Address.fromString(
    await wallet.getChangeAddress()
  );

  const txBuilder = await getTxBuilder(provider);

  const utxos = await provider.getUtxos(myAddr);
  if (utxos.length === 0) {
    throw new Error("Have you requested funds from the faucet?");
  }  
  const utxo = utxos.find(u => u.resolved.value.lovelaces >= 15_000_000n);

  if (!utxo) {
    throw new Error("not enough ada");
  }

  return txBuilder.buildSync({
    inputs: [{ utxo }],
    outputs: [{ // output holding the founds that we'll spend later
      address: scriptTestnetAddr,
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

  console.log("About to get lock tx");
  const unsignedTx = await getLockTx(wallet, provider, isEmulator);
  console.log("Unsigned Tx:", unsignedTx.toJson());
  
  // Sign the tx body hash
  const txHashHex = unsignedTx.body.hash.toString();
  // Build the witness set data
  const {key, signature} = await wallet.signData(txHashHex, myAddr.toString());
  const witness = vkeyWitnessFromSignData(key, signature);

  // inject it to the unsigned tx
  unsignedTx.addVKeyWitness(witness);

  const txHash = await provider.submitTx(unsignedTx);
  console.log("Transaction Hash:", txHash);

  if ("awaitBlock" in provider && "prettyPrintLedgerState" in provider) { // emulator
    provider.awaitBlock(1);
    const ledgerState = provider.prettyPrintLedgerState();
    console.log("Ledger State:", ledgerState);
  }

  return txHash;

}
