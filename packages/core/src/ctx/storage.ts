import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { PluginStorage } from "../plugin/plugin.ts";

const json = z.json();

/**
 * ctx.storage. dataDir/data.json 파일 하나에 JSON 값 하나를 저장한다.
 * 저장은 임시 파일에 쓴 뒤 이름을 바꿔서, 도중에 중단되어도 기존 파일이 깨지지 않는다.
 * 같은 플러그인의 save는 호출 순서대로 하나씩 실행된다.
 */
export function createStorage(dataDir: string): PluginStorage {
  const file = path.join(dataDir, "data.json");
  let queue: Promise<unknown> = Promise.resolve();

  const write = async (text: string) => {
    const tmp = `${file}.tmp`;
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(tmp, text);
    await fs.rename(tmp, file);
  };

  const storage: PluginStorage = {
    async save(value) {
      const text = JSON.stringify(json.parse(value)); // 잘못된 값은 쓰기 전에 거부
      const run = queue.then(() => write(text));
      queue = run.catch(() => {});
      return run;
    },
    async load<T>() {
      try {
        return JSON.parse(await fs.readFile(file, "utf8")) as T;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined; // 저장한 적 없음
        throw e;
      }
    },
  };
  return Object.freeze(storage);
}
