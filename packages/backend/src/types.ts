import { DefineEvents, SDK } from "caido:plugin";
import type { GrepMatch } from "shared";

export type BackendEvents = DefineEvents<{
  "caidogrep:progress": (progress: number) => void;

  /**
   * Under 25k matches, the matches are sent as an array of match objects.
   * Over 25k matches, the matches are sent as a number of matches
   */
  "caidogrep:matches": (matches: GrepMatch[] | number) => void;
}>;

export type CaidoBackendSDK = SDK<never, BackendEvents>;
