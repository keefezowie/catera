import type { CustomerState, Delivery } from "@catera/domain";
import { monthEnd, monthOf } from "./meal-calendar";

export type CalendarMonth = {
  status: "loading" | "ready" | "error";
  deliveries: Delivery[];
};
/** One store per customer/revision. Obsolete stores cannot publish into a new one. */
export class CalendarStore {
  months = new Map<string, CalendarMonth>();
  meta: CustomerState["calendarMeta"];
  private version = 0;
  private listeners = new Set<() => void>();
  private requests = new Map<string, Promise<void>>();
  constructor(private load: (query: string) => Promise<CustomerState>) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.version;
  private publish() {
    this.version++;
    this.listeners.forEach((listener) => listener());
  }
  ensure(month: string, retry = false): Promise<void> {
    month = monthOf(month);
    const pending = this.requests.get(month);
    if (pending) return pending;
    if (this.months.has(month) && !retry) return Promise.resolve();
    this.months.set(month, { status: "loading", deliveries: [] });
    const request = Promise.resolve()
      .then(() =>
        this.load(`?from=${month}&to=${monthEnd(month)}&calendarMeta=true`),
      )
      .then((data) => {
        this.months.set(month, {
          status: "ready",
          deliveries: data.deliveries,
        });
        this.meta = data.calendarMeta;
      })
      .catch(() => {
        this.months.set(month, { status: "error", deliveries: [] });
      })
      .finally(() => {
        this.requests.delete(month);
        this.publish();
      });
    this.requests.set(month, request);
    this.publish();
    return request;
  }
  prune(keep: Set<string>) {
    if (this.months.size <= Math.max(18, keep.size)) return;
    for (const month of this.months.keys()) {
      if (!keep.has(month) && !this.requests.has(month))
        this.months.delete(month);
    }
  }
}
