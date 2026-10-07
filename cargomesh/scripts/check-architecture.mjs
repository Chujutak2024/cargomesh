import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const relative = file => path.relative(root, file).replaceAll('\\', '/');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}
const files = walk(root).filter(file => !/\.test\.tsx?$/.test(file));
const graph = new Map();
const clients = [];
const errors = new Set();
function resolve(file, specifier) {
  const base = specifier.startsWith('@/') ? path.join(root, specifier.slice(2)) :
    specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : null;
  if (!base) return null;
  return [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')]
    .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const imports = [];
  if (source.statements.some(node => ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression) && node.expression.text === 'use client')) clients.push(file);
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const onlyTypes = clause?.isTypeOnly || (clause && !clause.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every(e => e.isTypeOnly));
      if (!onlyTypes) imports.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && !node.isTypeOnly) {
      if (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some(e => !e.isTypeOnly)) imports.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) {
      imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  const targets = imports.map(specifier => ({ specifier, target: resolve(file, specifier) }));
  graph.set(file, targets);
  const name = relative(file);
  if (imports.includes('server-only') && !name.startsWith('server/') && !name.startsWith('app/')) errors.add(`${name}: server-only module must live in server/ or app/.`);
  for (const { target } of targets) {
    if (!target) continue;
    const dependency = relative(target);
    if (name.startsWith('shared/') && dependency.startsWith('server/')) errors.add(`${name}: shared code imports backend ${dependency}.`);
    if (name.startsWith('server/services/') && /^(server\/(hono|mcp)\/|app\/|components\/)/.test(dependency)) errors.add(`${name}: service depends on a transport/UI module ${dependency}.`);
  }
}
for (const client of clients) {
  const seen = new Set();
  function inspect(file, chain) {
    if (seen.has(file)) return;
    seen.add(file);
    for (const { specifier, target } of graph.get(file) ?? []) {
      if (specifier === 'server-only' || specifier.startsWith('node:') || (target && relative(target).startsWith('server/'))) {
        errors.add(`Browser dependency: ${chain.join(' -> ')} -> ${target ? relative(target) : specifier}`);
      } else if (target) inspect(target, [...chain, relative(target)]);
    }
  }
  inspect(client, [relative(client)]);
}
if (errors.size) {
  console.error([...errors].join('\n'));
  process.exitCode = 1;
} else console.log(`Architecture OK: ${files.length} modules; ${clients.length} client entry points checked.`);
