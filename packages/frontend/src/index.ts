import { Classic } from "@caido/primevue";
import { createPinia } from "pinia";
import { Tooltip } from "primevue";
import PrimeVue from "primevue/config";
import { createApp } from "vue";
import { SDKPlugin } from "./plugins/sdk";
import type { FrontendSDK } from "./types";
import App from "./views/App.vue";

import "./styles/index.css";

export const init = (sdk: FrontendSDK) => {
  const app = createApp(App);
  const pinia = createPinia();

  app.use(PrimeVue, {
    unstyled: true,
    pt: Classic,
  });

  app.directive("tooltip", Tooltip);
  app.use(pinia);
  app.use(SDKPlugin, sdk);

  const root = document.createElement("div");
  Object.assign(root.style, {
    height: "100%",
    width: "100%",
  });

  root.id = "plugin--grep";

  app.mount(root);

  sdk.navigation.addPage("/grep", {
    body: root,
  });

  sdk.sidebar.registerItem("Data Grep", "/grep", {
    icon: "fas fa-search",
  });
};
