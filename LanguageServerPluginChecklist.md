```md
# TypeScript Language Service Plugin — Minimal Setup (Source Rewriting)

This describes a **TypeScript language service plugin** that rewrites the source code **before tsserver parses and type-checks it** (e.g. to support operator overloading via transformation).

---

## File structure

```

my-ts-plugin/
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ index.ts      # plugin entry point (required)
│  └─ rewrite.ts    # source rewrite logic
└─ dist/
├─ index.js
└─ rewrite.js

````

---

## package.json (essentials)

```json
{
  "name": "my-ts-plugin",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "private": true,
  "dependencies": {
    "typescript": "^5.x"
  }
}
````

The package name can be anything — `ts-plugin-*` is just a convention.

---

## Required plugin entry (`src/index.ts`)

You **must** export an `init` function that returns `{ create }`.

```ts
import ts from "typescript/lib/tsserverlibrary";

function init(modules: { typescript: typeof ts }) {
  const ts = modules.typescript;

  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const host = info.languageServiceHost;

    const originalGetSnapshot = host.getScriptSnapshot?.bind(host);
    const originalGetVersion = host.getScriptVersion?.bind(host);

    const cache = new Map<string, { version: string; text: string }>();

    host.getScriptSnapshot = (fileName: string) => {
      const snap = originalGetSnapshot?.(fileName);
      if (!snap || !fileName.endsWith(".ts")) return snap;

      const version = originalGetVersion?.(fileName) ?? "0";
      const cached = cache.get(fileName);
      if (cached?.version === version) {
        return ts.ScriptSnapshot.fromString(cached.text);
      }

      const source = snap.getText(0, snap.getLength());
      const rewritten = rewrite(source, fileName);

      cache.set(fileName, { version, text: rewritten });
      return ts.ScriptSnapshot.fromString(rewritten);
    };

    return info.languageService;
  }

  return { create };
}

export = init;
```

---

## Rewrite function (`src/rewrite.ts`)

```ts
export function rewrite(source: string, fileName: string): string {
  // Call your Bun plugin / AST transformer here
  // Must return valid TypeScript
  return source;
}
```

This function defines **what the language server actually sees**.

---

## Key hook (the important part)

* Override **`languageServiceHost.getScriptSnapshot`**
* Return a rewritten `ts.ScriptSnapshot`
* Cache by `getScriptVersion` to avoid unnecessary rewrites

This is the only required hook to rewrite TypeScript for the IDE.

---

## Optional (advanced)

Only needed if you change source length:

* Proxy `LanguageService` methods
* Map diagnostics / hover / definition spans back to original source

If your rewrite preserves character offsets, none of this is required.

---

## Enable the plugin in a project

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [
      { "name": "my-ts-plugin" }
    ]
  }
}
```

The plugin must be installed in `node_modules` (local `file:` or symlink is fine).

---

## Dev loop

1. Build plugin (`tsc -w`)
2. Restart TS server in editor
3. Log to confirm load:

```ts
info.project.projectService.logger.info("plugin loaded");
```

---

## One-line mental model

**You are not extending TypeScript — you are replacing the source code tsserver parses.**

```
```
