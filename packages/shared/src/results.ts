export interface GrepOptions {
  includeRequests: boolean;
  includeResponses: boolean;
  maxResults: number | null;
  matchGroup: number | null;
  onlyInScope: boolean;
  skipLargeResponses: boolean;
  customHTTPQL: string | null;
  cleanupOutput: boolean;
}

export interface GrepStatus {
  isSearching: boolean;
  progress: number;
}

export interface GrepResults {
  searchResults: string[] | null;
  uniqueMatchesCount: number;
  searchTime: number;
}
