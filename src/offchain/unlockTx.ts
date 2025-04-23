import { Address, isData, DataB, Tx } from "@harmoniclabs/plu-ts";
import { fromAscii, uint8ArrayEq } from "@harmoniclabs/uint8array-utils";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import { BrowserWallet, IWallet } from "@meshsdk/core";
import { script, scriptTestnetAddr } from "../../contracts/helloPluts";
import { toPlutsUtxo } from "./mesh-utils";
import getTxBuilder from "./getTxBuilder";
import { Emulator } from "../../package";
import { vkeyWitnessFromSignData } from "./commons";

export async function getUnlockTx(wallet: IWallet | BrowserWallet, provider: BlockfrostPluts | Emulator, isEmulator: boolean): Promise<Tx> {
  const txBuilder = await getTxBuilder(provider);
  const myAddrs = (await wallet.getUsedAddresses()).map(Address.fromString);

  const walletAddress = Address.fromString(await wallet.getChangeAddress());

  const utxosOrMap = await provider.getUtxos(walletAddress);
  let utxos = utxosOrMap;

  if (Array.isArray(utxosOrMap)) { // Blockfrost case
    if (utxosOrMap.length === 0) {
      throw new Error("Have you requested funds from the faucet?");
    }
    utxos = utxosOrMap;
  }
  else { // Emulator case
    utxos = Array.from(utxosOrMap.values())
  }

  let myAddr!: Address;

  /**
   * Wallets might have multiple addresses;
   * 
   * to understand which one we previously used to lock founds
   * we'll get the address based on the utxo that keeps one of ours
   * public key hash as datum
  **/

  // reassign utxoToSpend with only the responses with valid datum
  const utxoToSpend = (await provider.addressUtxos(scriptTestnetAddr)).find(utxo => {
    const datum = utxo.resolved.datum;

    // datum is inline and is only bytes
    if (isData(datum) && datum instanceof DataB) {
      const pkh = datum.bytes.toBuffer();

      // search if it corresponds to one of my public keys
      const myPkhIdx = myAddrs.findIndex(
        addr => uint8ArrayEq(pkh, addr.paymentCreds.hash.toBuffer())
      );

      // not a pkh of mine; not an utxo I can unlock
      if (myPkhIdx < 0) return false;

      // else found my locked utxo
      myAddr = myAddrs[myPkhIdx];

      return true;
    }

    return false;
  });

  if (utxoToSpend === undefined) {
    throw new Error("Oops, are you sure your tx had enough time to get to the blockchain?");
  }

  return txBuilder.buildSync({
    inputs: [{
      utxo: utxoToSpend as any,
      // we must include the utxo that holds our script
      inputScript: {
        script,
        datum: "inline", // the datum is present already on `utxoToSpend`
        redeemer: new DataB(fromAscii("Hello plu-ts")) // be polite
      }
    }],
    requiredSigners: [myAddr.paymentCreds.hash],
    // make sure to include collateral when using contracts
    collaterals: [utxos[0]],
    // send everything back to us
    changeAddress: myAddr
  });
}

export async function unlockTx(wallet: IWallet | BrowserWallet, arg: Emulator | string | null, isEmulator: boolean): Promise<string> {
  if (!arg) {
    throw new Error("Cannot proceed without a Emulator or Blockfrost provider");
  }

  const myAddr = Address.fromString(await wallet.getChangeAddress());

  let provider: Emulator | BlockfrostPluts;
  if (typeof arg === 'string') {
    provider = new BlockfrostPluts({ projectId: arg });
  } else { // Emulator
    provider = arg;
  }

  console.log("About to unlock tx");
  const unsignedTx = await getUnlockTx(wallet, provider, isEmulator);

  // const txStr = await wallet.signTx(
  //   unsingedTx.toCbor().toString(),
  //   true // partial sign because we have smart contracts in the transaction
  // );

// Sign the tx body hash
  const txHashHex = unsignedTx.body.hash.toString();
  // Build the witness set data
  const {key, signature} = await wallet.signData(txHashHex, myAddr.toString());
  // const txWitnesses = Tx.fromCbor(txStr).witnesses.vkeyWitnesses ?? [];
  const witness = vkeyWitnessFromSignData(key, signature);

  // for (const witness of txWitnesses) {
  unsignedTx.addVKeyWitness(witness);
  // }

  const txHash = await provider.submitTx(unsignedTx);
  console.log("Transaction Hash:", txHash);

  if ("awaitBlock" in provider && "prettyPrintLedgerState in provider") { // emulator
    provider.awaitBlock(1);
    const ledgerState = provider.prettyPrintLedgerState();
    console.log("Ledger State:", ledgerState);
  }

  return txHash;
}