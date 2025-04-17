import type { Request, RequestsQuery, Response } from "caido:utils";
import type { GrepOptions, GrepResultsResponse, Match } from "shared";
import type { CaidoBackendSDK } from "./types";

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
): Promise<{ data?: GrepResultsResponse; error?: string }> => {
  if (isGrepActive) {
    return { error: "A grep scan is already running" };
  }

  try {
    isGrepActive = true;
    return await executeGrepSearch(sdk, pattern, options);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Grep operation was stopped"
    ) {
      return {
        data: {
          pattern,
          count: 0,
          matches: [],
          matchGroup: options.matchGroup,
        }
      };
    }
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
      data: { success: false, message: "No grep scan is currently running" }
    };
  }

  isGrepActive = false;
  return {
    data: { success: true, message: "Grep scan stopped successfully" }
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
): Promise<{ data?: GrepResultsResponse; error?: string }> {
  const project = await sdk.projects.getCurrent();
  if (!project) {
    return { error: "No project selected" };
  }

  const lastRequestId = await getLastRequestID(sdk);
  if (!lastRequestId) {
    return { error: "No requests found" };
  }

  const regex = new RegExp(pattern, "i");
  const matches: Match[] = [];

  sdk.api.send("caidogrep:progress", 0);

  await fetchAndProcessRequests(
    sdk,
    regex,
    options,
    matches,
    Number(lastRequestId)
  );

  const uniqueMatches = getUniqueMatches(matches);

  sdk.api.send("caidogrep:progress", 100);

  return {
    data: {
      pattern,
      count: uniqueMatches.length,
      matches: uniqueMatches,
      matchGroup: options.matchGroup,
    }
  };
}

/**
 * Fetches requests in batches and processes them to find matches
 * Handles pagination, progress reporting, and respects maxResults limit
 */
async function fetchAndProcessRequests(
  sdk: CaidoBackendSDK,
  regex: RegExp,
  options: GrepOptions,
  matches: Match[],
  lastRequestId: number
): Promise<void> {
  const {
    includeRequests = true,
    includeResponses = true,
    maxResults,
    matchGroup = null,
    onlyInScope = true,
  } = options;

  let count = 0;
  let hasNextPage = true;
  let after: string | undefined = undefined;
  let currentRequestID = 0;
  const pageSize = 50;

  while (hasNextPage && (!maxResults || count < maxResults) && isGrepActive) {
    const progress = Math.min(
      Math.floor((currentRequestID / lastRequestId) * 100),
      99
    );
    sdk.api.send("caidogrep:progress", progress);

    const query: RequestsQuery = after
      ? sdk.requests.query().first(pageSize).after(after)
      : sdk.requests.query().first(pageSize);

    const result = await query.execute();

    for (const item of result.items) {
      if (!isGrepActive) {
        throw new Error("Grep operation was stopped");
      }

      currentRequestID = Number(item.request.getId());

      if (maxResults && count >= maxResults) break;

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
        const requestId = item.request.getId();

        for (const content of newMatches) {
          matches.push({ content: content.trim(), requestId });
          count++;
          if (maxResults && count >= maxResults) break;
        }
      }
    }

    hasNextPage = result.pageInfo.hasNextPage;
    if (hasNextPage) {
      after = result.pageInfo.endCursor;
    }
  }
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
    const rawMatch = checkRequestRaw(request, regex, matchGroup);
    if (rawMatch) {
      contentMatches.push(rawMatch);
    }
  }

  if (includeResponses && response) {
    const responseRawMatch = checkResponseRaw(response, regex, matchGroup);
    if (responseRawMatch) {
      contentMatches.push(responseRawMatch);
    }
  }

  return contentMatches;
}

/**
 * Filters out duplicate matches based on content
 * Returns an array of unique Match objects
 */
function getUniqueMatches(matches: Match[]): Match[] {
  const uniqueContents = new Set<string>();

  return matches.filter((match) => {
    const trimmedContent = match.content;
    if (uniqueContents.has(trimmedContent)) {
      return false;
    }
    uniqueContents.add(trimmedContent);
    return true;
  });
}

/**
 * Checks if the raw request content matches the regex pattern
 * Returns the matched string or null if no match found
 */
function checkRequestRaw(
  request: Request,
  regex: RegExp,
  matchGroup: number | null
): string | null {
  try {
    const raw = request.getRaw().toText();
    if (raw) {
      const match = raw.match(regex);
      if (match) {
        return matchGroup !== null && match[matchGroup]
          ? match[matchGroup]
          : match[0];
      }
    }
  } catch (error) {}
  return null;
}

/**
 * Checks if the raw response content matches the regex pattern
 * Returns the matched string or null if no match found
 */
function checkResponseRaw(
  response: Response,
  regex: RegExp,
  matchGroup: number | null
): string | null {
  try {
    const raw = response.getRaw().toText();
    if (raw) {
      const match = raw.match(regex);
      if (match) {
        return matchGroup !== null && match[matchGroup]
          ? match[matchGroup]
          : match[0];
      }
    }
  } catch (error) {}
  return null;
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
