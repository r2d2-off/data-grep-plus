import type { DefineAPI, SDK } from "caido:plugin";
import { downloadResults, grepRequests, stopGrep } from "./api";
import type { BackendEvents } from "./types";

export type { BackendEvents };

export type API = DefineAPI<{
  grepRequests: typeof grepRequests;
  stopGrep: typeof stopGrep;
  downloadResults: typeof downloadResults;
}>;

export function init(sdk: SDK<API, BackendEvents>) {
  sdk.api.register("grepRequests", grepRequests);
  sdk.api.register("stopGrep", stopGrep);
  sdk.api.register("downloadResults", downloadResults);
}
