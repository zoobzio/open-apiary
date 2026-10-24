import { Service } from "@open-apiary/schema";

/** The clock of the API. */
export default class Clock extends Service {
  now(): Date {
    return new Date();
  }
}
