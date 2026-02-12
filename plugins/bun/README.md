# @boperators/plugin-bun

![Sym.JS logo](./logo.png)

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

## License

MIT
