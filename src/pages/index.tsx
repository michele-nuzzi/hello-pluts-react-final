import { useState, useEffect, ChangeEvent } from "react";
import { Container, Box, Text, Button, Input, useToast } from "@chakra-ui/react";
import { useNetwork, useWallet } from "@meshsdk/react";

import style from "@/styles/Home.module.css";
import ConnectionHandler from "@/components/ConnectionHandler";
import { lockTx } from "@/offchain/lockTx";
import { unlockTx } from "@/offchain/unlockTx";
import { Address } from "@harmoniclabs/plu-ts";

import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";

import { Emulator, initializeEmulator } from "../../package";



export default function Home() {
  const [useEmulator, setUseEmulator] = useState(false);
  const [blockfrostApiKey, setBlockfrostApiKey] = useState<string>('');
  const [provider, setProvider] = useState<Emulator | BlockfrostPluts | null>(null);
  const {wallet, connected} = useWallet();
  const network = useNetwork();
  const toast = useToast();

  useEffect(() => {
    setBlockfrostApiKey(window.localStorage.getItem('BLOCKFROST_API_KEY') || '');

    setUseEmulator(process.env.NEXT_PUBLIC_EMULATOR === "true");
  }, []);

  useEffect(() => {
    if (!wallet) return;

    if (useEmulator) {
      if (wallet && connected) {
        (async() => {
          const changeAddress = await wallet.getChangeAddress();
          // Verify that the returned value is a string
          if (typeof changeAddress !== "string") {
            throw new Error("Invalid address: Expected a string from wallet.getChangeAddress()");
          }
          // Convert the string to an Address object
          const walletAddress = Address.fromString(changeAddress);

          // Initialize emulator with UTxOs directly, not using the faucet
          const addressBalances = new Map<Address, bigint>();
          addressBalances.set(walletAddress, 15_000_000n);
          const emulator = initializeEmulator(addressBalances);
          setProvider(emulator);
        })()
      }
    } else if (blockfrostApiKey) {
      const provider = new BlockfrostPluts({ projectId: blockfrostApiKey });
      setProvider(provider);
    }
  }, [wallet, connected, useEmulator, blockfrostApiKey]);


  if (typeof network === "number" && network !== 0) {
    return (
      <div className={style.root}>
        <Container maxW="container.sm" py={12} centerContent>
          <Box bg="white" w="100%" p={8}>
            <Text fontSize="xl" mb={6}>Make sure to set your wallet in testnet mode;<br/>We are playing with funds here!</Text>
            <Button size="lg" colorScheme="blue" onClick={() => window.location.reload()}>Refresh page</Button>
          </Box>
        </Container>
      </div>
    )
  }

  const onChangeBlockfrostApiKey = (e: ChangeEvent<HTMLInputElement>) => {
    setBlockfrostApiKey(e.target.value);
    window.localStorage.setItem('BLOCKFROST_API_KEY', e.target.value);
  }

  const onLock = () => { 
    console.log("lockTx", wallet, provider);
    lockTx(wallet, provider, useEmulator)
      // lock transaction created successfully
      .then(txHash => {
        toast({
          title: `lock tx submitted ${useEmulator ? `${txHash}` : `https://preprod.cardanoscan.io/transaction/${txHash}`}`,
          status: "success"
        })
        if (useEmulator && provider && typeof provider !== "string" && "awaitBlock" in provider) {
          provider.awaitBlock(1)
        }
      })
      // lock transaction failed
      .catch(e => {
        toast({
          title: "something went wrong",
          status: "error"
        });
        console.error(e);
      });
  }

  const onUnlock = () => {
    console.log("lockTx", wallet, provider);
    unlockTx(wallet, provider, useEmulator)
      // unlock transaction created successfully
      .then(txHash => {
        toast({
          title: `unlock tx submitted ${useEmulator ? `${txHash}` : `: https://preprod.cardanoscan.io/transaction/${txHash}`}`,
          status: "success"
        })
        if (useEmulator && provider && typeof provider !== "string" && "awaitBlock" in provider) {
          provider.awaitBlock(1)
        }
      })
      // unlock transaction failed
      .catch(e => {
        toast({
          title: "something went wrong: " + e?.message ,
          status: "error"
        });
        console.error(e);
      });
  }

  return (
    <div className={style.root}>
      <Container maxW="container.sm" py={12} centerContent>
        {!useEmulator && ( <>
          <Box bg="white" w="100%" p={4} mb={4}>
            <Text fontSize="md" mb={4}>
              In order to run this example you need to provide a Blockfrost API Key<br />
              More info on <a href="https://blockfrost.io/" target="_blank" style={{color:'#0BC5EA'}}>blockfrost.io</a>
            </Text>
            <Input
              variant='filled'
              placeholder='Blockfrost API Key'
              size='lg'
              value={blockfrostApiKey}
              onChange={onChangeBlockfrostApiKey}
            />
          </Box>
        </>)}
        <Box bg="white" w="100%" p={4}>
          <ConnectionHandler isDisabled={useEmulator ? false : blockfrostApiKey === ''} />
          {(connected || useEmulator) && (
            <>
              <Button size="lg" ml={4} colorScheme="teal" isDisabled={useEmulator ? false : blockfrostApiKey === ''} onClick={onLock}>Lock 10 tADA</Button>
              <Button size="lg" ml={4} colorScheme="teal" isDisabled={useEmulator ? false : blockfrostApiKey === ''} onClick={onUnlock}>Unlock</Button>
            </>
          )}
        </Box>
      </Container>
    </div>
  );
}