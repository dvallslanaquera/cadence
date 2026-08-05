import { db } from "@/server/db";
import { toCsvLine, CSV_HEADER, entryToCsvRow } from "@/domain/csv";

/** Streamed so a multi-year export doesn't blow up serverless memory; only closed entries have an end time. See ARCHITECTURE.md §11. */
export function streamEntriesCsv(from: Date, to: Date, tz: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const pageSize = 500;

  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`${toCsvLine(CSV_HEADER)}\r\n`));

      let cursor: string | undefined;
      for (;;) {
        const rows = await db.timeEntry.findMany({
          where: {
            endedAt: { not: null, gt: from },
            startedAt: { lt: to },
          },
          include: {
            project: { select: { name: true } },
            task: { select: { name: true } },
            tags: { select: { tag: { select: { name: true } } } },
          },
          orderBy: { id: "asc" },
          take: pageSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        if (rows.length === 0) break;

        const chunk = rows
          .map((row) =>
            toCsvLine(
              entryToCsvRow(
                {
                  description: row.description,
                  projectName: row.project.name,
                  taskName: row.task?.name ?? null,
                  startedAt: row.startedAt,
                  endedAt: row.endedAt as Date,
                  tags: row.tags.map((link) => link.tag.name),
                },
                tz,
              ),
            ),
          )
          .join("\r\n");

        controller.enqueue(encoder.encode(`${chunk}\r\n`));

        if (rows.length < pageSize) break;
        cursor = rows[rows.length - 1].id;
      }

      controller.close();
    },
  });
}

export function csvFilename(from: Date, to: Date, tz: string): string {
  const fmt = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, dateStyle: "short" }).format(date);
  return `cadence-${fmt(from)}-to-${fmt(new Date(to.getTime() - 1))}.csv`;
}
