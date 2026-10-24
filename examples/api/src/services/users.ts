import type { User } from "../schemas";

import { Service } from "open-apiary";

import Clock from "./clock";

/** The user directory, in memory. A singleton: the data lives for the run. */
export default class Users extends Service {
  private readonly clock = this.use(Clock);
  private readonly users = new Map<string, User>();

  list(): User[] {
    return [...this.users.values()];
  }

  find(id: string): User | undefined {
    return this.users.get(id);
  }

  create(input: { name: string; email: string }): User {
    const user: User = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: this.clock.now().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  remove(id: string): boolean {
    return this.users.delete(id);
  }
}
