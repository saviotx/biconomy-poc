"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  createMeeClient,
  getDefaultMeeGasTank,
  getDefaultMEENetworkUrl,
  getMEEVersion,
  MEEVersion,
  toMultichainNexusAccount,
} from "@biconomy/abstractjs";
import { http } from "viem";
import { optimismSepolia } from "viem/chains";

export default function BiconomySmartAccount() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(
    null
  );
  const [isDeploying, setIsDeploying] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deploySmartAccount = async () => {
    if (!walletClient || !address) {
      setError("Please connect your wallet first");
      return;
    }

    setIsDeploying(true);
    setError(null);
    setTxHash(null);

    try {
      console.log("🚀 Starting smart account deployment...");
      console.log("📍 EOA Address:", address);

      // Create the smart account
      const smartAccount = await toMultichainNexusAccount({
        signer: walletClient,
        chainConfigurations: [
          {
            chain: optimismSepolia,
            transport: http(),
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
      });

      // Get the Nexus address
      const nexusAddress = smartAccount.addressOn(optimismSepolia.id);
      setSmartAccountAddress(nexusAddress ?? null);

      console.log("✅ Smart Account Created:");
      console.log("   EOA:", address);
      console.log("   Nexus:", nexusAddress);

      // Create MEE client for sponsored transactions
      const isStaging = true;
      const sponsorshipApiKey = "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"; // Default staging api key

      const meeClient = await createMeeClient({
        account: smartAccount,
        url: getDefaultMEENetworkUrl(isStaging),
        apiKey: sponsorshipApiKey,
      });

      console.log("📝 Building dummy transaction to deploy smart account...");

      // Build a dummy instruction to trigger deployment
      const dummyInstruction = await smartAccount.build({
        type: "default",
        data: {
          calls: [
            {
              to: "0x0000000000000000000000000000000000000000",
              value: BigInt(0),
              data: "0x",
              gasLimit: BigInt(20000),
            },
          ],
          chainId: optimismSepolia.id,
        },
      });

      console.log("🚀 Executing transaction with sponsorship...");

      // Execute the transaction (this will deploy the smart account)
      const result = await meeClient.execute({
        instructions: [dummyInstruction],
        sponsorship: true,
        sponsorshipOptions: {
          url: getDefaultMEENetworkUrl(isStaging),
          gasTank: getDefaultMeeGasTank(isStaging),
        },
      });

      setTxHash(result.hash);

      console.log("✅ Transaction sent successfully!");
      console.log("   Transaction Hash:", result.hash);
      console.log("   Smart Account Address:", nexusAddress);
    } catch (err) {
      console.error("❌ Error deploying smart account:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsDeploying(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="w-full max-w-2xl p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <p className="text-gray-600 dark:text-gray-400 text-center">
          Please connect your wallet to deploy a smart account
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Biconomy Smart Account</h2>

      <div className="space-y-4">
        {/* EOA Info */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Your EOA (Connected Wallet)
          </p>
          <p className="font-mono text-sm break-all">{address}</p>
        </div>

        {/* Smart Account Address */}
        {smartAccountAddress && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Smart Account Address (Nexus)
            </p>
            <p className="font-mono text-sm break-all">{smartAccountAddress}</p>
            <a
              href={`https://sepolia-optimism.etherscan.io/address/${smartAccountAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 text-sm hover:underline mt-2 inline-block"
            >
              View on Etherscan →
            </a>
          </div>
        )}

        {/* Transaction Hash */}
        {txHash && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Transaction Hash
            </p>
            <p className="font-mono text-sm break-all mb-2">{txHash}</p>
            <a
              href={`https://sepolia-optimism.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 dark:text-green-400 text-sm hover:underline inline-block"
            >
              View on Etherscan →
            </a>
            <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ✅ Success! Your smart account has been deployed and a
                transaction was executed with gas sponsored by Biconomy (you
                paid $0!)
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Deploy Button */}
        <button
          onClick={deploySmartAccount}
          disabled={isDeploying}
          className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
            isDeploying
              ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
          }`}
        >
          {isDeploying
            ? "Deploying Smart Account..."
            : smartAccountAddress
            ? "Deploy Another Smart Account"
            : "Deploy Smart Account"}
        </button>

        {/* Info */}
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            💡 <strong>What will happen:</strong>
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1 ml-4 list-disc">
            <li>A Nexus smart account will be created from your EOA</li>
            <li>
              A dummy transaction will be sent to deploy the smart account
              on-chain
            </li>
            <li>Gas will be sponsored by Biconomy (you pay $0!)</li>
            <li>You can view the account and transaction on Etherscan</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
