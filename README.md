# boperators

Operator overloading for TypeScript.

`boperators` lets you define operator overloads (`+`, `-`, `*=`, `==`, etc.) on your TypeScript classes. It works by transforming your source code at the AST level using [ts-morph](https://ts-morph.com), replacing expressions like `v1 + v2` with the corresponding overload call `Vector3["+"][0](v1, v2)`.

## Quick Start

```typescript
class Vector3 {
    public x: number;
    public y: number;
    public z: number;

    // Static operator: takes two parameters
    static readonly "+" = [
        (a: Vector3, b: Vector3) =>
            new Vector3(a.x + b.x, a.y + b.y, a.z + b.z),
    ];

    // Instance operator: takes one parameter, uses `this`
    readonly "+=" = [
        function (this: Vector3, rhs: Vector3): void {
            this.x += rhs.x;
            this.y += rhs.y;
            this.z += rhs.z;
        },
    ];

    // ...
}

// Usage - these get transformed automatically:
const v3 = v1 + v2;    // => Vector3["+"][0](v1, v2)
v1 += v2;              // => v1["+="][0].call(v1, v2)
```

## Packages

| Package | Description |
|---------|-------------|
| [`boperators`](./package/) | Core library - parses overload definitions and transforms expressions |
| [`@boperators/cli`](./cli/) | CLI tool (`bop` / `boperate`) for batch transformation |
| [`@boperators/plugin-bun`](./plugins/bun/) | Bun plugin - transforms files at runtime |
| [`@boperators/plugin-ts-language-server`](./plugins/ts-language-server/) | TypeScript Language Server plugin - IDE support with source mapping |

See the [`example/`](./example/) project for a working demo.

## Development

### Prerequisites

- [Bun](https://bun.sh) (runtime, package manager, and workspace tooling)

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
  plugins/
    bun/            Bun plugin (@boperators/plugin-bun)
    ts-language-server/  TS Language Server plugin
  example/          Example project
```

## License

MIT
