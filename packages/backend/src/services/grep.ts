import type { Request, RequestsQuery, Response } from "caido:utils";
import type { GrepOptions } from "shared";
import type { CaidoBackendSDK } from "../types";
import {
  buildRegexFilter,
  executeQueryWithCancellationCheck,
  extractMatches,
} from "../utils/grep";

// Track if a grep operation is currently running
let isGrepActive = false;

// Keep track of ongoing operations to ensure they have completed
let stopPromise: Promise<void> | null = null;
let stopResolve: (() => void) | null = null;

// Store for grep matches
const grepStore = {
  matches: new Set<string>(),
  clear() {
    this.matches.clear();
  },
  addMatch(match: string) {
    this.matches.add(match);
  },
  getMatches() {
    return Array.from(this.matches);
  },
};

export const grepService = {
  /**
   * Search through requests and responses based on a regex pattern
   */
  async grepRequests(
    sdk: CaidoBackendSDK,
    pattern: string,
    options: GrepOptions
  ): Promise<{
    data?: { matchesCount?: number; timeTaken?: number };
    error?: string;
  }> {
    if (isGrepActive) {
      return { error: "A grep scan is already running" };
    }

    // Wait for any pending stop operation to complete
    if (stopPromise) {
      await stopPromise;
    }

    try {
      isGrepActive = true;
      grepStore.clear();
      const startTime = Date.now();
      const result = await this.executeGrepSearch(sdk, pattern, options);
      const timeTaken = Date.now() - startTime;
      return { data: { ...result, timeTaken } };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    } finally {
      isGrepActive = false;
    }
  },

  /**
   * Stop an active grep operation
   */
  async stopGrep(): Promise<{
    data?: { success: boolean; message: string };
    error?: string;
  }> {
    if (!isGrepActive) {
      return {
        data: { success: false, message: "No grep scan is currently running" },
      };
    }

    if (!stopPromise) {
      stopPromise = new Promise<void>((resolve) => {
        stopResolve = resolve;
      });
    }

    isGrepActive = false;

    await stopPromise;

    stopPromise = null;
    stopResolve = null;

    return {
      data: { success: true, message: "Grep scan stopped successfully" },
    };
  },

  /**
   * Returns all matches from the last completed grep operation
   */
  async downloadResults(): Promise<{
    data?: string[];
    error?: string;
  }> {
    if (grepStore.matches.size === 0) {
      return { error: "No grep results available" };
    }

    return { data: grepStore.getMatches() };
  },

  /**
   * Main function that executes the grep search operation
   */
  async executeGrepSearch(
    sdk: CaidoBackendSDK,
    pattern: string,
    options: GrepOptions
  ): Promise<{ matchesCount?: number; error?: string }> {
    const project = await sdk.projects.getCurrent();
    if (!project) {
      return { error: "No project selected" };
    }

    const lastRequestId = await this.getLastRequestID(sdk);
    if (!lastRequestId) {
      return { error: "No requests found" };
    }

    const regex = new RegExp(pattern, "i");
    let matchesCount = 0;

    sdk.api.send("caidogrep:progress", 0);

    try {
      matchesCount = await this.fetchAndProcessRequests(
        sdk,
        regex,
        options,
        lastRequestId
      );
    } catch (error) {
      if (stopResolve) {
        stopResolve();
      }
      throw error;
    }

    if (stopResolve) {
      stopResolve();
    }

    return {
      matchesCount,
    };
  },

  /**
   * Fetches requests in batches and processes them to find matches
   */
  async fetchAndProcessRequests(
    sdk: CaidoBackendSDK,
    regex: RegExp,
    options: GrepOptions,
    lastRequestId: number
  ): Promise<number> {
    const {
      includeRequests = true,
      includeResponses = true,
      maxResults,
      matchGroups = [0],
      onlyInScope = true,
    } = options;

    const matches: Set<string> = new Set();
    const regexFilter = buildRegexFilter(regex, options);

    let hasNextPage = true;
    let after: string | undefined = undefined;
    let processedRequestID = 0;
    const pageSize = 100;
    let sentMatchCount = 0;

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
      const result = await executeQueryWithCancellationCheck(
        queryPromise,
        () => isGrepActive
      );

      if (!isGrepActive) {
        if (stopResolve) {
          stopResolve();
        }
        throw new Error("Grep operation was stopped");
      }

      // Process each result
      for (const item of result.items) {
        if (!isGrepActive) {
          if (stopResolve) {
            stopResolve();
          }
          throw new Error("Grep operation was stopped");
        }

        processedRequestID = Number(item.request.getId());
        if (maxResults && matches.size >= maxResults) {
          break;
        }

        if (onlyInScope && !sdk.requests.inScope(item.request)) {
          continue;
        }

        const newMatches = this.findMatchesInRequestResponse(
          sdk,
          item.request,
          item.response,
          regex,
          matchGroups,
          includeRequests,
          includeResponses
        );

        if (newMatches.length > 0) {
          for (const content of newMatches) {
            let processedContent = content.trim();

            // Skip matches with non-printable characters if cleanup is enabled
            if (
              options.cleanupOutput &&
              /[^\x20-\x7E]/.test(processedContent)
            ) {
              continue;
            }

            if (processedContent.length === 0) {
              continue;
            }

            if (!matches.has(processedContent)) {
              matches.add(processedContent);
              grepStore.addMatch(processedContent);
              if (maxResults && matches.size >= maxResults) {
                break;
              }
            }
          }
        }
      }

      // Send new matches if any were found
      if (matches.size > sentMatchCount) {
        const newMatches = Array.from(matches).slice(sentMatchCount);
        if (sentMatchCount > 25000) {
          sdk.api.send("caidogrep:matches", newMatches.length);
        } else {
          sdk.api.send("caidogrep:matches", newMatches);
        }
        sentMatchCount = matches.size;
      }

      // Setup for next page if available
      hasNextPage = result.pageInfo.hasNextPage;
      if (hasNextPage) {
        after = result.pageInfo.endCursor;
      }
    }

    return matches.size;
  },

  /**
   * Searches for regex matches in both request and response data
   */
  findMatchesInRequestResponse(
    sdk: CaidoBackendSDK,
    request: Request,
    response: Response | undefined,
    regex: RegExp,
    matchGroups: number[] | null,
    includeRequests: boolean,
    includeResponses: boolean
  ): string[] {
    const contentMatches: string[] = [];

    if (includeRequests) {
      const rawMatches = extractMatches(
        request.getRaw()?.toText() || "",
        regex,
        matchGroups
      );
      if (rawMatches) {
        contentMatches.push(...rawMatches);
      }
    }

    if (includeResponses && response) {
      const responseRawMatches = extractMatches(
        response.getRaw()?.toText() || "",
        regex,
        matchGroups
      );

      if (responseRawMatches) {
        for (const match of responseRawMatches) {
          contentMatches.push(match);
        }
      }
    }

    return contentMatches;
  },

  /**
   * Retrieves the ID of the last request in the database
   */
  async getLastRequestID(sdk: CaidoBackendSDK): Promise<number | null> {
    const requests = sdk.requests.query().last(1);
    const result = await requests.execute();
    return result.items[0]?.request.getId()
      ? Number(result.items[0].request.getId())
      : null;
  },
};
