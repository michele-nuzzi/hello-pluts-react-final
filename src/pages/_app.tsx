import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { ChakraProvider } from '@chakra-ui/react';
import { MeshProvider } from "@meshsdk/react";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider
      toastOptions={{
        defaultOptions: {
          position: "top-right",
          variant: "left-accent",
          isClosable: true,
          duration: 10_000
        }
      }}
    >
      <MeshProvider>
        <Component {...pageProps} />
      </ MeshProvider>
    </ChakraProvider>
  )
}
