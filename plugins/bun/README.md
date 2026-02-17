# @boperators/plugin-bun

![Sym.JS logo](https://github.com/DiefBell/boperators/blob/653ea138f4dcd1e6b4dd112133a4942f70e91fb3/logo.png)

Bun plugin for [boperators](https://www.npmjs.com/package/boperators) that ensures operator overloads work when running TypeScript files directly with Bun, instead of requiring an intermediate transform step.

## Installation

```sh
bun add -D boperators @boperators/plugin-bun
```

## Setup

This plugin is enabled in your Bun config file, `bunfig.toml`:

```toml
preload = ["./node_modules/@boperators/plugin-bun/index.ts"]
```

Alternatively, instead of a long file path, create a `preload.ts` file in your project root:

```typescript
import "@boperators/plugin-bun";
```

and reference that in your `bunfig.toml`:

```toml
preload = ["./preload.ts"]
```

## Comparison with Other Approaches

| Approach | When it runs | Use case |
|----------|-------------|----------|
| **`@boperators/cli`** | Before compilation | Batch transform to disk, then compile normally |
| **`@boperators/plugin-tsc`** | During compilation | Seamless `tsc` integration, no intermediate files |
| **`@boperators/plugin-webpack`** | During bundling | Webpack projects, integrates into existing build pipeline |
| **`@boperators/plugin-bun`** | At runtime | Bun-only, transforms on module load |

## License

MIT
