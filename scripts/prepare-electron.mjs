import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const standaloneRoot = path.join(projectRoot, ".next", "standalone");
const standaloneStaticRoot = path.join(standaloneRoot, ".next", "static");
const sourceStaticRoot = path.join(projectRoot, ".next", "static");
const publicRoot = path.join(projectRoot, "public");

await mkdir(path.join(standaloneRoot, ".next"), { recursive: true });
await rm(standaloneStaticRoot, { recursive: true, force: true });
await cp(sourceStaticRoot, standaloneStaticRoot, { recursive: true });

await rm(path.join(standaloneRoot, "public"), { recursive: true, force: true });
await cp(publicRoot, path.join(standaloneRoot, "public"), { recursive: true });
