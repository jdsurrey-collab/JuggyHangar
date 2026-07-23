import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";

const root = createRoot(document.getElementById("root"));
root.render(createElement(ErrorBoundary, null, createElement(App)));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline install is a nice-to-have, not required for the app to work */
    });
  });
}
