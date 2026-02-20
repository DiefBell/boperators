# @boperators/example-nextjs

A minimal Next.js 15 example using `@boperators/webpack-loader` with Turbopack.

## Setup

> **Windows:** [Developer Mode](ms-settings:developers) must be enabled before running `bun install`
> (`Settings → System → For developers → Developer Mode`). Bun uses symlinks to link the local
> boperators packages, which requires this permission on Windows.

Build the monorepo packages first, then install and start the dev server:

```sh
# From the repo root
bun run build

# Then from this directory
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.
