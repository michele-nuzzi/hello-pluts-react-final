import { Address, PScriptContext, ScriptType, Credential, Script, compile, pfn, unit, plet, punBData, pmatch, perror, PMaybe, data, pBool, passert } from "@harmoniclabs/plu-ts";

const contract = pfn([
  PScriptContext.type
], unit)
(({ redeemer, tx, purpose }) => {
  const message = plet(punBData.$(redeemer));

  const maybeDatum = plet(
    pmatch(purpose)
    .onSpending(({ datum }) => datum)
    ._(_ => perror(PMaybe(data).type))
  );

  const signedByOwner = plet(
    pmatch(maybeDatum)
    .onNothing( _ => pBool(true))
    .onJust(({ val }) =>
      tx.signatories.includes(punBData.$(val))
    )
  );

  const isBeingPolite = message.eq("Hello plu-ts");

  return passert.$(
    signedByOwner.and(isBeingPolite)
  );
});

export const compiledContract = compile(contract);

export const script = new Script(
  ScriptType.PlutusV3,
  compiledContract
);

export const scriptTestnetAddr = new Address(
  "testnet",
  Credential.script(script.hash)
);