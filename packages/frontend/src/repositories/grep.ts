import { useSDK } from "@/plugins/sdk";
import type { GrepOptions } from "shared";
export const useGrepRepository = () => {
  const sdk = useSDK();

  const downloadResults = async () => {
    const { data, error } = await sdk.backend.downloadResults();

    if (error) {
      console.error("Error while downloading results: " + error);
      sdk.window.showToast("Error while downloading results: " + error, {
        variant: "error",
      });
      return;
    }

    return data;
  };

  const stopGrep = async () => {
    const { error } = await sdk.backend.stopGrep();
    if (error) {
      console.error("Failed to stop grep:", error);
      sdk.window.showToast("Failed to stop grep: " + error, {
        variant: "error",
      });
      return false;
    }

    sdk.window.showToast("Grep stopped successfully", {
      variant: "success",
    });
    return true;
  };

  const searchGrepRequests = async (pattern: string, options: GrepOptions) => {
    const { error, matchesCount } = await sdk.backend.grepRequests(
      pattern,
      options
    );
    if (error) {
      console.error("Failed to search requests:", error);
      sdk.window.showToast(error, {
        variant: "error",
      });
      return;
    }

    return matchesCount;
  };

  return {
    downloadResults,
    stopGrep,
    searchGrepRequests,
  };
};
