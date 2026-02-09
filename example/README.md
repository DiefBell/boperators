# @boperators/example

Example project demonstrating [boperators](../package/) operator overloading.

## What's Here

- [`src/Vector3.ts`](src/Vector3.ts) - A Vector3 class with 18 operator overloads (`+`, `+=`, `*`, `*=`, `/`, `/=`, comparisons, logical)
- [`src/Angle.ts`](src/Angle.ts) - An Angle class using the `Operator` enum for `%` and `%=`
- [`src/Matrix.ts`](src/Matrix.ts) - A basic Matrix class (no overloads yet)
- [`src/index.ts`](src/index.ts) - Entry point using operator syntax on Vector3

## Running

From the monorepo root, make sure everything is built first:

```sh
bun install
bun run build
```

Then in this directory:

```sh
# Transform source files (outputs to ./transformed/)
bun run transform

# Run the transformed output
bun run start
```

## What the Transform Does

The `transform` script runs `boperate --ts-out ./transformed`, which reads the source files and replaces operator expressions with overload calls. For example:

| Source | Transformed |
|--------|-------------|
| `v1 + v2` | `Vector3["+"][0](v1, v2)` |
| `v1 += v2` | `v1["+="][0].call(v1, v2)` |
| `v4 === v5` | `Vector3["==="][0](v4, v5)` |

The transformed files are plain TypeScript that can be run directly.

## IDE Support

This example has the `@boperators/plugin-ts-language-server` configured in its `tsconfig.json`. Make sure your editor uses the workspace TypeScript version to get hover info and correct diagnostics for overloaded operators.
