# @boperators/plugin-ts-language-server

TypeScript Language Server plugin for [boperators](../../package/) - provides IDE support with source mapping.

This plugin transforms operator overloads in the background and remaps positions between original and transformed source, so IDE features (hover, go-to-definition, diagnostics, completions, etc.) work correctly even though the language server sees the transformed code.

## Installation

```sh
bun add @boperators/plugin-ts-language-server
```

## Setup

### 1. Add the plugin to your `tsconfig.json`

```json
{
    "compilerOptions": {
        "plugins": [
            { "name": "@boperators/plugin-ts-language-server" }
        ]
    }
}
```

### 2. Configure your editor

TypeScript Language Service plugins are loaded by `tsserver`, which resolves them relative to the TypeScript installation it's using. If your editor uses its own bundled TypeScript (the default in VS Code), it won't find plugins installed in your project's `node_modules`.

#### VS Code

**1.** Add to your project's `.vscode/settings.json`:

```json
{
    "typescript.tsdk": "./node_modules/typescript/lib"
}
```

This tells VS Code where to find the workspace TypeScript installation.

**2.** Select the workspace TypeScript version: open the command palette (Ctrl/Cmd+Shift+P) → "TypeScript: Select TypeScript Version" → "Use Workspace Version".

This is the critical step. VS Code defaults to its own bundled TypeScript, which resolves plugins relative to VS Code's installation directory — not your project's `node_modules`. Switching to the workspace version makes tsserver resolve plugins from your project's `node_modules`, where `@boperators/plugin-ts-language-server` is installed.

> This choice is remembered per-workspace, so you only need to do it once.

#### Other editors

Ensure your editor's TypeScript integration uses the `typescript` package from your project's `node_modules` rather than a bundled version. The plugin must be resolvable via `require("@boperators/plugin-ts-language-server")` from the TypeScript installation directory.

### Troubleshooting

If the plugin isn't loading, enable verbose tsserver logging to diagnose:

```json
{
    "typescript.tsserver.log": "verbose"
}
```

Restart the TS server, then check the log output (shown in the VS Code Output panel → "TypeScript") for lines like:

- `Enabling plugin @boperators/plugin-ts-language-server from candidate paths: ...` — shows where tsserver is looking
- `Couldn't find @boperators/plugin-ts-language-server` — the plugin wasn't found in any candidate path
- `[boperators] Plugin loaded` — the plugin loaded successfully

## Features

- **Hover info**: Hovering over an overloaded operator shows the overload signature and JSDoc
- **Diagnostics remapping**: Errors and warnings point to the correct positions in your original source
- **Go-to-definition**: Works correctly across transformed files
- **Completions**: Autocomplete positions are remapped
- **References and rename**: Find references and rename work across transformed boundaries
- **Signature help**: Parameter hints are position-remapped

## How It Works

The plugin intercepts `getScriptSnapshot` to transform each file on the fly, building a source map between original and transformed code. All Language Service methods that accept or return positions are proxied to remap through this source map. Overload definitions are cached and invalidated when files change.

## License

MIT
