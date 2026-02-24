# boperators

Operator overloading for TypeScript.

![Sym.JS logo](https://github.com/DiefBell/boperators/blob/653ea138f4dcd1e6b4dd112133a4942f70e91fb3/logo.png)

`boperators` lets you define operator overloads (`+`, `-`, `*=`, `==`, etc.) on your TypeScript classes. It works by transforming your source code at the AST level using [ts-morph](https://ts-morph.com), replacing expressions like `v1 + v2` with the corresponding overload call `Vector3["+"](v1, v2)`.

## Quick Start

```typescript
class Vector3 {
    public x: number;
    public y: number;
    public z: number;

    // Static operator: takes two parameters, returns a new instance
    static "+"(a: Vector3, b: Vector3): Vector3 {
        return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
    }

    // Instance operator: takes one parameter, mutates in place
    "+="(rhs: Vector3): void {
        this.x += rhs.x;
        this.y += rhs.y;
        this.z += rhs.z;
    }

    // ...
}

// Usage - these get transformed automatically:
const v3 = v1 + v2;    // => Vector3["+"](v1, v2)
v1 += v2;              // => v1["+="](v2)
```

Overloads defined on a parent class are automatically inherited by subclasses. For example, if `Expr` defines `+` and `*`, a `Sym extends Expr` class can use those operators without redeclaring them.

## Multiple overloads per operator

A single operator can handle multiple type combinations using standard TypeScript method overload signatures. boperators registers each signature separately and dispatches to the correct one based on the operand types at each call site:

```typescript
class Vec2 {
    // Vec2 * Vec2 → component-wise multiplication
    static "*"(a: Vec2, b: Vec2): Vec2;
    // Vec2 * number → scalar multiplication
    static "*"(a: Vec2, b: number): Vec2;
    static "*"(a: Vec2, b: Vec2 | number): Vec2 {
        if (b instanceof Vec2) return new Vec2(a.x * b.x, a.y * b.y);
        return new Vec2(a.x * b, a.y * b);
    }
}

const a = new Vec2(1, 2);
const b = new Vec2(3, 4);

a * b;   // => Vec2["*"](a, b)   → Vec2(3, 8)  — routes to the Vec2 overload
a * 2;   // => Vec2["*"](a, 2)   → Vec2(2, 4)  — routes to the number overload
```

The implementation method must accept the union of all overload parameter types; only the overload signatures (those without a body) are registered in the overload store.

## Publishing a library

If you are publishing a package that exports classes with operator overloads, consumers need to be able to import those classes for the transformed code to work. Run the following before publishing to catch any missing exports:

```sh
# Level 1 — check every overload class is exported from its source file
boperate validate

# Level 2 — also verify each class is reachable via your package entry point
boperate validate --entry src/index.ts
```

Exit code is 1 on violations (suitable for CI / prepublish scripts). Use `--warn` to emit warnings instead of errors if you want a non-blocking check.

The `validateExports` function is also available in the core API for programmatic use:

```typescript
import { validateExports } from "boperators";

const result = validateExports({ project, overloadStore, projectDir, entryPoint });
for (const v of result.violations) {
    console.error(v.className, v.reason);
}
```

## Packages

| Package | Description |
|---------|-------------|
| [`boperators`](./package/) | Core library - parses overload definitions and transforms expressions |
| [`@boperators/cli`](./cli/) | CLI tool (`bop` / `boperate`) for batch transformation |
| [`@boperators/plugin-bun`](./plugins/bun/) | Bun plugin - transforms files at runtime |
| [`@boperators/plugin-ts-language-server`](./plugins/ts-language-server/) | TypeScript Language Server plugin - IDE support with source mapping |
| [`@boperators/plugin-tsc`](./plugins/tsc/) | ts-patch plugin - transforms during `tsc` compilation |
| [`@boperators/webpack-loader`](./plugins/webpack/) | Webpack loader - transforms files during webpack bundling |
| [`@boperators/plugin-vite`](./plugins/vite/) | Vite plugin - transforms files during Vite/Rollup bundling |
| [`@boperators/plugin-esbuild`](./plugins/esbuild/) | ESBuild plugin - transforms files during ESBuild bundling |
| [`@boperators/mcp-server`](./mcp-server/) | MCP server - gives AI assistants access to overload info, transform previews, and scaffolding |

See the [`example/`](./example/) project for a working demo.

## Development

### Prerequisites

- [Bun](https://bun.sh) (runtime, package manager, and workspace tooling)
- **Windows only:** [Developer Mode](ms-settings:developers) must be enabled (`Settings → System → For developers → Developer Mode`). Bun uses symlinks to link local packages, which Windows requires elevated permission for.

### Setup

```sh
git clone https://github.com/DiefBell/boperators.git
cd boperators
bun install
```

### Building

```sh
# Build all packages
bun run build

# Build individual packages
bun run build:boperators
bun run build:cli
bun run build:ts-server-plugin
```

### Running the Example

```sh
cd example
bun run transform   # Transform source files to example/transformed/
bun run start       # Run the transformed output
```

### Code Quality

This project uses [BiomeJS](https://biomejs.dev) for linting and formatting, with [Husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) for pre-commit hooks.

```sh
# Check for issues
bun run check

# Auto-fix issues
bun run check:write

# Format only
bun run format
```

### Project Structure

```
boperators/
  package/          Core library (boperators)
  cli/              CLI tool (@boperators/cli)
  mcp-server/		MCP server for agents e.g. Claude (@boperators/mcp-server)
  plugins/
    bun/            Bun plugin (@boperators/plugin-bun)
    tsc/            ts-patch plugin (@boperators/plugin-tsc)
    ts-language-server/  TS Language Server plugin
    webpack/        Webpack loader (@boperators/webpack-loader)
    vite/           Vite plugin (@boperators/plugin-vite)
    esbuild/        ESBuild plugin (@boperators/plugin-esbuild)
  examples/         Example projects
```

### Planned Features and TODO

- [x] Way better logging. Option to set a logger in the API i.e. for CLI, TS server, Bun plugin. Have log levels.
- [x] Log function names when loading overloads. Mention in docs that named functions are preferred.
- [x] TypeScript compiler plugin with ts-patch.
- [x] Ensure classes correctly inherit the overloads of their parent class(es).
- [x] Ensure that when trying to match a binary operation to its overload that we also look at the parents of each operand if they're child classes that may be compatible.
- [x] Write tests, set up CI.
- [x] MCP server for docs and tools. Allow viewing transformed for specific lines as well as whole file.
- [x] Double check this `ts-morph` dependency - can we keep it to only the core package? And put required `typescript` version in a range?
- [x] `--project` to specify a TS config file for the CLI.
- [x] Expose a lot of config options in the core API, then implement a `.bopconf.json` for plugins and the CLI.
- [x] MCP server needs a README
- [x] Fix Bun plugin
- [x] Support unary operators
- [x] Don't seem to be loading operators from libraries!
- [x] Cli/tsc tool to check if a library is valid i.e. exports all classes with overloads.
- [x] Fix CLI transformed output to match folder structure that tsc output would have
- [x] Fix intellisense hovering
- [x] Webpack plugin
- [x] NextJS/Turbopack plugin **handled by webpack one, technically it's a loader**
- [x] Vite plugin
- [x] ESBuild plugin
- [x] Add support for Mozilla / V3 source map format, use in webpack plugin.
- [ ] ~~Drop ts-morph dependency???~~ NOPE
- [ ] A lot of logic in plugins, like `transformer` in the `tsc` plugin, that could be unified in core.
- [x] Update main package's README for new plugins
- [ ] Sub-package for using Symbols
- [ ] e2e test for Bun plugin and tsc plugin
- [ ] ???

### License

MIT
