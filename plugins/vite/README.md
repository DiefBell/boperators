# @boperators/plugin-vite

![Sym.JS logo](https://github.com/DiefBell/boperators/blob/653ea138f4dcd1e6b4dd112133a4942f70e91fb3/logo.png)

Vite plugin for [boperators](https://www.npmjs.com/package/boperators) that transforms operator overloads during the Vite build and during HMR. Runs as an `enforce: "pre"` plugin before TypeScript compilation, replacing operator expressions with function calls and generating V3 source maps.

## Installation

```sh
npm install -D boperators @boperators/plugin-vite
```

## Configuration

Add the plugin to your `vite.config.ts`:

```typescript
import { boperators } from "@boperators/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [boperators()],
});
```

The plugin runs with `enforce: "pre"` to ensure boperators transforms your source before Vite's TypeScript handling.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `project` | `string` | `"tsconfig.json"` | Path to `tsconfig.json`, relative to Vite's root |
| `include` | `RegExp` | `/\.tsx?$/` | File filter — only matching files are transformed |

Options are passed to the plugin factory:

```typescript
boperators({
  project: "./tsconfig.build.json",
})
```

## How It Works

The plugin initialises once when Vite resolves its config, then transforms files on demand:

1. `configResolved` — creates a [ts-morph](https://ts-morph.com) Project from your tsconfig and scans all source files for operator overload definitions
2. `transform` — for each `.ts`/`.tsx` file, syncs ts-morph's in-memory state with the current file content (so HMR edits are picked up without restarting), then replaces operator expressions (e.g. `v1 + v2` becomes `Vector3["+"][0](v1, v2)`) and returns a V3 source map so breakpoints and stack traces map back to the original source

## Comparison with Other Approaches

| Approach | When it runs | Use case |
|----------|-------------|----------|
| **`@boperators/cli`** | Before compilation | Batch transform to disk, then compile normally |
| **`@boperators/plugin-tsc`** | During compilation | Seamless `tsc` integration, no intermediate files |
| **`@boperators/webpack-loader`** | During bundling | Webpack projects, integrates into existing build pipeline |
| **`@boperators/plugin-vite`** | During bundling | Vite projects, integrates into Rollup-based pipeline |
| **`@boperators/plugin-esbuild`** | During bundling | ESBuild projects, fast bundler integration |
| **`@boperators/plugin-bun`** | At runtime | Bun-only, transforms on module load |

## License

MIT
