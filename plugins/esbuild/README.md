# @boperators/plugin-esbuild

![Sym.JS logo](https://github.com/DiefBell/boperators/blob/653ea138f4dcd1e6b4dd112133a4942f70e91fb3/logo.png)

ESBuild plugin for [boperators](https://www.npmjs.com/package/boperators) that transforms operator overloads during the ESBuild bundling step, replacing operator expressions with function calls before ESBuild compiles TypeScript.

## Installation

```sh
npm install -D boperators @boperators/plugin-esbuild
```

## Configuration

ESBuild plugins can only be used via the **JavaScript API** — the ESBuild CLI does not support plugins. Create a build script (e.g. `build.cjs`) and run it with Node:

```javascript
const { build } = require("esbuild");
const { boperators } = require("@boperators/plugin-esbuild");

build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/bundle.js",
  bundle: true,
  platform: "node",
  absWorkingDir: __dirname,
  plugins: [boperators()],
}).catch(process.exit);
```

> **Important:** Set `absWorkingDir` to your project root (typically `__dirname`). The plugin uses this to resolve `tsconfig.json`.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `project` | `string` | `"tsconfig.json"` | Path to `tsconfig.json`, relative to `absWorkingDir` |
| `include` | `RegExp` | `/\.tsx?$/` | File filter — only matching files are transformed |

Options are passed to the plugin factory:

```javascript
plugins: [
  boperators({
    project: "./tsconfig.build.json",
  }),
]
```

## How It Works

The plugin initialises once inside `setup(build)`, then transforms files on demand:

1. **Setup** — creates a [ts-morph](https://ts-morph.com) Project from your tsconfig and scans all source files for operator overload definitions
2. **`build.onLoad`** — for each `.ts`/`.tsx` file that matches the filter, replaces operator expressions (e.g. `v1 + v2` becomes `Vector3["+"][0](v1, v2)`) and returns the transformed source to ESBuild with the correct `ts`/`tsx` loader

If a file contains no overloaded operators it is returned as-is with no overhead.

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
