import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Panel Treasury",
    short_name: "Treasury",
    description: "Add funds across connected SMM panels from your phone.",
    start_url: "/?source=homescreen",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "browser"],
    orientation: "any",
    background_color: "#070b14",
    theme_color: "#070b14",
    lang: "en",
    categories: ["finance", "business"],
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "Add Funds", short_name: "Funds", url: "/funds", description: "Credit a panel user" },
      { name: "Panels", short_name: "Panels", url: "/panels", description: "Manage connected panels" },
      { name: "Activity Log", short_name: "Logs", url: "/logs", description: "See payment results" },
    ],
  };
}
