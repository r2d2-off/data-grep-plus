import { DefineEvents, SDK } from "caido:plugin";

export type BackendEvents = DefineEvents<{
  "caidogrep:progress": (progress: number) => void;
  "caidogrep:matches": (matches: Set<string>) => void;
}>;

export type CaidoBackendSDK = SDK<never, BackendEvents>;
