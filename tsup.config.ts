import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
    target: "es2022",
    treeshake: true,
  },
  {
    entry: ["src/react/index.tsx"],
    format: ["cjs", "esm"],
    dts: true,
    outDir: "dist/react",
    external: ["react", "react-dom"],
    sourcemap: true,
    minify: false,
    target: "es2022",
    treeshake: true,
    injectStyle: false,
  },
  {
    entry: ["src/types.ts"],
    format: ["esm"],
    dts: { only: true },
    sourcemap: false,
  },
]);
