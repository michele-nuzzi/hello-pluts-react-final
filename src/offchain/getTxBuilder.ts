import { TxBuilder, defaultProtocolParameters } from "@harmoniclabs/plu-ts";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";

/**
 * we don't want to do too many API call if we already have our `txBuilder`
 * 
 * so after the first call we'll store a copy here.
**/
let _cachedTxBuilder: TxBuilder | undefined = undefined

export default async function getTxBuilder(Blockfrost: BlockfrostPluts): Promise<TxBuilder> {
  if (!(_cachedTxBuilder instanceof TxBuilder)) {
    const parameters = await Blockfrost.epochsLatestParameters();
    _cachedTxBuilder = new TxBuilder(parameters);
  }
  return _cachedTxBuilder;
}