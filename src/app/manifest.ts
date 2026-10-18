import type { MetadataRoute } from "next";

// Lets Tickerwise be added to a home screen; iPhones only allow web push for installed apps.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tickerwise",
    short_name: "Tickerwise",
    description: "Investment research in plain English for the UK, India and the US: stocks, funds, bonds, mortgages, retirement and tax, with sourced answers, charts and planners.",
    start_url: "/",
    display: "standalone",
    background_color: "#fcfcf9",
    theme_color: "#20808d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
