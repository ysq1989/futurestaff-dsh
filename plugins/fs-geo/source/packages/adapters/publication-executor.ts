import { z } from "zod";
import { safeUrl } from "../core/content.js";

export interface PublicationTask {
  id: string;
  tenantId: string;
  projectId: string;
  accountId: string;
  version: number;
  title: string;
  body: string;
  scheduledAt: string;
}
export type Delivery =
  | { state: "SUBMITTED"; receipt: string }
  | { state: "PUBLISHED"; receipt: string; url: string; confirmedAt: string };
export interface DeliveryResult {
  state:
    "NOT_DUE" | "PREVIEW" | "FAILED" | "UNKNOWN" | "SUBMITTED" | "PUBLISHED";
  errorCode?: string;
  receipt?: string;
  url?: string;
  confirmedAt?: string;
}
export interface PublisherAdapter {
  verified: boolean;
  transport: (
    task: Readonly<PublicationTask>,
    signal: AbortSignal,
  ) => Promise<Delivery>;
}

// Transport boundary only. No production adapter or background identity is configured.
// A durable dispatcher must claim a task before calling this; this never retries I/O.
export class PublicationExecutor {
  constructor(
    private adapter: PublisherAdapter,
    private authorize: (task: Readonly<PublicationTask>) => Promise<boolean>,
    private timeoutMs = 130000,
  ) {}
  async preview(task: PublicationTask): Promise<DeliveryResult> {
    try {
      if (!(await this.authorize(Object.freeze({ ...task }))))
        return { state: "FAILED", errorCode: "EXECUTOR_ACCESS_DENIED" };
    } catch {
      return { state: "FAILED", errorCode: "EXECUTOR_ACCESS_DENIED" };
    }
    return { state: "PREVIEW" };
  }
  async execute(
    task: PublicationTask,
    now = Date.now(),
  ): Promise<DeliveryResult> {
    if (!this.adapter.verified)
      return { state: "FAILED", errorCode: "PUBLISHER_NOT_VERIFIED" };
    if (
      !Number.isFinite(Date.parse(task.scheduledAt)) ||
      !task.body.trim() ||
      !task.title.trim()
    )
      return { state: "FAILED", errorCode: "PUBLICATION_INPUT_INVALID" };
    if (Date.parse(task.scheduledAt) > now) return { state: "NOT_DUE" };
    const immutable = Object.freeze({ ...task });
    try {
      if (!(await this.authorize(immutable)))
        return { state: "FAILED", errorCode: "EXECUTOR_ACCESS_DENIED" };
    } catch {
      return { state: "FAILED", errorCode: "EXECUTOR_ACCESS_DENIED" };
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("delivery deadline"));
        }, this.timeoutMs);
      });
      const raw = await Promise.race([
        this.adapter.transport(immutable, controller.signal),
        deadline,
      ]);
      const result = z
        .discriminatedUnion("state", [
          z
            .object({
              state: z.literal("SUBMITTED"),
              receipt: z.string().trim().min(1).max(500),
            })
            .strict(),
          z
            .object({
              state: z.literal("PUBLISHED"),
              receipt: z.string().trim().min(1).max(500),
              url: safeUrl,
              confirmedAt: z.iso.datetime({ offset: true }),
            })
            .strict(),
        ])
        .parse(raw);
      if (result.state === "PUBLISHED" && Date.parse(result.confirmedAt) > Math.max(now, Date.now()))
        return {
          state: "UNKNOWN",
          errorCode: "PUBLICATION_CONFIRMATION_INVALID",
        };
      return result;
    } catch {
      return { state: "UNKNOWN", errorCode: "PUBLICATION_RESULT_UNKNOWN" };
    } finally {
      clearTimeout(timer);
    }
  }
}
