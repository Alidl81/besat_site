import { describe, expect, it } from "vitest";
import { createSerialSaveQueue } from "@/lib/editor/serial-save-queue";

describe("createSerialSaveQueue", () => {
  it("serializes new-record creation before the following update", async () => {
    const queue = createSerialSaveQueue<string>();
    const events: string[] = [];
    let id: string | null = null;
    const first = queue.enqueue(async () => {
      events.push("create:start");
      await Promise.resolve();
      id = "news-1";
      events.push("create:end");
      return id;
    });
    const second = queue.enqueue(async () => {
      events.push(`update:${id}`);
      return id ?? "";
    });
    await Promise.all([first, second]);
    expect(events).toEqual(["create:start", "create:end", "update:news-1"]);
  });
});
