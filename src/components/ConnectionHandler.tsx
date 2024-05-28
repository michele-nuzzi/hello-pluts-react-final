import { Button, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, useDisclosure } from "@chakra-ui/react";
import { useWallet, useWalletList } from "@meshsdk/react";

export default function ConnectionHandler() {
  const {isOpen, onOpen, onClose} = useDisclosure();
  const {connected, connect, disconnect} = useWallet();
  const wallets = useWalletList();

  return (
    <>
      {connected ? (
        <Button size="lg" colorScheme="blue" onClick={disconnect}>
          Disconnect
        </Button> 
      ) : (
        <>
          <Button size="lg" colorScheme="blue" onClick={onOpen}>
            Connect Wallet
          </Button>
          <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>Choose a Wallet</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                {wallets.map((w, i) =>
                  <div
                    key={i}
                    className="center-child-flex-even p100-w click-pointer"
                    style={{marginBottom: '5vh'}}
                    onClick={() => {
                      connect(w.name);
                      // important to update `isOpen`
                      // and not show the modal on disconnection
                      onClose();
                    }}
                  >
                    <b>{w.name}</b>
                    <img src={w.icon} style={{ width: '48px' }} />
                  </div>
                )}
              </ModalBody>
            </ModalContent>
          </Modal>
        </>
      )}
    </>
  );
}