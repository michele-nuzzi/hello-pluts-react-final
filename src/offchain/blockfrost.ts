import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";

const provider = new BlockfrostPluts({
  projectId: "YOUR API KEY HERE", // see: https://blockfrost.io
});

export default provider;