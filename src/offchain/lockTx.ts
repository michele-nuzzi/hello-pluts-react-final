import { Value, DataB, Address, Tx } from "@harmoniclabs/plu-ts";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import { BrowserWallet } from "@meshsdk/core";
import { scriptTestnetAddr } from "../../contracts/helloPluts";
import { toPlutsUtxo } from "./mesh-utils";
import getTxBuilder from "./getTxBuilder";

async function getLockTx(wallet: BrowserWallet, Blockfrost: BlockfrostPluts): Promise<Tx> {
  // creates an address form the bech32 form
  const myAddr = Address.fromString(
    await wallet.getChangeAddress()
  );

  const txBuilder = await getTxBuilder(Blockfrost);
  const myUTxOs = (await wallet.getUtxos()).map(toPlutsUtxo);

  if (myUTxOs.length === 0) {
    throw new Error("have you requested founds from the faucet?");
  }

  const utxo = myUTxOs.find(u => u.resolved.value.lovelaces > 15_000_000);

  if (utxo === undefined) {
    throw new Error("not enough ada");
  }

  return txBuilder.buildSync({
    inputs: [{ utxo }],
    outputs: [{ // output holding the founds that we'll spend later
      address: scriptTestnetAddr,
      // 10M lovelaces === 10 ADA
      value: Value.lovelaces(10_000_000),
      // remeber to include a datum
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

export async function lockTx(wallet: BrowserWallet, projectId: string): Promise<string> {
  const Blockfrost = new BlockfrostPluts({ projectId });
  const unsingedTx = await getLockTx(wallet, Blockfrost);
  const txStr = await wallet.signTx(unsingedTx.toCbor().toString());
  return await Blockfrost.submitTx(txStr);
}
