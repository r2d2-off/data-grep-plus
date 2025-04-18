import type { GrepOptions } from "shared";
import { grepService } from "../services/grep";
import type { CaidoBackendSDK } from "../types";

/**
 * Search through requests and responses based on a regex pattern
 */
export const grepRequests = async (
  sdk: CaidoBackendSDK,
  pattern: string,
  options: GrepOptions
): Promise<{ matchesCount?: number; error?: string }> => {
  return grepService.grepRequests(sdk, pattern, options);
};

/**
 * Stop an active grep operation
 */
export const stopGrep = async (): Promise<{
  data?: { success: boolean; message: string };
  error?: string;
}> => {
  return grepService.stopGrep();
};

/**
 * Returns all matches from the last completed grep operation
 */
export const downloadResults = async (): Promise<{
  data?: string[];
  error?: string;
}> => {
  return grepService.downloadResults();
};
