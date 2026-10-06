import { defineConfig } from "vite";

// base "./" makes every built path relative, so the site works on a custom
// domain, on username.github.io/repo/, or from any sub-folder.
export default defineConfig({
  base: "./",
});
