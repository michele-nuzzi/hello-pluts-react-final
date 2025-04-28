import { TxBuilder, defaultProtocolParameters, toCostModelArrV3 } from "@harmoniclabs/plu-ts";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";
import { Emulator } from "../../package";

/**
 * we don't want to do too many API call if we already have our `txBuilder`
 * 
 * so after the first call we'll store a copy here.
**/
let _cachedTxBuilder: TxBuilder | undefined = undefined

export default async function getTxBuilder(provider: BlockfrostPluts | Emulator): Promise<TxBuilder> {
  if (!provider) {
    console.warn("No provider passed to getTxBuilder. Using defaults which may not be suitable for mainnet/testnet transactions.");
  }
  // Return cached TxBuilder if available and no provider is specified
  if (_cachedTxBuilder && !provider) {
    return _cachedTxBuilder;
  }

  if (provider) {
    // Use the provided provider to get protocol parameters and genesis infos
    const [protocolParameters] = await Promise.all([
      provider.getProtocolParameters(),
    ]);

    const txBuilder = new TxBuilder(protocolParameters);

    // Cache the TxBuilder for future use
    if (!_cachedTxBuilder) {
      _cachedTxBuilder = txBuilder;
    }

    return txBuilder;
  } else {
    // Use default values if no provider is provided
    if (!_cachedTxBuilder) {
      _cachedTxBuilder = new TxBuilder(
        defaultProtocolParameters,
      );
    }
  }
  return _cachedTxBuilder;
}