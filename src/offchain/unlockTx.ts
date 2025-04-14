import { Address, isData, DataB, Tx } from "@harmoniclabs/plu-ts";
import { fromAscii, uint8ArrayEq } from "@harmoniclabs/uint8array-utils";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import { BrowserWallet, IWallet } from "@meshsdk/core";
import { script, scriptTestnetAddr } from "../../contracts/helloPluts";
import { toPlutsUtxo } from "./mesh-utils";
import getTxBuilder from "./getTxBuilder";
import { Emulator } from "../../package";

export async function getUnlockTx(wallet: IWallet | BrowserWallet, provider: BlockfrostPluts | Emulator): Promise<Tx> {
  const txBuilder = await getTxBuilder(provider);
  const myAddrs = (await wallet.getUsedAddresses()).map(Address.fromString);
  const myUTxOs = (await wallet.getUtxos()).map(toPlutsUtxo);

  /**
   * Wallets might have multiple addresses;
   * 
   * to understand which one we previously used to lock founds
   * we'll get the address based on the utxo that keeps one of ours
   * public key hash as datum
  **/
  let myAddr!: Address;

  // only the onses with valid datum
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
    throw new Error("Opsie, are you sure your tx had enough time to get to the blockchain?");
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
    collaterals: [myUTxOs[0]],
    // send everything back to us
    changeAddress: myAddr
  });
}

export async function unlockTx(wallet: IWallet | BrowserWallet, arg: Emulator | string | null): Promise<string> {
  if (!arg) {
    throw new Error("Cannot proceed without a Emulator or Blockfrost provider");
  }

  let provider: Emulator | BlockfrostPluts;
  if (typeof arg === 'string') {
    provider = new BlockfrostPluts({ projectId: arg });
  } else { // Emulator
    provider = arg;
  }
  
  const unsingedTx = await getUnlockTx(wallet, provider);

  const txStr = await wallet.signTx(
    unsingedTx.toCbor().toString(),
    true // partial sign because we have smart contracts in the transaction
  );

  const txWitnesses = Tx.fromCbor(txStr).witnesses.vkeyWitnesses ?? [];
  for (const witness of txWitnesses) {
    unsingedTx.addVKeyWitness(witness);
  }

  const txHash = await provider.submitTx(unsingedTx);
  console.log("Transaction Hash:", txHash);

  return txHash;
}