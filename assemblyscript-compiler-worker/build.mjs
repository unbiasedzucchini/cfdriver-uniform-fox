import * as esbuild from "esbuild";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";

await esbuild.build({
  entryPoints: ["src/worker.js"],
  bundle: true,
  outfile: "dist/worker.js",
  format: "esm",
  target: "esnext",
  platform: "browser",
  conditions: ["browser", "import"],
  mainFields: ["browser", "module", "main"],
  define: {
    "process.env.NODE_ENV": '"production"',
    "globalThis.process": "undefined",
  },
  plugins: [
    NodeGlobalsPolyfillPlugin({
      process: true,
      buffer: true,
    }),
    NodeModulesPolyfillPlugin(),
  ],
});

console.log("Build complete!");
