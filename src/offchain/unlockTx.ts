import { Address, isData, DataB, Tx } from "@harmoniclabs/plu-ts";
import { fromAscii, uint8ArrayEq } from "@harmoniclabs/uint8array-utils";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import { BrowserWallet, IWallet } from "@meshsdk/core";
import { script, scriptTestnetAddr } from "../../contracts/helloPluts";
import { toPlutsUtxo } from "./mesh-utils";
import getTxBuilder from "./getTxBuilder";
import { Emulator } from "@harmoniclabs/pluts-emulator";
import { vkeyWitnessFromSignData } from "./commons";

export async function getUnlockTx(wallet: IWallet | BrowserWallet, provider: BlockfrostPluts | Emulator, isEmulator: boolean): Promise<Tx> {
  const txBuilder = await getTxBuilder(provider);
  const myAddrs = (await wallet.getUsedAddresses()).map(Address.fromString);

  const walletAddress = Address.fromString(await wallet.getChangeAddress());

  const utxos = await provider.getUtxos(walletAddress);
  if (utxos.length === 0) {
    throw new Error("Have you requested funds from the faucet?");
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
    const errorMessage = isEmulator ? 
      "Oops, are you sure you invoked awaitBlock on emulator to ensure the tx was included in a block?" : 
      "Oops, are you sure your tx had enough time to get to the blockchain?";
    throw new Error(errorMessage);
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

export async function unlockTx(wallet: IWallet | BrowserWallet, provider: Emulator | BlockfrostPluts | null, isEmulator: boolean): Promise<string> {
  if (!provider) {
    throw new Error("Cannot proceed without a Emulator or Blockfrost provider");
  }

  const myAddr = Address.fromString(await wallet.getChangeAddress());

  console.log("About to unlock tx");
  const unsignedTx = await getUnlockTx(wallet, provider, isEmulator);

  // Sign the tx body hash
  const txHashHex = unsignedTx.body.hash.toString();
  // Build the witness set data
  const {key, signature} = await wallet.signData(txHashHex, myAddr.toString());
  const witness = vkeyWitnessFromSignData(key, signature);

  unsignedTx.addVKeyWitness(witness);

  const txHash = await provider.submitTx(unsignedTx);
  console.log("Transaction Hash:", txHash);

  if (provider instanceof Emulator) {
    provider.awaitBlock(1);
    const ledgerState = provider.prettyPrintLedgerState();
    console.log("Ledger State:", ledgerState);
  }

  return txHash;
}