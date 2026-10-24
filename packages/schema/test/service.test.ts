import type { Resolver } from "../src/types";
import type { ServiceClass } from "../src/service";

import { describe, it, expect } from "vitest";

import { SERVICE } from "../src/constant";
import { Service, isService, serviceId, serviceLifetime } from "../src/service";

class Plain extends Service {}

class Named extends Service {
  static override readonly id = "custom";
  static override readonly lifetime = "scoped";
}

class Other extends Service {}

class Consumer extends Service {
  other() {
    return this.use(Other);
  }
}

/** Makes a resolver that records each request and answers with one value. */
const makeResolver = (value: unknown) => {
  const seen: ServiceClass[] = [];
  const resolver: Resolver = {
    use: (service) => {
      seen.push(service);
      return value as never;
    },
  };
  return { resolver, seen };
};

describe("isService", () => {
  it("is true for a subclass", () => {
    expect(isService(Plain)).toBe(true);
    expect(isService(Named)).toBe(true);
  });

  it("is true for the base class, which carries the brand", () => {
    expect(isService(Service)).toBe(true);
  });

  it("is true for any function that carries the brand", () => {
    const branded = Object.assign(() => {}, { [SERVICE]: true });
    expect(isService(branded)).toBe(true);
    expect(SERVICE).toBe(Symbol.for("open-apiary.service"));
  });

  it("is false for functions, objects, and instances without the brand", () => {
    expect(isService(() => {})).toBe(false);
    expect(isService(class {})).toBe(false);
    expect(isService({})).toBe(false);
    expect(isService({ [SERVICE]: true })).toBe(false);
    expect(isService(null)).toBe(false);
    expect(isService(undefined)).toBe(false);
    expect(isService(new Plain(makeResolver(undefined).resolver))).toBe(false);
  });
});

describe("serviceId", () => {
  it("defaults to the class name", () => {
    expect(serviceId(Plain)).toBe("Plain");
  });

  it("takes a static id over the class name", () => {
    expect(serviceId(Named)).toBe("custom");
  });
});

describe("serviceLifetime", () => {
  it("defaults to singleton", () => {
    expect(serviceLifetime(Plain)).toBe("singleton");
    expect(Service.lifetime).toBe("singleton");
  });

  it("takes a static override", () => {
    expect(serviceLifetime(Named)).toBe("scoped");
  });

  it("falls back to singleton for a class with no lifetime member", () => {
    const bare = Object.assign(class Bare {}, { [SERVICE]: true });
    expect(serviceLifetime(bare as unknown as ServiceClass)).toBe("singleton");
  });
});

describe("use", () => {
  it("goes through the resolver that the constructor received", () => {
    const other = { tag: "other" };
    const { resolver, seen } = makeResolver(other);
    const consumer = new Consumer(resolver);
    expect(consumer.other()).toBe(other);
    expect(seen).toEqual([Other]);
  });

  it("asks the resolver on each call", () => {
    const { resolver, seen } = makeResolver({});
    const consumer = new Consumer(resolver);
    consumer.other();
    consumer.other();
    expect(seen).toEqual([Other, Other]);
  });
});

describe("setup / dispose", () => {
  it("default to no-ops", () => {
    const instance = new Plain(makeResolver(undefined).resolver);
    expect(instance.setup()).toBeUndefined();
    expect(instance.dispose()).toBeUndefined();
  });

  it("can be overridden with async work", async () => {
    const log: string[] = [];
    class Worker extends Service {
      override async setup() {
        log.push("setup");
      }
      override async dispose() {
        log.push("dispose");
      }
    }
    const instance = new Worker(makeResolver(undefined).resolver);
    await instance.setup();
    await instance.dispose();
    expect(log).toEqual(["setup", "dispose"]);
  });
});
