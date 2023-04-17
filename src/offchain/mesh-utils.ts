import { Address, Hash28, Hash32, Script, UTxO, Value, dataFromCbor } from "@harmoniclabs/plu-ts";
import { toAscii, fromHex } from "@harmoniclabs/uint8array-utils";
import { Asset, UTxO as MeshUTxO } from "@meshsdk/core";

function toPlutsValue( units: Asset[] ): Value
{
    return units.map(({ unit, quantity }): Value => {

        if( unit.length === 0 || unit === "lovelace" )
        {
            return Value.lovelaces( BigInt( quantity ) );
        }

        const policy = new Hash28( unit.slice( 0, 56 ) );

        const assetName = toAscii( fromHex( unit.slice( 56 ) ) )

        return new Value([
            {
                policy,
                assets: { [assetName]: BigInt(quantity) },
            }
        ]);
    })
    .reduce( (a, b) => Value.add( a, b ) );
}

export function toPlutsUtxo( u: MeshUTxO ): UTxO
{
    return new UTxO({
        utxoRef: {
            id: u.input.txHash,
            index: u.input.outputIndex
        },
        resolved: {
            address: Address.fromString( u.output.address ),
            value: toPlutsValue( u.output.amount ),
            datum: u.output.plutusData !== undefined ?
                dataFromCbor( u.output.plutusData ) :
                u.output.dataHash !== undefined ?
                    new Hash32( u.output.dataHash ) :
                    undefined,
            refScript: u.output.scriptRef !== undefined ?
                new Script(
                    "PlutusScriptV2",
                    fromHex( u.output.scriptRef )
                ) :
                undefined
        }
    })
}