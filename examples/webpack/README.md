# @boperators/example-webpack

A minimal example of `@boperators/webpack-loader` with a standard webpack 5 setup.

## Setup

> **Windows:** [Developer Mode](ms-settings:developers) must be enabled before running `bun install`
> (`Settings → System → For developers → Developer Mode`). Bun uses symlinks to link the local
> boperators packages, which requires this permission on Windows.

Build the monorepo packages first, then install and build this example:

```sh
# From the repo root
bun run build

# Then from this directory
bun install
bun run build
```

Run the bundle:

```sh
node dist/bundle.js
# Vec2(4, 6)
```
