import { TxBuilder, defaultProtocolParameters, toCostModelArrV3 } from "@harmoniclabs/plu-ts";
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

    (window as any).a = parameters.costModels.PlutusScriptV3;
    (window as any).b = parameters; 
    (window as any).e = (parameters as any).cost_models_raw.PlutusV3;
    (window as any).f = toCostModelArrV3(
      parameters.costModels.PlutusScriptV3!
    );

    _cachedTxBuilder = new TxBuilder(parameters);

    (window as any).c = _cachedTxBuilder.protocolParamters.costModels.PlutusScriptV3;
    (window as any).d = toCostModelArrV3(
      _cachedTxBuilder.protocolParamters.costModels.PlutusScriptV3!
    );

  }
  return _cachedTxBuilder;
}