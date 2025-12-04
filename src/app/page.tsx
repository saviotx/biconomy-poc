"use client";

import { useState } from "react";
import BiconomySmartAccount from "./components/BiconomySmartAccount";
import SmartSessionsDemo from "./components/SmartSessionsDemo";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"eoa" | "session">("eoa");

  return (
    <div className="font-sans flex flex-col items-center min-h-screen p-8">
      <header className="w-full max-w-4xl flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">ZeroDev POC</h1>
        <appkit-button />
      </header>

      {/* Tab Navigation */}
      <div className="w-full max-w-2xl mb-6">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("eoa")}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === "eoa"
                ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            EOA (MetaMask)
          </button>
          <button
            onClick={() => setActiveTab("session")}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === "session"
                ? "border-b-2 border-green-600 text-green-600 dark:text-green-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            Session Keys
          </button>
        </div>
      </div>

      <main className="flex flex-col gap-8 items-center w-full">
        {activeTab === "eoa" && <BiconomySmartAccount />}

        {activeTab === "session" && <SmartSessionsDemo />}
      </main>
    </div>
  );
}
