/**
 * Reading and writing the JSON files in data/.
 *
 * Both clients and jobs are kept this way, so the fiddly parts - creating the
 * folder, coping with a file that does not exist yet, saving without risk of
 * corruption - live here once instead of in each of them.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * Everything in one file, as a list of not-yet-checked values. The caller is
 * responsible for looking at each one and deciding whether it is the shape it
 * expects, because a file edited by hand can contain anything at all.
 */
export async function readJsonList(fileName: string): Promise<unknown[]> {
  let contents: string;
  try {
    contents = await readFile(path.join(DATA_DIR, fileName), "utf8");
  } catch (error) {
    // No file yet simply means nothing saved yet, which is not an error.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  if (contents.trim() === "") return [];

  const parsed: unknown = JSON.parse(contents);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Save a list back to disk.
 *
 * Written to a temporary file first, then renamed over the real one. A rename
 * either happens completely or not at all, so a crash mid-save leaves the
 * previous contents intact rather than half a file of broken JSON.
 */
export async function writeJsonList(
  fileName: string,
  items: unknown[],
): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const target = path.join(DATA_DIR, fileName);
  const temporaryFile = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(items, null, 2)}\n`, "utf8");
  await rename(temporaryFile, target);
}
