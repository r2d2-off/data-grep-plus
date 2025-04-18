import { DefineEvents, SDK } from "caido:plugin";

export type BackendEvents = DefineEvents<{
  "caidogrep:progress": (progress: number) => void;

  /**
   * Under 25k matches, the matches are sent as an array of strings.
   * Over 25k matches, the matches are sent as a number of matches
   */
  "caidogrep:matches": (matches: string[] | number) => void;
}>;

export type CaidoBackendSDK = SDK<never, BackendEvents>;
