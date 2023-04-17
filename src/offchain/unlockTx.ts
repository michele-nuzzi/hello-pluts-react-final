import { BrowserWallet } from "@meshsdk/core";
import getTxBuilder from "./getTxBuilder";
import { Address, isData, DataB, Tx } from "@harmoniclabs/plu-ts";
import { script, scriptTestnetAddr } from "../../contracts/helloPluts";
import { koios } from "./koios";
import { fromAscii, uint8ArrayEq } from "@harmoniclabs/uint8array-utils";
import { toPlutsUtxo } from "./mesh-utils";

async function getUnlockTx( wallet: BrowserWallet ): Promise<Tx>
{
    const myAddrs = (await wallet.getUsedAddresses()).map( Address.fromString );
    
    const txBuilder = await getTxBuilder();
    const myUTxOs = (await wallet.getUtxos()).map( toPlutsUtxo );

    /**
     * Wallets migh have multiple addresses;
     * 
     * to understand which one we previously used to lock founds
     * we'll get the address based on the utxo that keeps one of ours
     * public key hash as datum
    **/
    let myAddr!: Address;

    // only the onses with valid datum
    const utxoToSpend = (await koios.address.utxos( scriptTestnetAddr ))
    .find( utxo => {
        const datum = utxo.resolved.datum;

        if(
            // datum is inline
            isData( datum ) &&
            // and is only bytes
            datum instanceof DataB
        )
        {
            const pkh = datum.bytes.toBuffer();

            // search if it corresponds to one of my public keys
            const myPkhIdx = myAddrs.findIndex(
                addr => uint8ArrayEq( pkh, addr.paymentCreds.hash.toBuffer() )
            );

            // not a pkh of mine; not an utxo I can unlock
            if( myPkhIdx < 0 ) return false;

            // else found my locked utxo
            myAddr = myAddrs[ myPkhIdx ];

            return true;
        }

        return false;
    });

    if( utxoToSpend === undefined )
    {
        throw "uopsie, are you sure your tx had enough time to get to the blockchain?"
    }

    return txBuilder.buildSync({
        inputs: [
            {
                utxo: utxoToSpend as any,
                // we must include the utxo that holds our script
                inputScript: {
                    script,
                    datum: "inline", // the datum is present already on `utxoToSpend`
                    redeemer: new DataB( fromAscii("Hello plu-ts") ) // be polite
                }
            }
        ],
        requiredSigners: [ myAddr.paymentCreds.hash ],
        // make sure to include collateral when using contracts
        collaterals: [ myUTxOs[0] ],
        // send everything back to us
        changeAddress: myAddr
    });
}

export async function unlockTx( wallet: BrowserWallet ): Promise<string>
{
    const unsingedTx = await getUnlockTx( wallet );

    const txStr = await wallet.signTx(
        unsingedTx.toCbor().toString(),
        true // partial sign because we have smart contracts in the transaction
    );

    return (await koios.tx.submit( Tx.fromCbor( txStr ) )).toString();
}