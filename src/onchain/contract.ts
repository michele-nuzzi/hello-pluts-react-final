import { Compiler, createMemoryCompilerIoApi } from '@harmoniclabs/pebble';
import { Script, ScriptType, Address, Credential } from "@harmoniclabs/buildooor";
import { fromUtf8 } from "@harmoniclabs/uint8array-utils";

const CONTRACT_NAME = 'hello-world.pebble';

const CONTRACT = `
  struct HelloWorldDatum
  {
    owner: bytes
  }

  contract HelloWorld
  {
    spend helloWorld(
      inputIdx: int,
      outputIdx: int,
      message: bytes
    )
    {
      const { tx, spendingRef } = context;

      const { resolved: spendingInput, ref: inputSpendingRef } = tx.inputs[inputIdx];

      assert inputSpendingRef === spendingRef;

      const InlineDatum{
        datum: {
          owner
        } as HelloWorldDatum
      } = spendingInput.datum;

      assert tx.requiredSigners.includes(owner);

      assert message == "Hello pebble";
    }
  }
`;

async function compileContract(): Promise<Uint8Array> {
  const ioApi = createMemoryCompilerIoApi({
    sources: new Map([
      [CONTRACT_NAME, fromUtf8(CONTRACT)],
    ]),
    useConsoleAsOutput: true,
  });

  const compiler = new Compiler(ioApi);

  await compiler.compile({ entry: CONTRACT_NAME, root: "/" });

  const compiled = ioApi.outputs.get("out/out.flat");

  return compiled || new Uint8Array();
}

function getScript(bytes: Uint8Array): Script {
  return new Script(ScriptType.PlutusV3, bytes);
}

function getScriptTestnetAddr(script: Script): Address {
  return new Address({
    network: 'testnet',
    paymentCreds: Credential.script(script.hash),
  });
}

export interface CompiledContract {
  script: Script;
  testnetAddress: Address;
}

export async function loadContract(): Promise<CompiledContract> {
  const bytes = await compileContract();
  const script = getScript(bytes);
  const testnetAddress = getScriptTestnetAddr(script);
  return { script, testnetAddress };
}