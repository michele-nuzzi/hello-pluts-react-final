import { Value, DataB, Address, Tx } from "@harmoniclabs/plu-ts";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import { BrowserWallet, IWallet } from "@meshsdk/core";
import { scriptTestnetAddr } from "../../contracts/helloPluts";
import { toPlutsUtxo } from "./mesh-utils";
import getTxBuilder from "./getTxBuilder";
import { Emulator } from "../../package";

export async function getLockTx(wallet: IWallet | BrowserWallet, provider: BlockfrostPluts | Emulator): Promise<Tx> {
  // creates an address form the bech32 form
  const myAddr = Address.fromString(
    await wallet.getChangeAddress()
  );

  const txBuilder = await getTxBuilder(provider);
  const myUTxOs = (await wallet.getUtxos()).map(toPlutsUtxo);

  if (myUTxOs.length === 0) {
    throw new Error("have you requested founds from the faucet?");
  }

  const utxo = myUTxOs.find(u => u.resolved.value.lovelaces >= 15_000_000);

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

export async function lockTx(wallet: IWallet | BrowserWallet, arg: Emulator | string | null): Promise<string> {
  let provider: Emulator | BlockfrostPluts;
  if (!arg) {
    throw new Error("Cannot proceed without a Emulator or Blockfrost provider");
  }
  else if (typeof arg === 'string') {
    provider = new BlockfrostPluts({ projectId: arg });
  } else { // Emulator
    provider = arg;
  }

  const unsingedTx = await getLockTx(wallet, provider);
  const txStr = await wallet.signTx(unsingedTx.toCbor().toString());
  return await provider.submitTx(txStr);
}
