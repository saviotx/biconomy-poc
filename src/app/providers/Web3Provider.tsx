"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import { wagmiAdapter, projectId, new_sophon_testnet } from "./wagmi";

// Set up queryClient
const queryClient = new QueryClient();

// Set up metadata
const metadata = {
  name: "ZeroDev POC",
  description: "ZeroDev Proof of Concept",
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

// Create the modal
createAppKit({
  adapters: [wagmiAdapter],
  projectId: projectId!,
  networks: [new_sophon_testnet],
  defaultNetwork: new_sophon_testnet,
  metadata: metadata,
  features: {
    analytics: false,
    email: false, // Disable email login
    socials: false, // Disable social logins
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-font-family": "inherit",
  },
});

export const Web3Provider = ({
  children,
  cookies,
}: {
  children: React.ReactNode;
  cookies: string | null;
}) => {
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies
  );

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
};
