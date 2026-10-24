import type { ServiceClass } from "@open-apiary/schema";
import type { Events } from "../src/types";

import { describe, it, expect, beforeEach } from "vitest";
import { Service } from "@open-apiary/schema";

import { makeContainer } from "../src/container";
import {
  CaptiveServiceError,
  CircularServiceError,
  DuplicateServiceError,
  UnknownServiceError,
} from "../src/error";
import { makeEmitter } from "../src/events";
import { Audit, Db, Session, Users, log } from "./fixture";

/** Makes a container and an emitter that records `service:create`. */
const boot = (services: readonly ServiceClass[]) => {
  const emitter = makeEmitter();
  const created: Events["service:create"][0][] = [];
  emitter.on("service:create", (event) => {
    created.push(event);
  });
  return { container: makeContainer(services, emitter), created };
};

beforeEach(() => {
  log.splice(0);
});

describe("makeContainer", () => {
  it("runs no code of the services before start", () => {
    const { created } = boot([Db, Users]);
    expect(created).toEqual([]);
    expect(log).toEqual([]);
  });

  it("rejects two classes that share an id", () => {
    class A extends Service {
      static override readonly id = "same";
    }
    class B extends Service {
      static override readonly id = "same";
    }
    expect(() => boot([A, B])).toThrow(DuplicateServiceError);
    expect(() => boot([A, B])).toThrow('two services share the id "same"');
  });

  it("rejects two classes with the same name", () => {
    const make = () => class Dup extends Service {};
    expect(() => boot([make(), make()])).toThrow(DuplicateServiceError);
  });

  it("tolerates the same class listed twice", () => {
    expect(() => boot([Db, Db])).not.toThrow();
  });
});

describe("start", () => {
  it("creates each singleton once and runs setup in dependency order", async () => {
    const { container, created } = boot([Users, Db]);
    await container.start();
    expect(created).toEqual([
      { id: "Db", lifetime: "singleton" },
      { id: "Users", lifetime: "singleton" },
    ]);
    expect(log).toEqual(["setup:Db", "setup:Users"]);
  });

  it("hands the same singleton to every scope", async () => {
    const { container, created } = boot([Db, Users]);
    await container.start();
    const a = container.scope();
    const b = container.scope();
    expect(a.use(Db)).toBe(b.use(Db));
    expect(a.use(Users)).toBe(b.use(Users));
    expect(created).toHaveLength(2);
  });

  it("does not create a scoped service at start", async () => {
    const { container, created } = boot([Db, Session]);
    await container.start();
    expect(created.map((event) => event.id)).toEqual(["Db"]);
  });

  it("waits for an async setup", async () => {
    class Slow extends Service {
      override async setup() {
        await new Promise((resolve) => setTimeout(resolve, 5));
        log.push("setup:Slow");
      }
    }
    const { container } = boot([Slow]);
    await container.start();
    expect(log).toEqual(["setup:Slow"]);
  });

  it("throws when a singleton uses a scoped service", async () => {
    class Captor extends Service {
      readonly session = this.use(Session);
    }
    const { container } = boot([Db, Session, Captor]);
    await expect(container.start()).rejects.toThrow(CaptiveServiceError);
    await expect(container.start()).rejects.toMatchObject({
      id: "Session",
      from: "Captor",
    });
  });

  it("throws when a singleton uses a scoped service through another singleton", async () => {
    class Inner extends Service {
      readonly session = this.use(Session);
    }
    class Outer extends Service {
      readonly inner = this.use(Inner);
    }
    const { container } = boot([Db, Session, Outer, Inner]);
    await expect(container.start()).rejects.toMatchObject({
      id: "Session",
      from: "Inner",
    });
  });

  it("throws with the chain when the services loop", async () => {
    class A extends Service {
      readonly b = this.use(B);
    }
    class B extends Service {
      readonly a = this.use(A);
    }
    const { container } = boot([A, B]);
    await expect(container.start()).rejects.toThrow(CircularServiceError);
    await expect(container.start()).rejects.toMatchObject({
      chain: ["A", "B", "A"],
    });
  });

  it("throws when a service uses one that the container does not know", async () => {
    class Stranger extends Service {}
    class Host extends Service {
      readonly stranger = this.use(Stranger);
    }
    const { container } = boot([Host]);
    await expect(container.start()).rejects.toThrow(UnknownServiceError);
    await expect(container.start()).rejects.toMatchObject({ id: "Stranger" });
  });
});

describe("stop", () => {
  it("disposes the singletons in reverse order of creation", async () => {
    const { container } = boot([Users, Db]);
    await container.start();
    log.splice(0);
    await container.stop();
    expect(log).toEqual(["dispose:Users", "dispose:Db"]);
  });

  it("forgets the singletons, so a second start makes new ones", async () => {
    const { container, created } = boot([Db]);
    await container.start();
    const first = container.scope().use(Db);
    await container.stop();
    await container.start();
    expect(container.scope().use(Db)).not.toBe(first);
    expect(created).toHaveLength(2);
  });

  it("does nothing before start", async () => {
    const { container } = boot([Db]);
    await container.stop();
    expect(log).toEqual([]);
  });
});

describe("scope", () => {
  it("resolves a scoped service once per scope", async () => {
    const { container, created } = boot([Db, Session]);
    await container.start();
    const scope = container.scope();
    const session = scope.use(Session);
    expect(scope.use(Session)).toBe(session);
    expect(created.filter((event) => event.id === "Session")).toEqual([
      { id: "Session", lifetime: "scoped" },
    ]);
  });

  it("gives each scope its own instance", async () => {
    const { container } = boot([Db, Session]);
    await container.start();
    expect(container.scope().use(Session)).not.toBe(
      container.scope().use(Session),
    );
  });

  it("lets a scoped service use a singleton", async () => {
    const { container } = boot([Db, Session]);
    await container.start();
    const scope = container.scope();
    expect(scope.use(Session).db).toBe(scope.use(Db));
  });

  it("lets a scoped service use another scoped service of the same scope", async () => {
    const { container } = boot([Db, Session, Audit]);
    await container.start();
    const scope = container.scope();
    expect(scope.use(Audit).session).toBe(scope.use(Session));
  });

  it("disposes its instances in reverse order and forgets them", async () => {
    const { container } = boot([Db, Session, Audit]);
    await container.start();
    const scope = container.scope();
    const audit = scope.use(Audit);
    log.splice(0);
    await scope.dispose();
    expect(log).toEqual(["dispose:Audit", "dispose:Session"]);
    expect(scope.use(Audit)).not.toBe(audit);
  });

  it("does not dispose the singletons", async () => {
    const { container } = boot([Db, Session]);
    await container.start();
    const scope = container.scope();
    scope.use(Session);
    log.splice(0);
    await scope.dispose();
    expect(log).toEqual(["dispose:Session"]);
  });

  it("does nothing on dispose when nothing was resolved", async () => {
    const { container } = boot([Db, Session]);
    await container.start();
    log.splice(0);
    await container.scope().dispose();
    expect(log).toEqual([]);
  });

  it("throws for a class the container does not know", async () => {
    class Stranger extends Service {}
    const { container } = boot([Db]);
    await container.start();
    expect(() => container.scope().use(Stranger)).toThrow(UnknownServiceError);
    expect(() => container.scope().use(Stranger)).toThrow(
      'no service registered under "Stranger"',
    );
  });

  it("throws with the chain when scoped services loop", async () => {
    class A extends Service {
      static override readonly lifetime = "scoped";
      readonly b = this.use(B);
    }
    class B extends Service {
      static override readonly lifetime = "scoped";
      readonly a = this.use(A);
    }
    const { container } = boot([A, B]);
    await container.start();
    expect(() => container.scope().use(A)).toThrow(CircularServiceError);
    expect(() => container.scope().use(B)).toThrow("B → A → B");
  });
});
