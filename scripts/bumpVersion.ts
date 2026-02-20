import fs from "node:fs";
import path from "node:path";

/** Matches a bare semver like 1.2.3 or 1.2.3-beta.1 */
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/;

/** Returns all package directories relative to the repo root, in dependency order. */
function discoverPackageDirs(repoRoot: string): string[] {
	const dirs: string[] = [];

	// Core package must come first so its name is in the set before plugins reference it
	for (const name of ["package", "cli", "mcp-server"]) {
		if (fs.existsSync(path.join(repoRoot, name, "package.json"))) {
			dirs.push(name);
		}
	}

	// All plugins — auto-discovered so newly added plugins are picked up automatically
	const pluginsDir = path.join(repoRoot, "plugins");
	if (fs.existsSync(pluginsDir)) {
		for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
			if (
				entry.isDirectory() &&
				fs.existsSync(path.join(pluginsDir, entry.name, "package.json"))
			) {
				dirs.push(`plugins/${entry.name}`);
			}
		}
	}

	return dirs;
}

/** Collects the npm package names of all discovered boperators packages. */
function collectPackageNames(repoRoot: string, dirs: string[]): Set<string> {
	const names = new Set<string>();
	for (const dir of dirs) {
		const raw = fs.readFileSync(
			path.join(repoRoot, dir, "package.json"),
			"utf-8",
		);
		const pkg = JSON.parse(raw) as { name?: string };
		if (pkg.name) names.add(pkg.name);
	}
	return names;
}

/** Updates a single package.json in place and returns a human-readable change summary. */
function bumpPackageJson(
	pkgPath: string,
	newVersion: string,
	boperatorsNames: Set<string>,
): string[] {
	const raw = fs.readFileSync(pkgPath, "utf-8");
	const pkg = JSON.parse(raw) as Record<string, unknown>;
	const changes: string[] = [];

	const oldVersion = pkg.version as string | undefined;
	if (oldVersion !== newVersion) {
		pkg.version = newVersion;
		changes.push(`  version: ${oldVersion} → ${newVersion}`);
	}

	// Update cross-references in peerDependencies and dependencies.
	// devDependencies uses file: links and must not be touched.
	for (const field of ["peerDependencies", "dependencies"] as const) {
		const deps = pkg[field] as Record<string, string> | undefined;
		if (!deps) continue;
		for (const [name, value] of Object.entries(deps)) {
			if (
				boperatorsNames.has(name) &&
				!value.startsWith("file:") &&
				value !== newVersion
			) {
				deps[name] = newVersion;
				changes.push(`  ${field}.${name}: ${value} → ${newVersion}`);
			}
		}
	}

	if (changes.length > 0) {
		fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
	}

	return changes;
}

const bumpVersion = (newVersion: string | undefined): void => {
	if (!newVersion) {
		console.error("Usage: bun run scripts/bumpVersion.ts <version>");
		console.error("Example: bun run scripts/bumpVersion.ts 0.2.0");
		process.exit(1);
	}

	if (!SEMVER_RE.test(newVersion)) {
		console.error(`Invalid semver: "${newVersion}"`);
		process.exit(1);
	}

	const repoRoot = path.resolve(import.meta.dir, "..");
	const dirs = discoverPackageDirs(repoRoot);
	const boperatorsNames = collectPackageNames(repoRoot, dirs);

	console.log(`Bumping ${boperatorsNames.size} packages to ${newVersion}:\n`);

	let totalChanges = 0;
	for (const dir of dirs) {
		const pkgPath = path.join(repoRoot, dir, "package.json");
		const changes = bumpPackageJson(pkgPath, newVersion, boperatorsNames);
		const name = (
			JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { name: string }
		).name;
		if (changes.length > 0) {
			console.log(`${name} (${dir}/package.json)`);
			for (const line of changes) console.log(line);
			console.log();
			totalChanges += changes.length;
		}
	}

	if (totalChanges === 0) {
		console.log(`All packages are already at ${newVersion}.`);
	} else {
		console.log("Done. Commit and tag the release:");
		console.log(`  git commit -am "chore: bump version to ${newVersion}"`);
		console.log(`  git tag v${newVersion}`);
	}
};

const [_runtime, _file, newVersion] = Bun.argv;
bumpVersion(newVersion);
