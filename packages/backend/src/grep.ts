import type { Request, RequestsQuery, Response } from "caido:utils";
import type { GrepOptions } from "shared";
import type { CaidoBackendSDK } from "./types";

// Track if a grep operation is currently running
let isGrepActive = false;

/**
 * Search through requests and responses based on a regex pattern
 *
 * Flow:
 * 1. Check if a grep operation is already running
 * 2. Set isGrepActive flag to true to prevent concurrent operations
 * 3. Execute the grep search by:
 *    - Verifying a project is selected
 *    - Getting the last request ID to calculate progress
 *    - Creating a regex from the pattern
 *    - Fetching requests in batches and processing them
 *    - Filtering for unique matches
 * 4. Return the results or error
 * 5. Reset the isGrepActive flag when done
 */
export const grepRequests = async (
  sdk: CaidoBackendSDK,
  pattern: string,
  options: GrepOptions
): Promise<{ data?: string[]; error?: string }> => {
  if (isGrepActive) {
    return { error: "A grep scan is already running" };
  }

  try {
    isGrepActive = true;
    return await executeGrepSearch(sdk, pattern, options);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  } finally {
    isGrepActive = false;
  }
};

/**
 * Stop an active grep operation
 */
export const stopGrep = async (): Promise<{
  data?: { success: boolean; message: string };
  error?: string;
}> => {
  if (!isGrepActive) {
    return {
      data: { success: false, message: "No grep scan is currently running" },
    };
  }

  isGrepActive = false;
  return {
    data: { success: true, message: "Grep scan stopped successfully" },
  };
};

/**
 * Main function that executes the grep search operation
 * Validates project, gets last request ID, creates regex pattern,
 * processes requests and returns results
 */
async function executeGrepSearch(
  sdk: CaidoBackendSDK,
  pattern: string,
  options: GrepOptions
): Promise<{ data?: string[]; error?: string }> {
  const project = await sdk.projects.getCurrent();
  if (!project) {
    return { error: "No project selected" };
  }

  const lastRequestId = await getLastRequestID(sdk);
  if (!lastRequestId) {
    return { error: "No requests found" };
  }

  const regex = new RegExp(pattern, "i");
  const matches: Set<string> = new Set();

  sdk.api.send("caidogrep:progress", 0);

  try {
    await fetchAndProcessRequests(
      sdk,
      regex,
      options,
      matches,
      Number(lastRequestId)
    );
  } catch (error) {
    throw error;
  }

  return {
    data: Array.from(matches),
  };
}
/**
 * Fetches requests in batches and processes them to find matches
 */
async function fetchAndProcessRequests(
  sdk: CaidoBackendSDK,
  regex: RegExp,
  options: GrepOptions,
  matches: Set<string>,
  lastRequestId: number
): Promise<void> {
  const {
    includeRequests = true,
    includeResponses = true,
    maxResults,
    matchGroup = null,
    onlyInScope = true,
  } = options;

  // Escape special characters in regex for the query
  const escapedRegexStr = regex.source
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  const regexFilter = `resp.raw.regex:"${escapedRegexStr}" or req.raw.regex:"${escapedRegexStr}"`;

  let matchCount = 0;
  let hasNextPage = true;
  let after: string | undefined = undefined;
  let processedRequestID = 0;
  const pageSize = 50;

  while (
    hasNextPage &&
    (!maxResults || matchCount < maxResults) &&
    isGrepActive
  ) {
    const progress = Math.min(
      Math.floor((processedRequestID / lastRequestId) * 100),
      99
    );
    sdk.api.send("caidogrep:progress", progress);

    // Build and execute query with pagination
    const query: RequestsQuery = after
      ? sdk.requests.query().filter(regexFilter).first(pageSize).after(after)
      : sdk.requests.query().filter(regexFilter).first(pageSize);

    // Execute the query with cancellation check
    const queryPromise = query.execute();
    const result = await executeQueryWithCancellationCheck(queryPromise);

    if (!isGrepActive) {
      throw new Error("Grep operation was stopped");
    }

    // Process each result
    for (const item of result.items) {
      if (!isGrepActive) {
        throw new Error("Grep operation was stopped");
      }

      processedRequestID = Number(item.request.getId());

      if (maxResults && matchCount >= maxResults) break;

      if (onlyInScope && !sdk.requests.inScope(item.request)) {
        continue;
      }

      const newMatches = findMatchesInRequestResponse(
        item.request,
        item.response,
        regex,
        matchGroup,
        includeRequests,
        includeResponses
      );

      if (newMatches.length > 0) {
        const uniqueNewMatches = newMatches.filter((match) => {
          const trimmed = match.trim();
          return !matches.has(trimmed);
        });

        for (const content of newMatches) {
          matches.add(content.trim());
          matchCount++;
          if (maxResults && matchCount >= maxResults) break;
        }

        if (uniqueNewMatches.length > 0) {
          sdk.api.send("caidogrep:matches", uniqueNewMatches);
        }
      }
    }

    // Setup for next page if available
    hasNextPage = result.pageInfo.hasNextPage;
    if (hasNextPage) {
      after = result.pageInfo.endCursor;
    }
  }
}

/**
 * Executes a query with periodic checks for cancellation
 */
async function executeQueryWithCancellationCheck<T>(
  promise: Promise<T>
): Promise<T> {
  return new Promise<T>(async (resolve, reject) => {
    const checkInterval = setInterval(() => {
      if (!isGrepActive) {
        clearInterval(checkInterval);
        reject(new Error("Grep operation was stopped"));
      }
    }, 100);

    try {
      const result = await promise;
      clearInterval(checkInterval);
      resolve(result);
    } catch (error) {
      clearInterval(checkInterval);
      reject(error);
    }
  });
}

/**
 * Searches for regex matches in both request and response data
 * Returns an array of matching strings based on user preferences
 */
function findMatchesInRequestResponse(
  request: Request,
  response: Response | undefined,
  regex: RegExp,
  matchGroup: number | null,
  includeRequests: boolean,
  includeResponses: boolean
): string[] {
  const contentMatches: string[] = [];

  if (includeRequests) {
    const rawMatch = extractMatch(
      request.getRaw()?.toText() || "",
      regex,
      matchGroup
    );
    if (rawMatch) {
      contentMatches.push(rawMatch);
    }
  }

  if (includeResponses && response) {
    const responseRawMatch = extractMatch(
      response.getRaw()?.toText() || "",
      regex,
      matchGroup
    );
    if (responseRawMatch) {
      contentMatches.push(responseRawMatch);
    }
  }

  return contentMatches;
}

/**
 * Extract the match from a string based on the regex and matchGroup
 */
function extractMatch(
  text: string,
  regex: RegExp,
  matchGroup: number | null
): string | null {
  if (!text) return null;

  const match = text.match(regex);
  if (!match) return null;

  return matchGroup !== null && match[matchGroup]
    ? match[matchGroup]
    : match[0];
}

/**
 * Retrieves the ID of the last request in the database
 * Used to calculate progress percentage during grep operation
 */
async function getLastRequestID(sdk: CaidoBackendSDK): Promise<string | null> {
  const requests = sdk.requests.query().last(1);
  const result = await requests.execute();
  return result.items[0]?.request.getId() || null;
}
