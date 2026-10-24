import type { Caller } from "open-apiary";

import { Service } from "open-apiary";

/**
 * The audit trail of one call. A scoped service: each call gets its own
 * instance, and the instance is disposed when the call ends.
 */
export default class Audit extends Service {
  static override readonly lifetime = "scoped";

  private readonly notes: string[] = [];

  note(caller: Caller, action: string): void {
    this.notes.push(`${String(caller.subject ?? "anonymous")}: ${action}`);
  }

  trail(): readonly string[] {
    return this.notes;
  }
}
