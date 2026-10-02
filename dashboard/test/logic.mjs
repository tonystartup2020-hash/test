// Pulls every `// <logic> … // </logic>` block out of dashboard/index.html and runs them
// together in a fresh context, so the page's pure rules can be tested without a browser.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const blocks = [...html.matchAll(/\/\/ <logic>([\s\S]*?)\/\/ <\/logic>/g)].map((m) => m[1]);
if (!blocks.length) throw new Error("no // <logic> blocks found in index.html");

export function loadLogic(names) {
  const ctx = vm.createContext({});
  return vm.runInContext(`${blocks.join("\n")}\n;({ ${names.join(", ")} })`, ctx);
}
