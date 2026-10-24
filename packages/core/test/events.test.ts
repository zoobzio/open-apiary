import { describe, it, expect } from "vitest";

import { makeEmitter } from "../src/events";

describe("makeEmitter", () => {
  it("calls the listeners of an event in subscription order", () => {
    const emitter = makeEmitter();
    const order: string[] = [];
    emitter.on("invoke:start", () => {
      order.push("a");
    });
    emitter.on("invoke:start", () => {
      order.push("b");
    });
    emitter.emit("invoke:start", { id: "x" });
    expect(order).toEqual(["a", "b"]);
  });

  it("passes the event to each listener", () => {
    const emitter = makeEmitter();
    const seen: unknown[] = [];
    emitter.on("invoke:end", (event) => {
      seen.push(event);
    });
    emitter.emit("invoke:end", { id: "x", status: 200, duration: 1 });
    expect(seen).toEqual([{ id: "x", status: 200, duration: 1 }]);
  });

  it("calls only the listeners of the emitted event", () => {
    const emitter = makeEmitter();
    const seen: string[] = [];
    emitter.on("invoke:start", () => {
      seen.push("start");
    });
    emitter.on("invoke:error", () => {
      seen.push("error");
    });
    emitter.emit("service:create", { id: "Db", lifetime: "singleton" });
    emitter.emit("invoke:start", { id: "x" });
    expect(seen).toEqual(["start"]);
  });

  it("removes a listener on unsubscribe and tolerates a second call", () => {
    const emitter = makeEmitter();
    const order: string[] = [];
    const offA = emitter.on("invoke:start", () => {
      order.push("a");
    });
    emitter.on("invoke:start", () => {
      order.push("b");
    });
    emitter.emit("invoke:start", { id: "x" });
    offA();
    offA();
    emitter.emit("invoke:start", { id: "x" });
    expect(order).toEqual(["a", "b", "b"]);
  });

  it("lets a listener unsubscribe itself during the call", () => {
    const emitter = makeEmitter();
    const order: string[] = [];
    const off = emitter.on("invoke:start", () => {
      order.push("once");
      off();
    });
    emitter.on("invoke:start", () => {
      order.push("after");
    });
    emitter.emit("invoke:start", { id: "x" });
    emitter.emit("invoke:start", { id: "x" });
    expect(order).toEqual(["once", "after", "after"]);
  });

  it("does not call a listener that another listener adds during the call", () => {
    const emitter = makeEmitter();
    const order: string[] = [];
    emitter.on("invoke:start", () => {
      order.push("first");
      emitter.on("invoke:start", () => {
        order.push("added");
      });
    });
    emitter.emit("invoke:start", { id: "x" });
    expect(order).toEqual(["first"]);
    emitter.emit("invoke:start", { id: "x" });
    expect(order).toEqual(["first", "first", "added"]);
  });

  it("propagates an error of a listener and skips the rest", () => {
    const emitter = makeEmitter();
    const order: string[] = [];
    emitter.on("invoke:start", () => {
      throw new Error("boom");
    });
    emitter.on("invoke:start", () => {
      order.push("after");
    });
    expect(() => emitter.emit("invoke:start", { id: "x" })).toThrow("boom");
    expect(order).toEqual([]);
  });

  it("adds a listener once when subscribed twice", () => {
    const emitter = makeEmitter();
    let calls = 0;
    const listener = () => {
      calls += 1;
    };
    emitter.on("invoke:start", listener);
    emitter.on("invoke:start", listener);
    emitter.emit("invoke:start", { id: "x" });
    expect(calls).toBe(1);
  });
});
