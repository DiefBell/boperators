# @boperators/mcp-server

![Sym.JS logo](https://github.com/DiefBell/boperators/blob/653ea138f4dcd1e6b4dd112133a4942f70e91fb3/logo.png)

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that gives AI assistants access to operator overload information in a [boperators](https://www.npmjs.com/package/boperators) project. Useful when asking an AI to read, write, or debug operator overloads — the server lets it inspect what overloads are defined, preview transformations, generate boilerplate, and validate definitions without having to read every source file manually.

The server communicates over stdio and is launched on demand by the AI client.

## Installation

```bash
npm install -D @boperators/mcp-server
# or
bun add -D @boperators/mcp-server
```

`boperators` and a compatible TypeScript must also be present as peer dependencies.

## Tools

| Tool | Description | Requires `tsconfig` |
|------|-------------|:-------------------:|
| [`list_overloads`](#list_overloads) | List all registered overloads in the project, with optional filtering by class or operator | ✓ |
| [`transform_preview`](#transform_preview) | Preview the transformed output for a file or a line range within it | ✓ |
| [`scaffold_overloads`](#scaffold_overloads) | Generate `as const` boilerplate for a set of operators on a named class | — |
| [`validate_overloads`](#validate_overloads) | Validate overload definitions in a single file and return structured diagnostics | ✓ |
| [`explain_expression`](#explain_expression) | Reverse-engineer a transformed call expression back to its original operator and overload metadata | optional |

### `list_overloads`

Returns every overload registered in the project — class name, operator, parameter types, return convention, and source file. Accepts optional `className` and `operator` filters to narrow results.

**Inputs**

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `tsconfig` | `string` | ✓ | Absolute path to `tsconfig.json` |
| `className` | `string` | — | Filter to a specific class, e.g. `"Vector3"` |
| `operator` | `string` | — | Filter to a specific operator, e.g. `"+"` |

---

### `transform_preview`

Transforms a file and returns the original and transformed text side by side, along with a count of how many operator expressions were rewritten. When `startLine`/`endLine` are given, only that slice is returned — useful for keeping token usage low on large files.

**Inputs**

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `tsconfig` | `string` | ✓ | Absolute path to `tsconfig.json` |
| `filePath` | `string` | ✓ | Absolute path to the `.ts` file to transform |
| `startLine` | `number` | — | First line to include (1-based, inclusive) |
| `endLine` | `number` | — | Last line to include (1-based, inclusive) |

---

### `scaffold_overloads`

Generates ready-to-paste TypeScript property declarations for a list of operators on a given class. Automatically uses the correct form for each operator:

- **Static binary** (`+`, `-`, `*`, …) — `static readonly "+" = [(a: T, b: T): T => { … }] as const`
- **Comparison** (`>`, `==`, …) — static, returns `boolean`
- **Instance compound** (`+=`, `-=`, …) — instance, `function(this: T, rhs: T): void`
- **Prefix unary** (`!`, `~`) — static, one parameter
- **Postfix unary** (`++`, `--`) — instance, no parameters, returns `void`

Does not require a `tsconfig` — it is purely generative.

**Inputs**

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `className` | `string` | ✓ | The class to generate overloads for |
| `operators` | `string[]` | ✓ | Operator strings, e.g. `["+", "-", "*", "+="]` |

---

### `validate_overloads`

Runs the boperators scanning pipeline against a single file in isolation and returns structured diagnostics without modifying any state. Reports:

- **Errors** — wrong arity, missing `as const`, return type violations
- **Warnings** — duplicate/conflicting overload registrations
- The count of successfully parsed overloads

**Inputs**

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `tsconfig` | `string` | ✓ | Absolute path to `tsconfig.json` |
| `filePath` | `string` | ✓ | Absolute path to the `.ts` file to validate |

---

### `explain_expression`

Given a transformed boperators expression (e.g. `Vector3["+"][0](a, b)` or `v["+="][0].call(v, rhs)`), decodes it back to the original operator, identifies whether it is static/instance and binary/unary, and optionally enriches the result with metadata from the project's overload store.

**Inputs**

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `expression` | `string` | ✓ | The transformed call expression to explain |
| `tsconfig` | `string` | — | Absolute path to `tsconfig.json`; enables richer metadata |

---

## Setup

### Claude

For Claude Desktop:

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

For Claude Code:

Add to `.mcp.json` at the root of your project (checked in, shared with the team) or via `~/.claude/settings.json` for a user-level install:

```json
{
  "mcpServers": {
    "boperators": {
      "command": "npx",
      "args": ["--yes", "@boperators/mcp-server@latest"]
    }
  }
}
```

### GitHub Copilot (VS Code)

Add to `.vscode/mcp.json` in your workspace, 

```json
{
  "servers": {
    "boperators": {
      "command": "npx",
      "args": ["--yes", "@boperators/mcp-server@latest"]
    }
  }
}
```

Or add it directly to your VS Code `settings.json`:

```json
{
  "mcp.servers": {
    "boperators": {
      "command": "npx",
      "args": ["--yes", "@boperators/mcp-server@latest"]
    }
  }
}
```

Enable the server in the Copilot Chat panel by clicking **MCP Servers → boperators**.

## License

MIT
