import type { DefineAPI, SDK } from "caido:plugin";
import { grepRequests, stopGrep } from "./grep";
import type { BackendEvents } from "./types";

export type { BackendEvents };

export type API = DefineAPI<{
  grepRequests: typeof grepRequests;
  stopGrep: typeof stopGrep;
}>;

export function init(sdk: SDK<API, BackendEvents>) {
  sdk.api.register("grepRequests", grepRequests);
  sdk.api.register("stopGrep", stopGrep);
}
