export interface GrepOptions {
  includeRequests: boolean;
  includeResponses: boolean;
  maxResults: number | null;
  matchGroups: number[] | null;
  onlyInScope: boolean;
  skipLargeResponses: boolean;
  customHTTPQL: string | null;
  cleanupOutput: boolean;
}

export interface GrepStatus {
  isSearching: boolean;
  progress: number;
}

export interface GrepMatch {
  id: number;
  url: string;
  match: string;
  location: string;
  request: string;
  response?: string;
}

export interface GrepResults {
  searchResults: GrepMatch[] | null;
  uniqueMatchesCount: number;
  searchTime: number;
  cancelled: boolean;
}

export interface CustomRegex {
  name: string;
  description: string;
  regex: string;
  matchGroups?: number[];
}
