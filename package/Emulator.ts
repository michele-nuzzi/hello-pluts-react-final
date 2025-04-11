import {
    Address,
    AddressStr,
    CanBeTxOutRef,
    TxOutRef,
    forceTxOutRefStr,
    isProtocolParameters,
    IUTxO,
    ProtocolParameters,
    StakeAddressBech32,
    Tx,
    Data,
    defaultProtocolParameters,
    ITxRunnerProvider,
    TxOutRefStr,
    UTxO,
    Hash32,
    // TxWithdrawals,
    // Value
} from "@harmoniclabs/plu-ts"

import {
    StakeAddressInfos
} from "./types/StakeAddressInfos";

import {
    CanResolveToUTxO,
    defaultMainnetGenesisInfos,
    CanBeData,
    GenesisInfos,
    IGetGenesisInfos,
    IGetProtocolParameters,
    IResolveUTxOs,
    isGenesisInfos,
    ISubmitTx,
    normalizedGenesisInfos,
    NormalizedGenesisInfos,
    TxBuilder
} from "@harmoniclabs/buildooor"

import {Queue} from "./queue"

// Define the interface outside the class
export interface EmulatorBlockInfos {
    time: number;
    hight: number; // This is an hommage to @harmoniclabs/blockfrost-pluts
    // hash: string;
    slot: number;
    // epoch: number;
    // epoch_slot: number;
    slot_leader : "emulator";
    size : number;
    tx_count : number;
    // output : bigint | null | undefined;
    fees : bigint;
    // block_vrf : string;
    // op_cert: string | null | undefined,
    // op_cert_counter: `${bigint}` | null | undefined,
    // previous_block: string | null | undefined,
    // next_block: string | null | undefined,
    // confirmations: number
  }

export class Emulator implements ITxRunnerProvider, IGetGenesisInfos, IGetProtocolParameters, IResolveUTxOs, ISubmitTx
{
    private readonly utxos: Map<TxOutRefStr,UTxO>;
    private readonly stakeAddresses: Map<StakeAddressBech32, StakeAddressInfos>;
    private readonly addresses: Map<AddressStr, Set<TxOutRefStr>>;

    private debugLevel: number;
    private readonly mempool: Queue<Tx>;
    
    private time: number;
    private slot: number;
    private blockHeight: number;
    
    private readonly genesisInfos: NormalizedGenesisInfos;
    private readonly protocolParameters: ProtocolParameters;

    // TO CHECK: Is that how to handle the block information?
    private lastBlock : EmulatorBlockInfos;

    // TO CHECK: Is that how to handle the datum table?
    private readonly datumTable: Map<string, Data> = new Map();

    readonly txBuilder: TxBuilder;

    /**
     * Create a new Emulator
     * @param initialUtxoSet Initial UTxOs to populate the ledger
     * @param genesisInfos Chain genesis information
     * @param protocolParameters Protocol parameters
     * @param debugLevel Debug level (0: no debug, 1: basic debug, 2: detailed debug)
     */

    constructor(
        initialUtxoSet: Iterable<IUTxO> = [],
        genesisInfos: GenesisInfos = defaultMainnetGenesisInfos,
        protocolParameters: ProtocolParameters = defaultProtocolParameters,
        debugLevel: number = 0,
    )
    {
        if( !isGenesisInfos( genesisInfos ) ) genesisInfos = defaultMainnetGenesisInfos;
        this.genesisInfos = normalizedGenesisInfos( genesisInfos );

        if( !isProtocolParameters( protocolParameters ) ) protocolParameters = defaultProtocolParameters;
        this.protocolParameters = protocolParameters;
        this.txBuilder = new TxBuilder( this.protocolParameters, this.genesisInfos );
        
        // Initialize the time and slot based on the genesis information
        this.time = this.genesisInfos.systemStartPosixMs;
        this.slot = this.genesisInfos.startSlotNo;
        this.blockHeight = 0;
        
        // Initialize the state maps
        this.utxos = new Map();
        this.stakeAddresses = new Map();
        this.addresses = new Map();
        this.datumTable = new Map();
        this.mempool = new Queue<Tx>();
        this.debugLevel = debugLevel;

        this.lastBlock = {
            time: this.time,
            hight: this.blockHeight,
            slot: this.slot,
            slot_leader: "emulator",
            size: 0,
            tx_count: 0,
            fees: BigInt(0)
        };

        for( const iutxo of initialUtxoSet )
        {
            this.addUtxoToLedger( new UTxO( iutxo ) );
        }
    }

    /** Add a UTxO to the ledger
      * @param utxo UTxO to add
      * @returns void
    */
    private addUtxoToLedger( utxo: UTxO ): void
    {
        const ref = utxo.utxoRef.toString();

        if( !this.utxos.has( ref ) )
        {
            this.utxos.set( ref, utxo );

            const addr = utxo.resolved.address.toString();
            if( !this.addresses.has( addr ) ) this.addresses.set( addr, new Set() );

            this.addresses.get( addr )!.add( ref );
        }
    }

    /** Remove a UTxO from the ledger
      * @param utxoRef UTxO reference to remove
      * @returns void
    */
    private removeUtxoFromLedger( utxoRef: CanBeTxOutRef ): void
    {
        const ref = forceTxOutRefStr( utxoRef );
        const addr = this.utxos.get( ref )?.resolved.address.toString();

        if( typeof addr !== "string" ) return;

        this.utxos.delete( ref );

        const addrRefs = this.addresses.get( addr )!;
        addrRefs.delete( ref );

        if( addrRefs.size <= 0 ) this.addresses.delete( addr );
    }

    /** Pretty printers */
    /** Pretty print a UTxO
      * @param utxo UTxO to pretty print
      * @param detailed Whether to show detailed information (default: false)
      * @returns Pretty printed string
    */
    prettyPrintUtxo (utxo: UTxO, detailed: boolean = false): string {
        const ref = utxo.utxoRef.toString();
        let address = utxo.resolved.address.toString();
        
        // TOFIX:
        // if (!detailed) {
        //     address = address.substring(0,10) + "..." + address.substring(address.length - 5);
        // }
        
        const lovelace = utxo.resolved.value.lovelaces.toString();

        let output = `UTxO Ref: ${ref}\n`;
        output += `\tAddress: ${address}\n`;
        output += `\tLovelace: ${lovelace}\n`;

        const assets = utxo.resolved.value.map;
        if (assets) {
            output += `\tAssets:\n`;
            for (const asset of assets) {
                const policy = asset.policy.toString();
                for (const token of asset.assets) {
                    const tokenName = token.name.toString();
                    const quantity = token.quantity.toString();
                    output += `\t\tPolicy: ${policy} Token: ${tokenName} Quantity: ${quantity}\n`;
                }
            }
        }

        // Add datum information if available
        if (utxo.resolved.datum) {
            output += `\tDatum: ${utxo.resolved.datum.toString().substring(0, 20)}...\n`;
            if (detailed && utxo.resolved.datum) {
                output += `  Datum Data: ${JSON.stringify(utxo.resolved.datum)}...\n`;
            }
        }

        // Add reference script information if available
        if (utxo.resolved.refScript) {
            output += `\tReference Script: ${utxo.resolved.refScript.toString().substring(0, 20)}...\n`;
            if (detailed && utxo.resolved.refScript) {
                output += `  Reference Script Data: ${JSON.stringify(utxo.resolved.refScript)}...\n`;
            }
        }

        return output;
    }

    /** Pretty print a set of UTxOs
      * @param utxos UTxOs to pretty print
      * @param detailed Whether to show detailed information (default: false)
      * @returns Pretty printed string
    */
    prettyPrintUtxos (utxos: Map<TxOutRefStr, UTxO>, detailed: boolean = false): string {
        let output = "UTxOs:\n";
        for (const utxo of utxos.values()) {
            output += this.prettyPrintUtxo(utxo, detailed) + "\n";
        }
        return output;
    }

    
    /** Pretty print the ledger state
     * @param detailed Whether to show detailed information (default: false)
     * @return Pretty printed string of the entire ledger state
     */
    prettyPrintLedgerState(detailed: boolean = false): string {
        let output = "=== Ledger State ===\n";

        // Basic ledger information
        output += `Block Height: ${this.blockHeight}\n`;
        output += `Current Slot: ${this.slot}\n`;
        output += `Current Time: ${new Date(this.time).toISOString()}\n\n`;

        // UTxOs
        const utxosCount = this.utxos.size;
        output += `=== UTxOs (${utxosCount}) ===\n`;
        
        if (utxosCount > 0) {
            // Group UTxOs by address
            const utxosByAddress: Map<string, UTxO[]> = new Map();
            for (const utxo of this.utxos.values()) {
                const addressStr = utxo.resolved.address.toString();
                if (!utxosByAddress.has(addressStr)) {
                    utxosByAddress.set(addressStr, []);
                }
                utxosByAddress.get(addressStr)!.push(utxo);
            }

            // Print UTxOs grouped by address
            for (const [address, addressUtxos] of utxosByAddress.entries()) {
                output += `Address: ${address}\n`;
                output += `  UTxOs: ${addressUtxos.length}\n`;
                
                // Total balance for the address
                const totalBalance = addressUtxos.reduce((sum, utxo) => 
                    sum + utxo.resolved.value.lovelaces, 0n);
                output += `  Total Balance: ${totalBalance} lovelaces\n`;

                if (detailed) {
                    for (const utxo of addressUtxos) {
                        output += this.prettyPrintUtxo(utxo, true) + "\n";
                    }
                }
            }
        } else {
            output += "No UTxOs in the ledger.\n";
        }

        // Mempool
        output += `\n=== Mempool ===\n`;
        output += this.prettyPrintMempool(detailed);

        // Stake Addresses (if implemented)
        if (this.stakeAddresses.size > 0) {
            output += `\n=== Stake Addresses ===\n`;
            for (const [address, info] of this.stakeAddresses.entries()) {
                output += `Address: ${address}\n`;
                output += `  Rewards: ${info.rewards}\n`;
            }
        }

        // Datum Table
        if (this.datumTable.size > 0) {
            output += `\n=== Datum Table ===\n`;
            for (const [hash, datum] of this.datumTable.entries()) {
                output += `Datum Hash: ${hash}\n`;
                output += `  Datum: ${datum.toString()}\n`;
            }
        }

        output += "\n=== End of Ledger State ===\n";
        return output;
    }

    /** Pretty print the mempool
     * @param detailed Whether to show detailed information (default: false)
     * @return Pretty printed string
     * */
    prettyPrintMempool (detailed: boolean = false): string {
        const txs = this.mempool;

        if (!txs.length) {
            return "Mempool is empty.\n";
        }

        let output = `=== Mempool Transactions (${txs.length}) ===\n\n`;

        for (const tx of txs) {
            const txHash = tx.hash.toString();
            const inputCount = tx.body.inputs.length;
            const outputCount = tx.body.outputs.length;
            const fee = tx.body.fee.toString() || "0";
            const validityStart = tx.body.validityIntervalStart ? tx.body.validityIntervalStart.toString() : "N/A";
            const validtityEnd = tx.body.ttl ? tx.body.ttl.toString() : "N/A";

            output += `Transaction Hash: ${txHash}\n`;
            output += `\tInputs: ${inputCount}\n`;
            output += `\tOutputs: ${outputCount}\n`;
            output += `\tFee: ${fee}\n`;
            output += `\tValidity Range: Start ${validityStart}; End ${validtityEnd}\n`;

            // Add certificates information if available
            // TODO

            // Add withdrawals information if available
            if (tx.body.withdrawals) {
                output += `\tWithdrawals:\n`;
                for (const withdraw of tx.body.withdrawals.map) {
                    const rewardAddress = withdraw.rewardAccount.toString();
                    const amount = withdraw.amount.toString();
                    output += `\t\tReward Address: ${rewardAddress} Amount: ${amount}\n`;
                }
            }

            output += `\n`;
        }
        output += `=== End of Mempool ===\n`;
        return output;
    }

    /** Getters */
    
    /** Get genesis information */
    getGenesisInfos(): Promise<GenesisInfos>
    {
        return Promise.resolve({ ...this.genesisInfos });
    }

    /** Get protocol parameters */
    getProtocolParameters(): Promise<ProtocolParameters>
    {
        return Promise.resolve( this.protocolParameters );
    }

    /** Get the maximal size for a transaction */
    getTxMaxSize() {
        return Number(this.protocolParameters.maxTxSize);
    }
    /** Get the current time */
    getCurrentTime() {
        return this.time;
    }

    /** Get the current block height */
    getCurrentSlot(): number {
        return this.slot;
    }

    /** Get the current block height */
    getCurrentBlockHeight(): number {
        return this.blockHeight;
    }

    /** Get the current block information */
    getChainTip(): EmulatorBlockInfos {
        return this.lastBlock;
    }

    /** Returns the set of UTxOs */
    getUtxos(): Map<TxOutRefStr, UTxO>
    {
        return new Map( this.utxos );
    }

    /**
     * Get all transactions in the mempool
     */
    getMempool(): Tx[] {
        return Array.from(this.mempool);
    }
    
    /** Helper */
    /** Get the size of a transaction */
    getTxSize(tx: Tx | undefined) {
        return tx ? ((tx instanceof Tx ? tx.toCbor() : tx).toBuffer().length) : 0;
    }

    fromSlotToPosix (slot: number): bigint {
        return BigInt(slot) * BigInt(this.genesisInfos.slotLengthMs) + BigInt(this.genesisInfos.systemStartPosixMs);
    }
    /**
     * Calculate the minimum required fee for a transaction
     * @param tx The transaction
     * @returns The minimum required fee in lovelace
     */
    private calculateMinFee(tx: Tx): bigint {
        // Get protocol parameters for fee calculation
        let a = this.protocolParameters.txFeePerByte;
        let b = this.protocolParameters.txFeeFixed;
        this.debug(1, `txFeePerByte: ${a} of type ${typeof(a)} txFeeFixed: ${b} of type ${typeof(b)}`);
        if (typeof a == undefined) {
            this.debug(0, "Invalid txFeePerByte. Defaulting to 0.");
            a = BigInt(0);
        }
        if (typeof b == undefined) {
            this.debug(0, "Invalid txFeeFixed. Defaulting to 0.");
            b = BigInt(0);
        }
        // Calculate transaction size in bytes
        const txSize = tx.toCbor().toString().length / 2; // Convert hex string to bytes
        
        // Calculate minimum fee: a * txSize + b
        const minFee = (BigInt(a) * BigInt(txSize)) + BigInt(b);
        
        return minFee;
    }

    /** Debug */
    /** Set the debug level */
    setDebugLevel( level: number ): void
    {
        this.debugLevel = level;
    }

    /** Get the debug level */
    /** Debug log amethod 
      * @param level Debug level (0: no debug, 1: basic debug, 2: detailed debug)
      * @param message Debug message
      * @returns void
    */
    private debug(level: number, message: string): void {
        const COLOR_CODES = {
            RED: "\x1b[31m",
            YELLOW: "\x1b[33m",
            GREEN: "\x1b[32m",
            RESET: "\x1b[0m"
        }
        // if (this.debugLevel >= level) {
            let color : string;

            switch (level) {
                case 0: color = COLOR_CODES.RED; break;
                case 1: color = COLOR_CODES.YELLOW; break;
                case 2: color = COLOR_CODES.GREEN; break;
                default: color = COLOR_CODES.RESET; break;
            }
            console.log(`${color}[Emulator Debug level ${level}]: ${COLOR_CODES.RESET}${message}`);
        // }

    }

    /**
     * Resolves the utxos that are present on the current ledger state
     * 
     * Note: if some of the specified utxos are not present (have been spent already)
     * they will be filtered out
     * @param utxos UTxOs to resolve
     * @returns Promise<UTxO[]> Resolved UTxOs
    */
    resolveUtxos( utxos: CanResolveToUTxO[] ): Promise<UTxO[]>
    {
        this.debug(2, `Resolving UTxOs: ${utxos.map(u => forceTxOutRefStr(u)).join(', ')}`);

        return Promise.resolve(
            [ ...new Set<TxOutRefStr>( utxos.map( forceTxOutRefStr ) ) ]
            .map( ref => this.utxos.get( ref )?.clone() )
            .filter( u => u instanceof UTxO ) as UTxO[]
        );
    }

    /**
     * Resolves UTxOs for a specific address
     * @param address Address to find UTxOs for
     * @returns Array of UTxOs belonging to the address, or undefined if none found
     */
    resolveUtxosbyAddress(address: Address | AddressStr): UTxO[] | undefined {
        // Ensure we have a proper AddressStr by using toString() from the Address object
        // This maintains the type safety
        const addressStr = address instanceof Address 
            ? address.toString() 
            : address;
        
        this.debug(2, `Resolving UTxOs for address: ${addressStr}`);
        
        // Check if the address exists in our address map
        if (!this.addresses.has(addressStr)) {
            this.debug(1, `No UTxOs found for address: ${addressStr}`);
            return undefined;
        }
        
        // Get the set of UTxO references for this address
        const utxoRefs = this.addresses.get(addressStr)!;
        this.debug(2, `Found ${utxoRefs.size} UTxO references for address: ${addressStr}`);
        
        // Resolve each UTxO reference to its full UTxO object
        const utxos: UTxO[] = [];
        for (const ref of utxoRefs) {
            const utxo = this.utxos.get(ref);
            if (utxo) {
                utxos.push(utxo.clone());
            }
        }
        
        // Log the resolved UTxOs
        this.debug(2, `Resolved ${utxos.length} UTxOs for address ${addressStr}:`);
        
        // Log individual UTxO details - this will only execute if debug level is sufficient
        utxos.forEach(utxo => {
            this.debug(2, `  UTxO: ${utxo.utxoRef.toString()}, Value: ${utxo.resolved.value.lovelaces} lovelaces`);
        });
        
        return utxos.length > 0 ? utxos : undefined;
    }

    /**
     * Retrieves UTxOs for a specific address (Blockfrost API compatible method)
     * @param address Address to find UTxOs for
     * @returns Promise with array of UTxOs belonging to the address
     */
    async addressUtxos(address: AddressStr | Address): Promise<UTxO[]> {
        // Just delegate to our main implementation
        const utxos = this.resolveUtxosbyAddress(address);
        
        // Return empty array instead of undefined to match Blockfrost behavior
        return Promise.resolve(utxos || []);
    }

    /**
     * Resolves datum hashes to their corresponding datum values
     * @param hashes Array of Hash32 objects representing datum hashes to resolve
     * @returns Promise with an array of resolved datums with their hashes
     */
    async resolveDatumHashes(hashes: Hash32[]): Promise<{hash: string; datum: CanBeData;}[]> {
            this.debug(2, `Resolving ${hashes.length} datum hashes`);
            
            // Map to store resolved datums
            const resolvedDatums: {
                hash: string;
                datum: CanBeData;
            }[] = [];
            
            // Iterate through each hash and try to find it in the datum table
            for (const hash of hashes) {
                const hashStr = hash instanceof Hash32 ? hash.toString() : String(hash);
                
                this.debug(2, `Looking up datum hash: ${hashStr}`);
                
                // Try to get the datum from the datum table
                const datum = this.datumTable.get(hashStr);
                
                if (datum) {
                    this.debug(2, `Found datum for hash ${hashStr}`);
                    resolvedDatums.push({
                        hash: hashStr,
                        datum: datum
                    });
                } else {
                    this.debug(1, `Datum hash ${hashStr} not found in datum table`);
                }
            }
        
        this.debug(2, `Resolved ${resolvedDatums.length} out of ${hashes.length} datum hashes`);
        return Promise.resolve(resolvedDatums);
    }

    /**
     * Advance to a future block
     * @param blocks Number of blocks to advance
     */
    awaitBlock(blocks: number = 1): void {
        if (blocks <= 0) {
            console.warn("Invalid call to awaitBlock. Argument blocks must be greater than zero.");
        }

        this.blockHeight += blocks;
        this.slot += blocks * (this.genesisInfos.slotLengthMs / 1000);
        this.time += blocks * this.genesisInfos.slotLengthMs;

        this.debug(1, `Advancing to block number ${this.blockHeight} (slot ${this.slot}). Time: ${new Date(this.time).toISOString()}`);

        // Number of blocks processed
        let blockProcessed = 0;

        while (this.mempool.length > 0 && blockProcessed < blocks) {
            this.debug(2, `Processing block ${blockProcessed + 1} of ${blocks}`);
            this.updateLedger();
            blockProcessed ++;
        }

        // Fast forward if the mempool is empty
        if (blockProcessed < blocks && this.mempool.length === 0) {
            this.debug(2, `Fast forwarding remaning ${blocks - blockProcessed} blocks as mempool is empty`);
        }
    }
    
    /** Update the ledger by processing the mempool, respecting the block size limit */
    private updateLedger(): void {
        this.debug(1, `Updating ledger, mempool length: ${this.mempool.length}`);

        // Check if the mempool is empty. Should not happen here.
        if (this.mempool.length === 0) {
            this.debug(2, "Mempool is empty. No transactions to process.");
            return;
        }

        const maxBlockBodySize = this.protocolParameters.maxBlockBodySize;
        this.debug(2, `Max block body size: ${maxBlockBodySize}`);

        // Process transaction in the mempool until the block size limit is reached
        let currentBlockSize = 0;
        let txsProcessed = 0;
        let totalFees = BigInt(0);

        while (this.mempool.length > 0) {
            // Peek at the next transaction in the mempool without removing it 
            const nextTx = this.mempool.peek();
            if (!nextTx) {
                this.debug(2, "No more transactions in the mempool.");
                break;
            }

            // Get the size of the transaction
            const txSize = this.getTxSize(nextTx);
            if (currentBlockSize + txSize > maxBlockBodySize) {
                this.debug(2, `Next transaction, of size ${txSize}, will not fit in the block. Current block size: ${currentBlockSize}.`);
                break; // Block is full, process next transaction in the next block
            }

            this.debug(2, `Processing transaction of size ${txSize}.`);

            // Dequeue the transaction from the mempool
            const tx = this.mempool.dequeue();
            if (!tx) {
                this.debug(2, "No transaction to process.");
                break;
            }
            try {
                // Process the transaction 
                this.processTx(tx);

                // Calculate the fee
                totalFees += tx.body.fee;

                // Update the counters
                currentBlockSize += txSize;
                txsProcessed ++;

                this.debug(2, `Processed transaction ${tx.hash.toString()}, size ${txSize} bytes, block: ${currentBlockSize}/${maxBlockBodySize} bytes.`);
            }
            catch (error) {
                this.debug(0, `Failed to process transaction ${tx.hash.toString()}: ${error}`);
            }
        }
        
        // Update the last block information
        this.lastBlock = {
            time: this.time,
            hight: this.blockHeight,
            slot: this.slot,
            slot_leader : "emulator",
            size : currentBlockSize,
            tx_count : txsProcessed,
            fees : totalFees,
        };

        this.debug(1, `Block processing complete. ${txsProcessed} transactions processed for ${currentBlockSize} bytes.`);
    }

    /** Process a transaction into the ledger state
      * @param tx Transaction to process
      * @returns void
     */
    private processTx(tx: Tx): void {
        const txHash = tx.hash.toString();
        
        this.debug(1, `Processing transaction ${txHash}`);
        const isValidTx = this.validateTx(tx);

        if (!isValidTx) {
            this.debug(0, `Transaction ${txHash} failed validation on-chain. Skipping.`);
            // TODO: Add collateral slashing
            // this.debug(0, `Slashing collateral for transaction ${txHash}`);
            // this.slashCollateral(tx);
            return;
        }

        // Remove the inputs from the ledger
        for (const input of tx.body.inputs) {
            const utxoRef = forceTxOutRefStr(input);
            this.debug(2, `Removing input ${utxoRef} from ledger`);
            
            this.removeUtxoFromLedger(utxoRef);
        }

        // Add the outputs to the ledger
        for (let index = 0; index < tx.body.outputs.length; index++) {
            const output = tx.body.outputs[index];

            // Create a UTxO from the output
            const utxo = new UTxO({
                resolved: tx.body.outputs[index],
                utxoRef: new TxOutRef({
                    id: txHash,
                    index: index
                }),
            });
            this.debug(2, `Adding output ${utxo.utxoRef.toString()} to ledger`);
            this.addUtxoToLedger(utxo);
        }

        // Process withdrawals
        // Note: We're not really putting rewards in the accounts so far so need to fix that. TODO
        if (tx.body.withdrawals) {
            for (const withdraw of tx.body.withdrawals.map) {
            const rewardAddress = withdraw.rewardAccount;
            const amount = withdraw.amount;
            const staking = this.stakeAddresses.get(rewardAddress.toString());
            if (staking) {
                staking.rewards -= amount;
            }
            }
        }
    
        // Process certificates
        // Note: Not implemented yet. TODO

        // Store any new datum in the datum table
        if (tx.witnesses.datums) {
            for (const [datumHash, datum] of tx.witnesses.datums.entries()) {
                this.datumTable.set(datumHash.toString(), datum);
            }
        }

        // ...? 
    }

    /** Submit a transaction to the mempool
      * @param txCBOR Transaction to submit (CBOR or Tx object)
      * @returns Transaction hash
      * Note: [RS] I think we should allow users to transactions that will fail script validation
     */
    async submitTx (txCBOR: string | Tx): Promise<string> {
        const tx = txCBOR instanceof Tx ? txCBOR : Tx.fromCbor(txCBOR);

        this.debug(1, `Submitting transaction ${tx.hash.toString()}`);
        this.debug(1, `Transaction body: ${JSON.stringify(tx.body)}`);

        const isValidTx = await this.validateTx(tx);
        if (isValidTx) {
            // Add the transaction to the mempool
            this.mempool.enqueue(tx);
            this.debug(1, `Transaction ${tx.hash.toString()} is valid: Adding to mempool, length: ${this.mempool.length}.`);
        }

        return Promise.resolve(tx.hash.toString());        
    }

    /**
     * Validate a transaction against the current state
     * @param tx Transaction to validate
     * TOBEREPLACED: By the TxBuilder validation
     */
    private async validateTx(tx: Tx): Promise<boolean> {
        const txHash = tx.hash.toString();
        
        this.debug(2, `Validating transaction: ${txHash}`);
        
        // 0. Check that the transaction is well-formed
        if (!tx.body) {
            this.debug(0,"Invalid transaction: no body.");
            return false;
        }

        // 1. Check that the inputs are present in the ledger
        for (const input of tx.body.inputs) {
            const inputStr = forceTxOutRefStr(input);
            if (!this.utxos.has(inputStr)) {
                this.debug(0,`Input ${inputStr} not found in the ledger.`);
                return false;
            }
        }
        // 2. Check that the transaction is well-balanced, i.e. everything in inputs is in outputs 
        // Note: Only lovelaces are checked here. Assets are not checked yet.
        const inputLovelaces = tx.body.inputs.reduce((acc, input) => {
            const utxo = this.utxos.get(forceTxOutRefStr(input));
            return acc + (utxo ? utxo.resolved.value.lovelaces : 0n);
        }, 0n);
        const outputLovelaces = tx.body.outputs.reduce((acc, output) => {
            return acc + output.value.lovelaces;
        }, 0n);

        // Don't forget to add the fee to the output
        if (inputLovelaces !== outputLovelaces + (tx.body.fee || 0n)) {
            this.debug(0,`Transaction ${txHash} is not well-balanced: inputs ${inputLovelaces}, outputs ${outputLovelaces}, fee ${tx.body.fee || 0n}`);
            return false;
        }

        // 3. Check that the transaction has at least one input
        // Note: A Tx can have no output: e.g. https://cexplorer.io/tx/d2a2098fabb73ace002e2cf7bf7131a56723cd0745b1ef1a4f9e29fd27c0eb68
        if (tx.body.inputs.length === 0) {
             this.debug(0, "Transaction must have at least one input or mint tokens");
        }

        // 4. Check for duplicate inputs
        const inputSet = new Set<string>();
        for (const input of tx.body.inputs) {
            const inputStr = forceTxOutRefStr(input);
            
            if (inputSet.has(inputStr)) {
                this.debug(0,`Duplicate input detected: ${inputStr}`);
                return false;
            }
            inputSet.add(inputStr);
        }
        
        // 5. Check transaction size against limit
        const txSize = this.getTxSize(tx);
        const maxTxSize = this.protocolParameters.maxTxSize;
        if (txSize > maxTxSize) {
            this.debug(0,`Transaction size (${txSize} bytes) exceeds maximum allowed size (${maxTxSize} bytes)`);
            return false;
        }
        
        // 6. Check that the fee is sufficient
        const calculatedFee = this.calculateMinFee(tx);
        const providedFee = tx.body.fee || 0n;
        
        if (providedFee < calculatedFee) {
            this.debug(0,`Insufficient fee: provided ${providedFee}, required at least ${calculatedFee}`);
        }

        // 7. Validity range
        // Note: Simple implementation with no regard for the stability window.
        const lowerBound = tx.body.validityIntervalStart;
        const upperBound = tx.body.ttl;

        if (lowerBound !== undefined && (this.slot) < lowerBound) {
            this.debug(0, `Transaction ${txHash} is not valid yet. Current slot: ${this.slot}, lower bound: ${lowerBound}`);
            return false;
        }
        if (upperBound !== undefined && (this.slot) > upperBound) {
            this.debug(0, `Transaction ${txHash} has expired. Current slot: ${this.slot}, upper bound: ${upperBound}`);
            return false;
        }

        this.debug(2, `Transaction ${txHash} is valid in the current slot ${this.slot} at time: (${this.fromSlotToPosix(this.slot)}), validity start: ${lowerBound}, end: ${upperBound}`);
        return true;

        
        
    }


}