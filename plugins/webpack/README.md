# @boperators/webpack-loader

![Sym.JS logo](https://github.com/DiefBell/boperators/blob/653ea138f4dcd1e6b4dd112133a4942f70e91fb3/logo.png)

Webpack loader for [boperators](https://www.npmjs.com/package/boperators) that transforms operator overloads during the webpack build. Runs as a pre-loader before your TypeScript loader, replacing operator expressions with function calls and generating source maps.

## Installation

```sh
npm install -D boperators @boperators/webpack-loader ts-loader webpack
```

## Configuration

Add the boperators loader as an `enforce: "pre"` rule in your `webpack.config.js`, alongside your TypeScript loader:

```js
module.exports = {
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: "ts-loader",
        options: { transpileOnly: true },
        exclude: /node_modules/,
      },
      {
        test: /\.ts$/,
        enforce: "pre",
        loader: "@boperators/webpack-loader",
        exclude: /node_modules/,
      },
    ],
  },
};
```

The `enforce: "pre"` ensures boperators transforms your source before `ts-loader` compiles it.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `project` | `string` | `"tsconfig.json"` | Path to `tsconfig.json`, relative to webpack's root context |
| `errorOnWarning` | `boolean` | `false` | Treat conflicting overload warnings as errors |

Options are passed via the loader options:

```js
{
  test: /\.ts$/,
  enforce: "pre",
  loader: "@boperators/webpack-loader",
  options: {
    project: "./tsconfig.build.json",
  },
  exclude: /node_modules/,
}
```

## Next.js

### Webpack (default)

Next.js exposes webpack config via `next.config.js`. Add boperators as a pre-loader before `ts-loader` handles your TypeScript:

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    config.module.rules.push({
      test: /\.tsx?$/,
      enforce: "pre",
      loader: "@boperators/webpack-loader",
      exclude: /node_modules/,
    });
    return config;
  },
};

module.exports = nextConfig;
```

You don't need to add a separate `ts-loader` rule — Next.js already configures TypeScript compilation internally.

### Turbopack (Next.js 15+)

Turbopack supports webpack loaders via `turbopack.rules`. The boperators loader is likely compatible, but note that Turbopack's webpack loader API is partial and `this.rootContext` (used for tsconfig discovery) may not be populated. Use the `project` option to specify the tsconfig path explicitly:

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    rules: {
      "*.{ts,tsx}": {
        loaders: [
          {
            loader: "@boperators/webpack-loader",
            options: { project: "./tsconfig.json" },
          },
        ],
        as: "*.tsx",
      },
    },
  },
};

module.exports = nextConfig;
```

> **Note:** Turbopack support is best-effort. If you encounter issues, fall back to the webpack config above (removing the `--turbopack` flag from your `next dev` command).

## How It Works

The loader runs as a webpack pre-loader, executing before TypeScript compilation:

1. Creates a [ts-morph](https://ts-morph.com) Project from your tsconfig
2. Scans all source files for operator overload definitions
3. Transforms expressions in the current file (e.g. `v1 + v2` becomes `Vector3["+"][0](v1, v2)`)
4. Generates a V3 source map so stack traces and debugger breakpoints map back to your original source
5. Passes the transformed code to the next loader (e.g. `ts-loader`)

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
