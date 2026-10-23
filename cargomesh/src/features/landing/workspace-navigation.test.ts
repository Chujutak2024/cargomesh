import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { workspaceNavigationReducer as reduce } from "./workspace-navigation-state";
import { translate, type Locale } from "../i18n/config";

const begin = (workspace: "client" | "carrier" = "carrier") => reduce(null, { type: "begin", workspace, from: "/" })!;
test("entry waits for a committed route, never for a fake loading percentage", () => {
  const pending = begin();
  assert.equal(pending.phase, "loading");
  assert.equal(reduce(pending, { type: "route", pathname: "/" }), pending);
  assert.equal(reduce(pending, { type: "route", pathname: "/carriers" })?.phase, "leaving");
  assert.equal(reduce(null, { type: "route", pathname: "/clients" }), null);
});
test("both workspace variants preserve their destination through duplicate navigation and slow responses", () => {
  for (const workspace of ["client", "carrier"] as const) {
    const pending = begin(workspace);
    assert.equal(reduce(pending, { type: "begin", workspace: workspace === "client" ? "carrier" : "client", from: "/" }), pending);
    const slow = reduce(pending, { type: "slow" })!;
    assert.equal(slow.slow, true);
    assert.equal(slow.workspace, workspace);
    assert.equal(slow.phase, "loading");
    assert.equal(reduce(slow, { type: "reset" }), null);
    assert.equal(reduce(slow, { type: "route", pathname: `/${workspace === "client" ? "clients" : "carriers"}` })?.slow, false);
  }
});
test("login/error route commitment releases the transition; stale slow events cannot resurrect it", () => {
  const leaving = reduce(begin("client"), { type: "route", pathname: "/login" })!;
  assert.equal(leaving.phase, "leaving");
  assert.equal(reduce(leaving, { type: "slow" }), leaving);
  assert.equal(reduce(null, { type: "slow" }), null);
  assert.equal(reduce(leaving, { type: "reset" }), null);
});

type Node = { type: string; props: { children?: unknown; [key: string]: unknown } };
const jsx = (type: string, props: Node["props"]) => ({ type, props });
const load = (file: string, dependencies: Record<string, unknown>) => {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: Record<string, (props: Record<string, unknown>) => Node> = {};
  vm.runInNewContext(code, { exports, require: (name: string) => {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
    if (name in dependencies) return dependencies[name];
    throw Error(`Unexpected loader dependency: ${name}`);
  } });
  return exports;
};
const nodes = (value: unknown): Node[] => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === "object" && "props" in value ? [value as Node, ...nodes((value as Node).props.children)] : [];
const text = (value: unknown): string => typeof value === "string" || typeof value === "number" ? String(value)
  : Array.isArray(value) ? value.map(text).join(" ") : value && typeof value === "object" && "props" in value ? text((value as Node).props.children) : "";

test("landing keeps normal Next link navigation, including modified/new-tab clicks", () => {
  const selected: string[] = [];
  const { WorkspaceEntryLink } = load("./workspace-entry-link.tsx", {
    "next/link": { __esModule: true, default: "Link" },
    "./workspace-navigation": { useWorkspaceNavigation: () => (workspace: string) => selected.push(workspace) },
  });
  for (const [workspace, href] of [["Carrier", "/carriers"], ["Shipper", "/clients"]]) {
    const link = WorkspaceEntryLink({ workspace, href, className: "choice", children: "Choose workspace" });
    assert.equal(link.props.href, href);
    assert.equal(link.props.onClick, undefined);
    assert.equal(link.props.target, undefined);
    assert.equal(link.props.children, "Choose workspace");
    (link.props.onNavigate as () => void)();
  }
  assert.equal(selected.join(","), "carrier,client");
});
test("loaders render distinct decorative variants with bilingual loading copy and no fake progress", () => {
  for (const locale of ["es", "en"] as Locale[]) {
    const { WorkspaceLoader, WorkspaceLoadingScreen } = load("./workspace-loader.tsx", {
      "@/features/i18n/locale-provider": { useLocale: () => ({ t: (es: string, en: string) => translate(locale, es, en) }) },
    });
    for (const workspace of ["client", "carrier"]) {
      const tree = WorkspaceLoader({ workspace, titleId: "title", descriptionId: "description" });
      const all = nodes(tree);
      assert.ok(text(tree).includes(locale === "es" ? "Abriendo" : "Opening"));
      assert.ok(!/YOUR WORKSPACE|TU ESPACIO DE TRABAJO|One moment|Un momento/.test(text(tree)));
      assert.ok(text(tree).includes(workspace === "carrier" ? "Carrier" : locale === "es" ? "Cliente" : "Client"));
      assert.equal(tree.props["data-workspace-loader"], workspace);
      assert.ok(all.some(node => node.props.id === "title"));
      assert.ok(all.some(node => node.props.id === "description"));
      assert.ok(all.some(node => node.props["aria-hidden"] === "true"));
      const visual = all.find(node => node.props.className === (workspace === "carrier" ? "truckWrapper" : "bars"))!;
      assert.ok(visual);
      if (workspace === "client") assert.equal(nodes(visual).filter(node => node.type === "span").length, 5);
      assert.ok(!all.some(node => node.props.role === "progressbar"));
      assert.equal(WorkspaceLoadingScreen({ workspace }).props.role, "status");
    }
  }
});
test("reduced motion disables repeated motion; route skeletons stay separate from workspace entry loading", () => {
  const css = readFileSync(new URL("./workspace-loader.module.css", import.meta.url), "utf8");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation: none/);
  assert.match(css, /@media \(max-height: 560px\)/);
  for (const [file, dependency, component] of [
    ["../../app/clients/loading.tsx", "@/features/shipper-portal/client-continuity", "ClientRouteLoading"],
    ["../../app/carriers/loading.tsx", "@/features/carrier-navigation/carrier-loading", "CarrierSkeleton"],
  ]) {
    const { default: Loading } = load(file, { [dependency]: { [component]: component } });
    const tree = Loading({});
    assert.equal(tree.type, component);
    assert.equal(tree.props.shape, "dashboard");
  }
  const demo = readFileSync(new URL("../workspace-demo/workspace-demo-controls.tsx", import.meta.url), "utf8");
  assert.ok(demo.includes("<WorkspaceLoader workspace={pendingSwitch.workspace}"));
  assert.ok(demo.includes("<WorkspaceLoadingScreen workspace={workspace}"));
  const provider = readFileSync(new URL("./workspace-navigation.tsx", import.meta.url), "utf8");
  assert.ok(provider.includes("inert={blocked}"));
  assert.ok(provider.includes('window.addEventListener("pageshow", reset)'));
  assert.ok(!provider.includes("fetch("));
  assert.ok(!provider.includes("/api/auth"));
});

test("landing omits removed captions and playback button while retaining automatic decorative video", () => {
  const page = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
  assert.ok(!/From planning to delivery|Sign in to access your Client or Carrier workspace|Illustrative scene|No live tracking/.test(page));
  const planet = readFileSync(new URL("../landing-planet/landing-planet.tsx", import.meta.url), "utf8");
  assert.ok(!planet.includes("<button"));
  assert.ok(!planet.includes("Select Play"));
  assert.ok(planet.includes('intent: "auto"'));
  assert.ok(planet.includes("muted loop playsInline"));
});
