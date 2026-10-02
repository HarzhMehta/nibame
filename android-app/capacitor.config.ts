import type { CapacitorConfig } from "@capacitor/cli";

const webUrl = process.env.NIBAME_WEB_URL ?? "https://nibamedeploy.vercel.app";

const config: CapacitorConfig = {
  appId: "com.harshmehta.nibame",
  appName: "nibame",
  webDir: "www",
  backgroundColor: "#07080a",
  server: {
    url: webUrl,
    cleartext: webUrl.startsWith("http://"),
  },
  android: {
    backgroundColor: "#07080a",
    allowMixedContent: false,
  },
};

export default config;
