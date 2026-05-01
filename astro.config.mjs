// @ts-check
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://findsera.com",
  output: "static",
  redirects: {
    "/clusters/budget-finds": {
      status: 301,
      destination: "/guides"
    },
    "/clusters/coffee-gear": {
      status: 301,
      destination: "/guides"
    },
    "/clusters/home-office": {
      status: 301,
      destination: "/guides"
    },
    "/clusters/precision-cooking": {
      status: 301,
      destination: "/guides"
    },
    "/clusters/travel-tech": {
      status: 301,
      destination: "/guides"
    }
  },
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});
