import { PoolKeyHash } from "@harmoniclabs/plu-ts";

export interface StakeAddressInfos {
    registered: boolean;
    poolId?: PoolKeyHash;
    rewards: bigint;
}