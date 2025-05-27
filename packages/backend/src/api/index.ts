import type { GrepOptions, CustomRegex } from "shared";
import { grepService } from "../services/grep";
import { getStorageService } from "../services/storage";
import type { CaidoBackendSDK } from "../types";
import {
  CustomRegexSchema,
  GrepOptionsSchema,
  RegexIdSchema,
  GrepPatternSchema,
} from "../validation/schemas";
import { handleValidationError } from "../validation/utils";

/**
 * Search through requests and responses based on a regex pattern
 */
export const grepRequests = async (
  sdk: CaidoBackendSDK,
  pattern: string,
  options: GrepOptions
): Promise<{
  data?: { matchesCount?: number; timeTaken?: number };
  error?: string;
}> => {
  try {
    const validatedPattern = GrepPatternSchema.parse(pattern);
    const validatedOptions = GrepOptionsSchema.parse(options);
    return grepService.grepRequests(sdk, validatedPattern, validatedOptions);
  } catch (error) {
    return { error: handleValidationError(error) };
  }
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

export const upsertCustomRegex = async (
  sdk: CaidoBackendSDK,
  id: string,
  regex: CustomRegex
): Promise<{
  data?: { success: boolean };
  error?: string;
}> => {
  try {
    const validatedId = RegexIdSchema.parse(id);
    const validatedRegex = CustomRegexSchema.parse(regex);

    const storageService = getStorageService();
    await storageService.upsertCustomRegex(validatedId, validatedRegex);
    return { data: { success: true } };
  } catch (error) {
    return { error: handleValidationError(error) };
  }
};

export const listCustomRegexes = async (
  sdk: CaidoBackendSDK
): Promise<{
  data?: { id: string; regex: CustomRegex }[];
  error?: string;
}> => {
  try {
    const storageService = getStorageService();
    const regexes = await storageService.listCustomRegexes();
    return { data: regexes };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

export const deleteCustomRegex = async (
  sdk: CaidoBackendSDK,
  id: string
): Promise<{
  data?: { success: boolean };
  error?: string;
}> => {
  try {
    const validatedId = RegexIdSchema.parse(id);

    const storageService = getStorageService();
    const success = await storageService.deleteCustomRegex(validatedId);
    if (!success) {
      return { error: "Regex not found or could not be deleted" };
    }
    return { data: { success: true } };
  } catch (error) {
    return { error: handleValidationError(error) };
  }
};
