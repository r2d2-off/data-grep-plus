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
