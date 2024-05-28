import { TxBuilder } from "@harmoniclabs/plu-ts";
import Blockfrost from "./blockfrost";

/**
 * we don't want to do too many API call if we already have our `txBuilder`
 * 
 * so after the first call we'll store a copy here.
**/
let _cachedTxBuilder: TxBuilder | undefined = undefined

export default async function getTxBuilder(): Promise<TxBuilder> {
  if (!(_cachedTxBuilder instanceof TxBuilder)) {
    const parameters = await Blockfrost.epochsLatestParameters();
    _cachedTxBuilder = new TxBuilder(parameters);
  }
  return _cachedTxBuilder;
}