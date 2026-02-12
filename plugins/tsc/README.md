# @boperators/plugin-tsc

![Sym.JS logo](./logo.png)

A [ts-patch](https://github.com/package/ts-patch) plugin that runs [boperators](https://www.npmjs.com/package/boperators) transformations during `tsc` compilation.

This plugin operates as a **Program Transformer** — it transforms your operator expressions before TypeScript type-checks the code, so the compiler sees valid function calls rather than unsupported operator usage on class types.

## Installation

```sh
npm install -D boperators ts-patch @boperators/plugin-tsc
```

## Configuration

Add the plugin to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@boperators/plugin-tsc",
        "transformProgram": true
      }
    ]
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `transform` | `string` | — | Must be `"@boperators/plugin-tsc"` |
| `transformProgram` | `boolean` | — | Must be `true` |
| `errorOnWarning` | `boolean` | `false` | Treat conflicting overload warnings as errors |

## Usage

Compile with `tspc` (ts-patch's compiler wrapper) instead of `tsc`:

```sh
npx tspc
```

Alternatively, patch your local TypeScript installation so `tsc` itself runs plugins:

```sh
npx ts-patch install
npx tsc
```

To make the patch persist across installs, add a `prepare` script:

```json
{
  "scripts": {
    "prepare": "ts-patch install -s"
  }
}
```

## How It Works

The plugin runs as a ts-patch Program Transformer, which executes during `ts.createProgram()` — before type-checking:

1. Creates a [ts-morph](https://ts-morph.com) Project from your tsconfig
2. Scans all source files for operator overload definitions
3. Transforms expressions in project files (e.g. `v1 + v2` becomes `Vector3["+"][0](v1, v2)`)
4. Returns a new TypeScript Program with the transformed source text

TypeScript then type-checks and emits the transformed code, which contains only valid function calls.

If transformation fails for any reason, the plugin logs the error and falls back to the original program (where operator expressions will surface as normal TypeScript type errors).

## Comparison with Other Approaches

| Approach | When it runs | Use case |
|----------|-------------|----------|
| **`@boperators/cli`** | Before compilation | Batch transform to disk, then compile normally |
| **`@boperators/plugin-tsc`** | During compilation | Seamless `tsc` integration, no intermediate files |
| **`@boperators/plugin-bun`** | At runtime | Bun-only, transforms on module load |

## License

MIT
