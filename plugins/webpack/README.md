# @boperators/plugin-webpack

![Sym.JS logo](https://github.com/DiefBell/boperators/blob/653ea138f4dcd1e6b4dd112133a4942f70e91fb3/logo.png)

Webpack loader for [boperators](https://www.npmjs.com/package/boperators) that transforms operator overloads during the webpack build. Runs as a pre-loader before your TypeScript loader, replacing operator expressions with function calls and generating source maps.

## Installation

```sh
npm install -D boperators @boperators/plugin-webpack ts-loader webpack
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
        loader: "@boperators/plugin-webpack",
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
  loader: "@boperators/plugin-webpack",
  options: {
    project: "./tsconfig.build.json",
  },
  exclude: /node_modules/,
}
```

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
| **`@boperators/plugin-webpack`** | During bundling | Webpack projects, integrates into existing build pipeline |
| **`@boperators/plugin-bun`** | At runtime | Bun-only, transforms on module load |

## License

MIT
