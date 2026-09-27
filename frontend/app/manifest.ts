import type { MetadataRoute } from "next";

type NibameManifest = MetadataRoute.Manifest & {
  share_target: {
    action: string;
    method: "POST";
    enctype: "multipart/form-data";
    params: { title: string; text: string; url: string };
  };
};

/** Describe the installable app and its system share target. */
export default function manifest(): NibameManifest {
  return {
    name: "nibame",
    short_name: "nibame",
    description: "Save and organize links.",
    start_url: "/",
    display: "standalone",
    background_color: "#07080a",
    theme_color: "#07080a",
    icons: [
      {
        src: "/logo.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any",
      },
    ],
    share_target: {
      action: "/api/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  };
}
