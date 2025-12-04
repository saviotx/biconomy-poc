import { cookieStorage, createStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { Chain } from "@reown/appkit/networks";

export const TESTNET_RPC_URL = "https://zksync-os-testnet-sophon.zksync.dev";

export const new_sophon_testnet = {
  id: 531050204,
  name: "Sophon testnet",
  nativeCurrency: {
    name: "Sophon",
    symbol: "SOPH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [TESTNET_RPC_URL],
    },
    public: {
      http: [TESTNET_RPC_URL],
    },
  },
  contracts: {
    multicall3: { address: "0x83c04d112adedA2C6D9037bb6ecb42E7f0b108Af" },
  },
} as const satisfies Chain;

// Get projectId from environment
export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) {
  throw new Error("Project ID is not defined");
}

// Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  projectId,
  networks: [new_sophon_testnet],
});

export const config = wagmiAdapter.wagmiConfig;
