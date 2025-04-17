import { DefineEvents, SDK } from "caido:plugin";

export type BackendEvents = DefineEvents<{
  "caidogrep:progress": (progress: number) => void;
}>;

export type CaidoBackendSDK = SDK<never, BackendEvents>;
