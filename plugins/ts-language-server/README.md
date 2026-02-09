# @boperators/plugin-ts-language-server

TypeScript Language Server plugin for [boperators](../../package/) - provides IDE support with source mapping.

This plugin transforms operator overloads in the background and remaps positions between original and transformed source, so IDE features (hover, go-to-definition, diagnostics, completions, etc.) work correctly even though the language server sees the transformed code.

## Installation

```sh
bun add @boperators/plugin-ts-language-server
```

## Setup

Add the plugin to your `tsconfig.json`:

```json
{
    "compilerOptions": {
        "plugins": [
            { "name": "@boperators/plugin-ts-language-server" }
        ]
    }
}
```

Make sure your editor is using the workspace TypeScript version (not the built-in one) for the plugin to load.

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
