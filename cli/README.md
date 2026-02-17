# @boperators/cli

![Sym.JS logo](https://github.com/DiefBell/boperators/blob/653ea138f4dcd1e6b4dd112133a4942f70e91fb3/logo.png)

CLI tool for [boperators](https://www.npmjs.com/package/boperators) - transforms TypeScript files with operator overloads.

## Installation

```sh
npm install -D boperators @boperators/cli
```

## Usage

The CLI provides two subcommands via `boperate` (or the `bop` alias).

### `boperate compile`

Injects operator overloads into your TypeScript files and emits JavaScript using your `tsconfig.json` settings.

```sh
# Compile to JavaScript (output goes to tsconfig's outDir)
boperate compile

# Use a specific tsconfig
boperate compile --project ./tsconfig.custom.json

# Also save the transformed TypeScript (e.g. to feed into another build tool)
boperate compile --ts-out ./transformed

# Only produce transformed TypeScript, skip JavaScript output
boperate compile --ts-out ./transformed --no-emit

# Also write source map files
boperate compile --ts-out ./transformed --maps-out ./maps
```

The CLI reads your `tsconfig.json` to determine which files to process and where to emit output. It parses overload definitions from all files (including dependencies), but only transforms and emits files within your project directory.

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--ts-out <dir>` | `-t` | | Save the transformed TypeScript files to this directory (useful for further build tooling) |
| `--maps-out <dir>` | `-m` | | Output directory for source map files (`.map.ts`) |
| `--project <path>` | `-p` | `tsconfig.json` | Path to tsconfig.json to use |
| `--no-emit` | | | Skip JavaScript output |
| `--error-on-warning` | | `false` | Treat conflicting overload warnings as errors |

### `boperate validate`

Validates that all classes with operator overloads are properly exported. Intended for library authors to run before publishing.

```sh
# Level 1 — check every overload class is exported from its source file
boperate validate

# Level 2 — also verify each class is reachable via your package entry point
boperate validate --entry src/index.ts
```

Exit code is 1 on violations (suitable for CI / prepublish scripts). Use `--warn` to emit warnings instead of errors.

| Option | Default | Description |
|--------|---------|-------------|
| `--entry <path>` | | Source entry point for deep reachability check (e.g. `src/index.ts`) |
| `--project <path>` | `tsconfig.json` | Path to tsconfig.json to use |
| `--warn` | `false` | Emit warnings instead of exiting with an error on violations |

## Comparison with Other Approaches

| Approach | When it runs | Use case |
|----------|-------------|----------|
| **`@boperators/cli`** | Before compilation | Batch transform to disk, then compile normally |
| **`@boperators/plugin-tsc`** | During compilation | Seamless `tsc` integration, no intermediate files |
| **`@boperators/plugin-webpack`** | During bundling | Webpack projects, integrates into existing build pipeline |
| **`@boperators/plugin-bun`** | At runtime | Bun-only, transforms on module load |

## License

MIT
