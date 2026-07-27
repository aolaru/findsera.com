// @ts-check
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import flagshipGuideSlugs from "./src/data/flagship-guide-slugs.json" with { type: "json" };

const flagshipGuidePaths = new Set(flagshipGuideSlugs.map((slug) => `/${slug}/`));
const referencePathPattern = /^\/(?:products|topics|category)(?:\/|$)/;

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
        if (pathname === "/search/" || pathname === "/404/" || referencePathPattern.test(pathname)) {
          return false;
        }

        return !pathname.endsWith("/") || pathname === "/" || flagshipGuidePaths.has(pathname) || [
          "/about/",
          "/affiliate-disclosure/",
          "/contact/",
          "/guides/",
          "/how-we-pick-products/",
          "/privacy-policy/"
        ].includes(pathname);
      }
    })
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
