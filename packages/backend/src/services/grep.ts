import type { Request, RequestsQuery, Response } from "caido:utils";
import type { GrepOptions } from "shared";
import type { CaidoBackendSDK } from "../types";
import { buildRegexFilter, executeQueryWithCancellationCheck, extractMatches } from "../utils/grep";

// Track if a grep operation is currently running
let isGrepActive = false;

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
  }
};

export const grepService = {
  /**
   * Search through requests and responses based on a regex pattern
   */
  async grepRequests(
    sdk: CaidoBackendSDK,
    pattern: string,
    options: GrepOptions
  ): Promise<{ data?: string[]; error?: string }> {
    if (isGrepActive) {
      return { error: "A grep scan is already running" };
    }

    try {
      isGrepActive = true;
      grepStore.clear();
      return await this.executeGrepSearch(sdk, pattern, options);
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

    isGrepActive = false;
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
  ): Promise<{ data?: string[]; error?: string }> {
    const project = await sdk.projects.getCurrent();
    if (!project) {
      return { error: "No project selected" };
    }

    const lastRequestId = await this.getLastRequestID(sdk);
    if (!lastRequestId) {
      return { error: "No requests found" };
    }

    const regex = new RegExp(pattern, "i");
    const matches: Set<string> = new Set();

    sdk.api.send("caidogrep:progress", 0);

    try {
      await this.fetchAndProcessRequests(
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
  },

  /**
   * Fetches requests in batches and processes them to find matches
   */
  async fetchAndProcessRequests(
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
    let sentMatchesCount = 0;

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
      const result = await executeQueryWithCancellationCheck(queryPromise, isGrepActive);

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

        const newMatches = this.findMatchesInRequestResponse(
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
              // Also add to the persistent store
              grepStore.addMatch(processedContent);
              pageUniqueNewMatches.add(processedContent);
              if (maxResults && matches.size >= maxResults) {
                break;
              }
            }
          }
        }
      }

      if (pageUniqueNewMatches.size > 0) {
        if (sentMatchesCount > 25000) {
          sdk.api.send("caidogrep:matches", pageUniqueNewMatches.size);
        } else {
          sdk.api.send("caidogrep:matches", Array.from(pageUniqueNewMatches));
          sentMatchesCount += pageUniqueNewMatches.size;
        }
      }

      // Setup for next page if available
      hasNextPage = result.pageInfo.hasNextPage;
      if (hasNextPage) {
        after = result.pageInfo.endCursor;
      }
    }
  },

  /**
   * Searches for regex matches in both request and response data
   */
  findMatchesInRequestResponse(
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
  },

  /**
   * Retrieves the ID of the last request in the database
   */
  async getLastRequestID(sdk: CaidoBackendSDK): Promise<string | null> {
    const requests = sdk.requests.query().last(1);
    const result = await requests.execute();
    return result.items[0]?.request.getId() || null;
  }
};
