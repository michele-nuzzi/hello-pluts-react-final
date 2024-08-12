import { useState, useEffect, ChangeEvent } from "react";
import { Container, Box, Text, Button, Input, useToast } from "@chakra-ui/react";
import { useNetwork, useWallet } from "@meshsdk/react";

import style from "@/styles/Home.module.css";
import ConnectionHandler from "@/components/ConnectionHandler";
import { lockTx } from "@/offchain/lockTx";
import { unlockTx } from "@/offchain/unlockTx";

export default function Home() {
  const [blockfrostApiKey, setBlockfrostApiKey] = useState<string>('');
  const {wallet, connected} = useWallet();
  const network = useNetwork();
  const toast = useToast();

  useEffect(() => {
    setBlockfrostApiKey(window.localStorage.getItem('BLOCKFROST_API_KEY') || '');
  }, []);

  if (typeof network === "number" && network !== 0) {
    return (
      <div className={style.root}>
        <Container maxW="container.sm" py={12} centerContent>
          <Box bg="white" w="100%" p={8}>
            <Text fontSize="xl" mb={6}>Make sure to set your wallet in testnet mode;<br/>We are playing with founds here!</Text>
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
    lockTx(wallet, blockfrostApiKey)
      // lock transaction created successfully
      .then(txHash => toast({
        title: `lock tx submitted: https://preprod.cardanoscan.io/transaction/${txHash}`,
        status: "success"
      }))
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
    unlockTx(wallet, blockfrostApiKey)
      // unlock transaction created successfully
      .then(txHash => toast({
        title: `unlock tx submitted: https://preprod.cardanoscan.io/transaction/${txHash}`,
        status: "success"
      }))
      // unlock transaction failed
      .catch(e => {
        toast({
          title: "something went wrong: " + e?.messge ,
          status: "error"
        });
        console.error(e);
      });
  }

  return (
    <div className={style.root}>
      <Container maxW="container.sm" py={12} centerContent>
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
        <Box bg="white" w="100%" p={4}>
          <ConnectionHandler isDisabled={blockfrostApiKey === ''} />
          {connected && (
            <>
              <Button size="lg" ml={4} colorScheme="teal" isDisabled={blockfrostApiKey === ''} onClick={onLock}>Lock 10 tADA</Button>
              <Button size="lg" ml={4} colorScheme="teal" isDisabled={blockfrostApiKey === ''} onClick={onUnlock}>Unlock</Button>
            </>
          )}
        </Box>
      </Container>
    </div>
  );
}