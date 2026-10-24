import type { Event, Events, Listener } from "./types";

/** The emitter of a service: `on` subscribes, `emit` calls the listeners. */
export interface Emitter {
  on<E extends Event>(event: E, listener: Listener<E>): () => void;
  emit<E extends Event>(event: E, ...args: Events[E]): void;
}

/**
 * Makes an emitter. The emitter calls the listeners of an event in
 * subscription order. It iterates over a copy, so a listener can unsubscribe
 * itself during the call. An error in a listener propagates to the emitter.
 */
export const makeEmitter = (): Emitter => {
  const listeners: { [E in Event]: Set<Listener<E>> } = {
    "invoke:start": new Set(),
    "invoke:end": new Set(),
    "invoke:error": new Set(),
    "service:create": new Set(),
  };

  return {
    on: (event, listener) => {
      listeners[event].add(listener);
      return () => {
        listeners[event].delete(listener);
      };
    },
    emit: (event, ...args) => {
      for (const listener of [...listeners[event]]) {
        listener(...args);
      }
    },
  };
};
