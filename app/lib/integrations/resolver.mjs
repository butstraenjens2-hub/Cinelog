import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, "../../..");
const stubDir = path.join(here, "test-stubs");

const stubs = {
  "react-native": path.join(stubDir, "react-native.mjs"),
  "expo-secure-store": path.join(stubDir, "expo-secure-store.mjs"),
  "@react-native-async-storage/async-storage": path.join(stubDir, "async-storage.mjs"),
};

const exts = [".ts", ".tsx", ".mts", ".mjs", ".js", ".json"];

function resolveAlias(specifier) {
  const abs = path.join(workspace, "app", specifier.slice(2));
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  for (const ext of exts) {
    const file = abs + ext;
    if (fs.existsSync(file)) return file;
  }
  for (const ext of exts) {
    const file = path.join(abs, `index${ext}`);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (Object.prototype.hasOwnProperty.call(stubs, specifier)) {
    return { url: pathToFileURL(stubs[specifier]).href, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const file = resolveAlias(specifier);
    if (!file) throw new Error(`Cannot resolve ${specifier}`);
    return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
