# @boperators/plugin-bun

Bun plugin for [boperators](../../package/) - transforms operator overloads at runtime.

When loaded, this plugin intercepts `.ts` file loads and applies operator overload transformations on the fly, so you can run your code directly with Bun without a separate build step.

## Installation

```sh
bun add @boperators/plugin-bun
```

## Setup

Import the plugin at the top of your entry file, before any code that uses operator overloads:

```typescript
import "@boperators/plugin-bun";
```

This registers a Bun plugin that intercepts `.ts` file loads. For each file, it:
1. Resolves dependencies and scans them for overload definitions
2. Transforms binary expressions to overload calls
3. Returns the transformed source to Bun

## License

MIT
