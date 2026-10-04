import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VENT — Talk it out",
    short_name: "VENT",
    description: "A private voice-first journal that listens before it speaks.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f6f0",
    theme_color: "#f8f6f0",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
