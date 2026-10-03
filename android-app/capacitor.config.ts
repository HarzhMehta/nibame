import type { CapacitorConfig } from "@capacitor/cli";

const webUrl = process.env.NIBAME_WEB_URL ?? "https://nibamedeploy.vercel.app";

const config: CapacitorConfig = {
  appId: "com.harshmehta.nibame",
  appName: "nibame",
  webDir: "www",
  backgroundColor: "#171a1a",
  server: {
    url: webUrl,
    cleartext: webUrl.startsWith("http://"),
  },
  android: {
    backgroundColor: "#171a1a",
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      style: "DARK",
      hidden: false,
    },
  },
};

export default config;
