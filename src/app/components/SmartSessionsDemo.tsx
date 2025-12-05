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
  meeSessionActions,
  toSmartSessionsModule,
  getSudoPolicy,
} from "@biconomy/abstractjs";
import { Address, http, type Hex } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { new_sophon_testnet } from "../providers/wagmi";

// Helper function to serialize objects with BigInt
const serializeBigInt = (obj: unknown): string => {
  return JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
};

// Helper function to deserialize objects with BigInt
const deserializeBigInt = (str: string): unknown => {
  return JSON.parse(str, (_, value) => {
    if (typeof value === "string" && /^\d+$/.test(value)) {
      // Only convert if it looks like it could have been a BigInt
      try {
        return BigInt(value);
      } catch {
        return value;
      }
    }
    return value;
  });
};

export default function SmartSessionsDemo() {
  const isStaging = true;
  const sponsorshipApiKey = "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"; // Default staging api key
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(
    null
  );
  const [sessionKeyAddress, setSessionKeyAddress] = useState<string | null>(
    null
  );
  const [sessionDetails, setSessionDetails] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<
    "idle" | "preparing" | "granting" | "using"
  >("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<{
    label: string;
    text: string;
  } | null>(null);

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
    console.log(message);
  };

  // Step 1: Prepare Account and Install Sessions Module
  const prepareAccount = async () => {
    if (!walletClient || !address) {
      setError("Please connect your wallet first");
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentStep("preparing");
    setLogs([]);

    try {
      addLog("Step 1: Preparing Smart Account with Sessions Module...");

      // Create the smart account
      const smartAccount = await toMultichainNexusAccount({
        signer: walletClient,
        chainConfigurations: [
          {
            chain: new_sophon_testnet,
            transport: http(),
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
      });

      const nexusAddress = smartAccount.addressOn(new_sophon_testnet.id);
      setSmartAccountAddress(nexusAddress ?? null);
      addLog(`Smart Account Address: ${nexusAddress}`);

      // Generate a session key (this would normally be stored securely on the backend)
      const sessionPrivateKey = generatePrivateKey();
      const sessionSigner = privateKeyToAccount(sessionPrivateKey);
      setSessionKeyAddress(sessionSigner.address);
      addLog(`Session Key Generated: ${sessionSigner.address}`);

      // Store session key in localStorage for this demo
      localStorage.setItem("sessionPrivateKey", sessionPrivateKey);

      // Create Smart Sessions validator module
      const ssValidator = toSmartSessionsModule({
        signer: sessionSigner,
      });

      addLog("Installing Smart Sessions Module...");

      // Create MEE client
      const meeClient = await createMeeClient({
        account: smartAccount,
        url: getDefaultMEENetworkUrl(isStaging),
        apiKey: sponsorshipApiKey,
      });

      console.log("MEE Client created:", meeClient);

      // Extend with session actions
      const sessionsMeeClient = meeClient.extend(meeSessionActions);

      console.log("Sessions MEE Client created:", sessionsMeeClient);

      // Prepare for permissions (this will deploy account and install module if needed)
      const payload = await sessionsMeeClient.prepareForPermissions({
        smartSessionsValidator: ssValidator,
        /* feeToken: {
          address: "0x0000000000000000000000000000000000000000" as Hex,
          chainId: new_sophon_testnet.id,
        }, */
        sponsorship: true,
        sponsorshipOptions: {
          url: getDefaultMEENetworkUrl(true),
          gasTank: getDefaultMeeGasTank(true),
        },
      });

      console.log("🔑 Payload created:", payload);

      if (payload) {
        addLog("Waiting for preparation transaction...");
        await meeClient.waitForSupertransactionReceipt({
          hash: payload.hash,
        });
        addLog(`Account prepared! Tx: ${payload.hash}`);
        setTxHash(payload.hash);
      } else {
        addLog("Account already prepared!");
      }

      addLog("Step 1 Complete! Ready to grant permissions.");
      setCurrentStep("idle");
    } catch (err) {
      console.error("❌ Error preparing account:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setCurrentStep("idle");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Grant Permission to Session Key
  const grantPermission = async () => {
    if (
      !walletClient ||
      !address ||
      !smartAccountAddress ||
      !sessionKeyAddress
    ) {
      setError("Please prepare account first");
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentStep("granting");

    try {
      addLog("Step 2: Granting Permission to Session Key...");

      // Recreate smart account
      const smartAccount = await toMultichainNexusAccount({
        signer: walletClient,
        chainConfigurations: [
          {
            chain: new_sophon_testnet,
            transport: http(),
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
      });

      // Create MEE client
      const meeClient = await createMeeClient({
        account: smartAccount,
        url: getDefaultMEENetworkUrl(isStaging),
        apiKey: sponsorshipApiKey,
      });

      // Extend with session actions
      const sessionsMeeClient = meeClient.extend(meeSessionActions);

      addLog("Requesting signature to grant permission...");
      console.log("Session key address:", sessionKeyAddress);

      const sessionDetailsResult =
        await sessionsMeeClient.grantPermissionTypedDataSign({
          redeemer: sessionKeyAddress as Hex,
          actions: [
            {
              chainId: new_sophon_testnet.id,
              actionTarget: smartAccountAddress as Address,
              actionTargetSelector: "0x00000000" as Hex,
              actionPolicies: [getSudoPolicy()],
            },
          ],
        });

      setSessionDetails(sessionDetailsResult);
      // Store session details in localStorage for this demo (with BigInt support)
      localStorage.setItem(
        "sessionDetails",
        serializeBigInt(sessionDetailsResult)
      );

      addLog("Permission granted to session key!");
      addLog("Step 2 Complete! Session key can now execute transactions.");
      setCurrentStep("idle");
    } catch (err) {
      console.error("❌ Error granting permission:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setCurrentStep("idle");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Use the Session Key to Execute a Transaction
  const useSessionKey = async () => {
    if (!smartAccountAddress || !sessionKeyAddress) {
      setError("Please complete previous steps first");
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentStep("using");

    try {
      addLog("Step 3: Using Session Key to Execute Transaction...");

      // Retrieve session key from localStorage
      const sessionPrivateKey = localStorage.getItem("sessionPrivateKey");
      const storedSessionDetails = localStorage.getItem("sessionDetails");

      if (!sessionPrivateKey || !storedSessionDetails) {
        throw new Error("Session key or details not found");
      }

      const sessionSigner = privateKeyToAccount(sessionPrivateKey as Hex);
      const parsedSessionDetails = deserializeBigInt(storedSessionDetails);
      const sessionDetailsArray = Array.isArray(parsedSessionDetails)
        ? parsedSessionDetails
        : [parsedSessionDetails];

      addLog("Creating account with session signer...");

      // Create the smart account but with the session signer
      const userOwnedAccountWithSessionSigner = await toMultichainNexusAccount({
        chainConfigurations: [
          {
            chain: new_sophon_testnet,
            transport: http(),
            version: getMEEVersion(MEEVersion.V2_1_0),
            accountAddress: smartAccountAddress as Hex,
          },
        ],
        signer: sessionSigner,
      });

      // Create MEE client with session signer
      const sessionSignerMeeClient = await createMeeClient({
        account: userOwnedAccountWithSessionSigner,
        url: getDefaultMEENetworkUrl(isStaging),
        apiKey: sponsorshipApiKey,
      });

      const sessionSignerSessionMeeClient =
        sessionSignerMeeClient.extend(meeSessionActions);

      addLog("Building and sending transaction (0 ETH transfer)...");
      addLog("Executing with session permission...");

      // Use the permission to execute (send 0 ETH to the smart account itself)
      const executionPayload =
        await sessionSignerSessionMeeClient.usePermission({
          sessionDetails: sessionDetailsArray,
          mode: "ENABLE_AND_USE",
          instructions: [
            {
              chainId: new_sophon_testnet.id,
              calls: [
                {
                  to: smartAccountAddress as Address,
                  value: BigInt(0),
                  data: "0x",
                },
              ],
            },
          ],
          sponsorship: true,
          sponsorshipOptions: {
            url: getDefaultMEENetworkUrl(true),
            gasTank: getDefaultMeeGasTank(true),
          },
        });

      setTxHash(executionPayload.hash);
      addLog(`Transaction sent! Hash: ${executionPayload.hash}`);
      addLog("Waiting for confirmation...");

      await sessionSignerMeeClient.waitForSupertransactionReceipt({
        hash: executionPayload.hash,
      });

      addLog("Transaction confirmed! Session key successfully used!");
      addLog(
        "The session key executed a transaction WITHOUT requiring your signature!"
      );
      setCurrentStep("idle");
    } catch (err) {
      console.error("❌ Error using session key:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setCurrentStep("idle");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setSmartAccountAddress(null);
    setSessionKeyAddress(null);
    setSessionDetails(null);
    setTxHash(null);
    setError(null);
    setLogs([]);
    setCurrentStep("idle");
    localStorage.removeItem("sessionPrivateKey");
    localStorage.removeItem("sessionDetails");
  };

  if (!isConnected) {
    return (
      <div className="w-full max-w-4xl p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <p className="text-gray-600 dark:text-gray-400 text-center">
          Please connect your wallet to use Smart Sessions
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Smart Sessions Demo</h2>

      <div className="space-y-4">
        {/* Account Info */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Your EOA (Wallet)
          </p>
          <p className="font-mono text-sm break-all">{address}</p>
        </div>

        {smartAccountAddress && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Smart Account Address
            </p>
            <p className="font-mono text-sm break-all">{smartAccountAddress}</p>
          </div>
        )}

        {sessionKeyAddress && (
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Session Key Address
            </p>
            <p className="font-mono text-sm break-all">{sessionKeyAddress}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              ⚠️ For demo purposes, this key is stored in localStorage. In
              production, we would store it securely on the backend.
            </p>
          </div>
        )}

        {/* Transaction Hash */}
        {txHash && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Latest Transaction Hash
            </p>
            <p className="font-mono text-sm break-all mb-2">{txHash}</p>
            <a
              href={`https://block-explorer.zksync-os-testnet-sophon.zksync.dev/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 dark:text-green-400 text-sm hover:underline inline-block"
            >
              View on Block Explorer →
            </a>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg max-h-64 overflow-y-auto">
            <p className="text-sm font-semibold mb-2">Activity Log:</p>
            <div className="space-y-1">
              {logs.map((log, index) => (
                <p
                  key={index}
                  className="text-xs font-mono text-gray-600 dark:text-gray-400"
                >
                  {log}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {previewData && (
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{previewData.label}</p>
              <button
                onClick={() => setPreviewData(null)}
                className="text-xs text-indigo-700 dark:text-indigo-300 hover:underline"
              >
                Clear
              </button>
            </div>
            <pre className="mt-2 text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all">
              {previewData.text}
            </pre>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Step 1 */}
          <div className="space-y-2">
            <button
              onClick={prepareAccount}
              disabled={isLoading || currentStep !== "idle"}
              className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                isLoading || currentStep !== "idle"
                  ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
                  : smartAccountAddress
                  ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white"
                  : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
              }`}
            >
              {currentStep === "preparing"
                ? "Preparing Account..."
                : smartAccountAddress
                ? "Step 1: Account Prepared"
                : "Step 1: Prepare Account & Install Sessions Module"}
            </button>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <button
              onClick={grantPermission}
              disabled={
                isLoading || !smartAccountAddress || currentStep !== "idle"
              }
              className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                isLoading || !smartAccountAddress || currentStep !== "idle"
                  ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
                  : sessionDetails
                  ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white"
                  : "bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white"
              }`}
            >
              {currentStep === "granting"
                ? "Granting Permission..."
                : sessionDetails
                ? "Step 2: Permission Granted"
                : "Step 2: Grant Permission to Session Key"}
            </button>
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <button
              onClick={useSessionKey}
              disabled={isLoading || !sessionDetails || currentStep !== "idle"}
              className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                isLoading || !sessionDetails || currentStep !== "idle"
                  ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
                  : "bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white"
              }`}
            >
              {currentStep === "using"
                ? "Executing with Session Key..."
                : "Step 3: Use Session Key (No Signature Required!)"}
            </button>
          </div>

          {/* Reset Button */}
          {smartAccountAddress && (
            <button
              onClick={reset}
              disabled={isLoading}
              className="w-full py-2 px-4 rounded-lg font-medium transition-colors bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
            >
              Reset Demo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
