import tsRuntime from "typescript/lib/tsserverlibrary";

// TODO: use our library for this!
// TODO: caching and incremental parsing if we can make it work with the language server's caching system
const rewrite = (source: string, fileName: string) => {
	return source;
};

export function init(modules: { typescript: typeof tsRuntime }): tsRuntime.server.PluginModule {
  const ts = modules.typescript;

  function create(info: tsRuntime.server.PluginCreateInfo): tsRuntime.LanguageService {
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
