import { registerGlobals } from "@livekit/react-native";
import { registerRootComponent } from "expo";

// #region raphael-debug-domexception-precheck
try {
  // RN runtime evidence: does DOMException exist?
  // eslint-disable-next-line no-console
  console.log("[raphael-debug] DOMException:", typeof (globalThis as any).DOMException);
} catch (e) {
  // eslint-disable-next-line no-console
  console.log("[raphael-debug] DOMException check failed");
}
fetch("http://127.0.0.1:7706/ingest/49628942-0d63-4fc7-99fc-895f8b97c23c", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": "38bc55",
  },
  body: JSON.stringify({
    sessionId: "38bc55",
    runId: "pre-instrument",
    hypothesisId: "A",
    location: "app/index.ts:before-registerGlobals",
    message: "DOMException presence check",
    data: { domExceptionType: typeof (globalThis as any).DOMException },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

// #region raphael-debug-registerglobals-wrapper
try {
  registerGlobals();
  // eslint-disable-next-line no-console
  console.log("[raphael-debug] registerGlobals() succeeded");
  fetch("http://127.0.0.1:7706/ingest/49628942-0d63-4fc7-99fc-895f8b97c23c", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "38bc55",
    },
    body: JSON.stringify({
      sessionId: "38bc55",
      runId: "pre-instrument",
      hypothesisId: "A",
      location: "app/index.ts:after-registerGlobals",
      message: "registerGlobals succeeded",
      data: {},
      timestamp: Date.now(),
    }),
  }).catch(() => {});
} catch (e: any) {
  // eslint-disable-next-line no-console
  console.error("[raphael-debug] registerGlobals() threw:", e?.name, e?.message);
  fetch("http://127.0.0.1:7706/ingest/49628942-0d63-4fc7-99fc-895f8b97c23c", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "38bc55",
    },
    body: JSON.stringify({
      sessionId: "38bc55",
      runId: "pre-instrument",
      hypothesisId: "A",
      location: "app/index.ts:registerGlobals-catch",
      message: "registerGlobals threw",
      data: {
        errorName: e?.name,
        errorMessage: e?.message,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  throw e;
}
// #endregion

import App from "./App";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
