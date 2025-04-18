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
 * Builds a regex filter based on the user's options
 */
function buildRegexFilter(regex: RegExp, options: GrepOptions) {
  const { includeRequests, includeResponses, customHTTPQL } = options;
  const CLEANUP_EXTENSIONS = [
    "%.apng",
    "%.avif",
    "%.gif",
    "%.jpg",
    "%.jpeg",
    "%.pjpeg",
    "%.pjp",
    "%.png",
    "%.svg",
    "%.webp",
    "%.bmp",
    "%.ico",
    "%.cur",
    "%.tif",
    "%.tiff",
    "%.mp4",
    "%.mp3",
    "%.ttf",
  ];

  const escapedRegexStr = regex.source
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');

  let regexFilter = "";
  const filters = [];

  if (includeRequests) {
    filters.push(`req.raw.regex:"${escapedRegexStr}"`);
  }

  if (includeResponses) {
    filters.push(`resp.raw.regex:"${escapedRegexStr}"`);
  }

  if (filters.length > 0) {
    regexFilter = `(${filters.join(" or ")})`;
  }

  if (customHTTPQL) {
    regexFilter = `${customHTTPQL} and ${regexFilter}`;
  }

  if (options.skipLargeResponses) {
    // Skip responses larger than 10MB
    regexFilter = `${regexFilter} and resp.len.lt:10485760`;
  } else {
    // 100MB limit
    regexFilter = `${regexFilter} and resp.len.lt:104857600`;
  }

  for (const ext of CLEANUP_EXTENSIONS) {
    regexFilter = `${regexFilter} and req.ext.nlike:"${ext}"`;
  }

  return regexFilter;
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

  const regexFilter = buildRegexFilter(regex, options);

  let hasNextPage = true;
  let after: string | undefined = undefined;
  let processedRequestID = 0;
  const pageSize = 100;

  while (
    hasNextPage &&
    (!maxResults || matches.size < maxResults) &&
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

    // Collect all new matches for this page
    const pageUniqueNewMatches = new Set<string>();

    // Process each result
    for (const item of result.items) {
      if (!isGrepActive) {
        throw new Error("Grep operation was stopped");
      }

      processedRequestID = Number(item.request.getId());
      if (maxResults && matches.size >= maxResults) {
        break;
      }

      if (onlyInScope && !sdk.requests.inScope(item.request)) {
        continue;
      }

      const newMatches = findMatchesInRequestResponse(
        sdk,
        item.request,
        item.response,
        regex,
        matchGroup,
        includeRequests,
        includeResponses
      );
      if (newMatches.length > 0) {
        for (const content of newMatches) {
          let processedContent = content.trim();

          if (options.cleanupOutput) {
            processedContent = processedContent.replace(/[^\x20-\x7E]/g, "");
          }

          if (!matches.has(processedContent)) {
            matches.add(processedContent);
            pageUniqueNewMatches.add(processedContent);
            if (maxResults && matches.size >= maxResults) {
              break;
            }
          }
        }
      }
    }

    if (pageUniqueNewMatches.size > 0) {
      sdk.api.send("caidogrep:matches", Array.from(pageUniqueNewMatches));
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
  sdk: CaidoBackendSDK,
  request: Request,
  response: Response | undefined,
  regex: RegExp,
  matchGroup: number | null,
  includeRequests: boolean,
  includeResponses: boolean
): string[] {
  const contentMatches: string[] = [];

  if (includeRequests) {
    const rawMatches = extractMatches(
      request.getRaw()?.toText() || "",
      regex,
      matchGroup
    );
    if (rawMatches) {
      contentMatches.push(...rawMatches);
    }
  }

  if (includeResponses && response) {
    const responseRawMatches = extractMatches(
      response.getRaw()?.toText() || "",
      regex,
      matchGroup
    );

    if (responseRawMatches) {
      contentMatches.push(...responseRawMatches);
    }
  }

  return contentMatches;
}
/**
 * Extract all matches from a string based on the regex and matchGroup
 */
function extractMatches(
  text: string,
  regex: RegExp,
  matchGroup: number | null
): string[] {
  if (!text) return [];

  const matches = Array.from(text.matchAll(new RegExp(regex, "g")));
  if (!matches.length) return [];

  return matches.map((match) =>
    matchGroup !== null && match[matchGroup] ? match[matchGroup] : match[0]
  );
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
