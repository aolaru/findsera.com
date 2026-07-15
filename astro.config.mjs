// @ts-check
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import topics from "./src/data/generated/topics.generated.json" with { type: "json" };

const thinTopicPaths = new Set(
  topics
    .filter((topic) => topic.productCount < 2 && topic.roundupCount === 0)
    .map((topic) => `/topics/${topic.slug}/`)
);

export default defineConfig({
  site: "https://findsera.com",
  output: "static",
  trailingSlash: "always",
  redirects: {
    "/clusters/budget-finds": {
      status: 301,
      destination: "/guides/"
    },
    "/clusters/coffee-gear": {
      status: 301,
      destination: "/guides/"
    },
    "/clusters/home-office": {
      status: 301,
      destination: "/guides/"
    },
    "/clusters/precision-cooking": {
      status: 301,
      destination: "/guides/"
    },
    "/clusters/travel-tech": {
      status: 301,
      destination: "/guides/"
    }
  },
  integrations: [
    sitemap({
      filter: (page) => {
        const { pathname } = new URL(page);
        return pathname !== "/search/" && pathname !== "/404/" && !thinTopicPaths.has(pathname);
      }
    })
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
