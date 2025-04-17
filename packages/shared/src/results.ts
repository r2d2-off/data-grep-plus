export interface Match {
  content: string;
  requestId: string;
}

export interface GrepResultsResponse {
  pattern: string;
  count: number;
  matches: Match[];
  matchGroup: number | null;
}

export interface GrepOptions {
  includeRequests: boolean;
  includeResponses: boolean;
  maxResults: number | null;
  matchGroup: number | null;
  onlyInScope: boolean;
}
