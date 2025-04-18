import type { GrepOptions } from "shared";

/**
 * Builds a regex filter based on the user's options
 */
export function buildRegexFilter(regex: RegExp, options: GrepOptions): string {
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
 * Extract all matches from a string based on the regex and matchGroups
 */
export function extractMatches(
  text: string,
  regex: RegExp,
  matchGroups: number[] | null
): string[] {
  if (!text) return [];

  const matches = Array.from(text.matchAll(new RegExp(regex, "g")));
  if (!matches.length) return [];

  const results: string[] = [];

  for (const match of matches) {
    if (!matchGroups || matchGroups.length === 0) {
      results.push(match[0]);
      continue;
    }

    let foundMatch = false;
    for (const groupIndex of matchGroups) {
      if (match[groupIndex] !== undefined) {
        results.push(match[groupIndex]);
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      results.push(match[0]);
    }
  }

  return results;
}

/**
 * Executes a query with periodic checks for cancellation
 */
export async function executeQueryWithCancellationCheck<T>(
  promise: Promise<T>,
  isActiveCheck: () => boolean
): Promise<T> {
  return new Promise<T>(async (resolve, reject) => {
    const checkInterval = setInterval(() => {
      if (!isActiveCheck()) {
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
