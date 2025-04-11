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
  // if (!(_cachedTxBuilder instanceof TxBuilder)) {
  //   const parameters = await provider.getProtocolParameters();

    // (window as any).a = parameters.costModels.PlutusScriptV3;
    // (window as any).b = parameters; 
    // (window as any).e = (parameters as any).cost_models_raw.PlutusV3;
    // (window as any).f = toCostModelArrV3(
    //   parameters.costModels.PlutusScriptV3!
    // );

    // _cachedTxBuilder = new TxBuilder(parameters);

    // (window as any).c = _cachedTxBuilder.protocolParamters.costModels.PlutusScriptV3;
    // (window as any).d = toCostModelArrV3(
    //   _cachedTxBuilder.protocolParamters.costModels.PlutusScriptV3!
    // );

  // }
  return _cachedTxBuilder;
}