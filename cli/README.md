# @boperators/cli

CLI tool for [boperators](../package/) - transforms TypeScript files with operator overloads.

## Installation

```sh
bun add -g @boperators/cli
# or
npm install -g @boperators/cli
```

## Usage

The CLI provides two commands: `boperate` and `bop` (alias).

```sh
# Transform and output to a directory
boperate --ts-out ./transformed

# Use a specific tsconfig
boperate --ts-out ./transformed --project ./tsconfig.custom.json

# Preview without writing files
boperate --ts-out ./transformed --dry-run
```

The CLI reads your `tsconfig.json` to determine which files to process. It parses overload definitions from all files (including dependencies), but only transforms and writes files within your project directory. The output respects your `rootDir` setting.

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--ts-out <dir>` | `-t` | | Output directory for transformed TypeScript files |
| `--project <path>` | `-p` | `tsconfig.json` | Path to tsconfig.json to use |
| `--dry-run` | `-d` | `false` | Preview only without writing files |
| `--error-on-warning` | | `false` | Treat conflicting overload warnings as errors |

## License

MIT
