import { Address, isData, DataB, Tx } from "@harmoniclabs/plu-ts";
import { fromAscii, uint8ArrayEq } from "@harmoniclabs/uint8array-utils";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import { BrowserWallet } from "@meshsdk/core";
import { script, scriptTestnetAddr } from "../../contracts/helloPluts";
import { toPlutsUtxo } from "./mesh-utils";
import getTxBuilder from "./getTxBuilder";

async function getUnlockTx(wallet: BrowserWallet, Blockfrost: BlockfrostPluts): Promise<Tx> {
  const txBuilder = await getTxBuilder(Blockfrost);
  const myAddrs = (await wallet.getUsedAddresses()).map(Address.fromString);
  const myUTxOs = (await wallet.getUtxos()).map(toPlutsUtxo);

  /**
   * Wallets migh have multiple addresses;
   * 
   * to understand which one we previously used to lock founds
   * we'll get the address based on the utxo that keeps one of ours
   * public key hash as datum
  **/
  let myAddr!: Address;

  // only the onses with valid datum
  const utxoToSpend = (await Blockfrost.addressUtxos(scriptTestnetAddr)).find(utxo => {
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
    throw new Error("uopsie, are you sure your tx had enough time to get to the blockchain?");
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

export async function unlockTx(wallet: BrowserWallet, projectId: string): Promise<string> {
  const Blockfrost = new BlockfrostPluts({ projectId });
  const unsingedTx = await getUnlockTx(wallet, Blockfrost);

  console.log(JSON.stringify(unsingedTx.toJson(), undefined, 2));

  const txStr = await wallet.signTx(
    unsingedTx.toCbor().toString(),
    true // partial sign because we have smart contracts in the transaction
  );

  return await Blockfrost.submitTx(txStr);
}