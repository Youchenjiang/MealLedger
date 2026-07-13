import type { LocalAccount } from "../manualLedger/accounts";
import { mapLocalAccount } from "./mappers";
import type { CloudMutationError, CloudReferenceMap, CloudRow } from "./contracts";

type ReferenceTable = {
  upsert(values: CloudRow | CloudRow[], options?: { onConflict?: string }): {
    select(columns: string): PromiseLike<{ data?: unknown; error: CloudMutationError | null }>;
  };
};

export type ReferenceBootstrapClient = {
  from(table: string): ReferenceTable;
};

export type ReferenceBootstrapInput = {
  userId: string;
  accounts: LocalAccount[];
  categories?: string[];
  tags?: string[];
  events?: string[];
};

export type ReferenceBootstrapFailure = {
  ok: false;
  table: string;
  message: string;
};

export type ReferenceBootstrapResult =
  | { ok: true; references: CloudReferenceMap }
  | ReferenceBootstrapFailure;

function uniqueNames(names: string[] | undefined): string[] {
  return [...new Set((names ?? []).map((name) => name.trim()).filter(Boolean))];
}

function rowsForNames(userId: string, names: string[]): CloudRow[] {
  return names.map((name) => ({
    user_id: userId,
    name,
    kind_scope: "both",
  }));
}

async function upsertAndMap(
  client: ReferenceBootstrapClient,
  table: string,
  rows: CloudRow[],
): Promise<{ ok: true; ids: Record<string, string> } | ReferenceBootstrapFailure> {
  if (rows.length === 0) return { ok: true, ids: {} };

  const result = await client.from(table).upsert(rows, { onConflict: "user_id,name" }).select("id,name");
  if (result.error) {
    return { ok: false, table, message: result.error.message };
  }

  const returnedRows = Array.isArray(result.data) ? result.data as CloudRow[] : [];
  const ids: Record<string, string> = {};
  for (const row of returnedRows) {
    if (typeof row.name === "string" && typeof row.id === "string") {
      ids[row.name] = row.id;
    }
  }

  const missing = rows
    .map((row) => row.name)
    .filter((name): name is string => typeof name === "string" && !ids[name]);
  if (missing.length > 0) {
    return { ok: false, table, message: `Cloud reference response omitted: ${missing.join(", ")}.` };
  }

  return { ok: true, ids };
}

export async function bootstrapReferences(
  client: ReferenceBootstrapClient,
  input: ReferenceBootstrapInput,
): Promise<ReferenceBootstrapResult> {
  const accountRows = input.accounts.map((account) => mapLocalAccount(account, input.userId));
  const accounts = await upsertAndMap(client, "accounts", accountRows);
  if (!accounts.ok) return accounts;

  const categories = await upsertAndMap(client, "categories", rowsForNames(input.userId, uniqueNames(input.categories)));
  if (!categories.ok) return categories;

  const tags = await upsertAndMap(client, "tags", rowsForNames(input.userId, uniqueNames(input.tags)));
  if (!tags.ok) return tags;

  const events = await upsertAndMap(client, "events", rowsForNames(input.userId, uniqueNames(input.events)));
  if (!events.ok) return events;

  return {
    ok: true,
    references: {
      accountIds: Object.fromEntries(input.accounts.map((account) => [account.id, accounts.ids[account.name]])),
      categoryIds: categories.ids,
      tagIds: tags.ids,
      eventIds: events.ids,
    },
  };
}
