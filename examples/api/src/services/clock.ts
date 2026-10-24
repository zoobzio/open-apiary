import { Service } from "open-apiary";

/** The clock of the API. A test can replace it with a fixed one. */
export default class Clock extends Service {
  now(): Date {
    return new Date();
  }
}
