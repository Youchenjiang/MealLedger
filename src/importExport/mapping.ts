export const normalizedImportFields = [
  "date",
  "kind",
  "account",
  "amount",
  "currency",
  "merchant",
  "item_name",
  "category",
  "source",
  "target_account",
  "target_amount",
  "target_currency",
  "fee_account",
  "fee_amount",
  "fee_currency",
  "fee_category",
  "refund_reason",
  "refund_subtype",
  "refund_linked_record_id",
  "reason",
  "time_precision",
  "period_start",
  "period_end",
  "tags",
  "event",
  "source_label",
  "notes",
] as const;

export type NormalizedImportField = (typeof normalizedImportFields)[number];

const aliases: Record<NormalizedImportField, string[]> = {
  date: ["date", "日期"],
  kind: ["kind", "type", "類型", "交易類型"],
  account: ["account", "帳戶", "原帳戶"],
  amount: ["amount", "金額"],
  currency: ["currency", "幣別", "貨幣"],
  merchant: ["merchant", "店家"],
  item_name: ["item_name", "item", "名稱"],
  category: ["category", "分類", "種類"],
  source: ["source", "來源"],
  target_account: ["target_account", "後帳戶"],
  target_amount: ["target_amount", "目的金額"],
  target_currency: ["target_currency", "目的幣別"],
  fee_account: ["fee_account", "手續費帳戶"],
  fee_amount: ["fee_amount", "手續費金額"],
  fee_currency: ["fee_currency", "手續費幣別"],
  fee_category: ["fee_category", "手續費分類"],
  refund_reason: ["refund_reason", "退款原因"],
  refund_subtype: ["refund_subtype", "退款類型"],
  refund_linked_record_id: ["refund_linked_record_id", "關聯支出"],
  reason: ["reason", "原因"],
  time_precision: ["time_precision", "時間精度"],
  period_start: ["period_start", "統計開始"],
  period_end: ["period_end", "統計結束"],
  tags: ["tags", "標籤"],
  event: ["event", "事件"],
  source_label: ["source_label", "來源標籤"],
  notes: ["notes", "note", "備註"],
};

export type HeaderMappingResult = {
  mapping: Record<NormalizedImportField, string>;
  unmappedHeaders: string[];
  conflicts: string[];
};

function normalizedHeader(header: string): string {
  return header.trim().toLocaleLowerCase().replace(/\s+/g, "_");
}

function fieldForHeader(header: string): NormalizedImportField | undefined {
  const normalized = normalizedHeader(header);
  return normalizedImportFields.find((field) => aliases[field].some((alias) => normalizedHeader(alias) === normalized));
}

export function mapImportHeaders(headers: string[]): HeaderMappingResult {
  const mapping = {} as Record<NormalizedImportField, string>;
  const unmappedHeaders: string[] = [];
  const conflicts: string[] = [];

  for (const header of headers) {
    const field = fieldForHeader(header);
    if (!field) {
      unmappedHeaders.push(header);
      continue;
    }

    if (mapping[field]) {
      conflicts.push(`Multiple columns map to ${field}: ${mapping[field]} and ${header}.`);
      continue;
    }

    mapping[field] = header;
  }

  return { mapping, unmappedHeaders, conflicts };
}

export function mapImportRow(headers: string[], row: string[], mapping = mapImportHeaders(headers)): Partial<Record<NormalizedImportField, string>> {
  const normalized: Partial<Record<NormalizedImportField, string>> = {};

  for (const [index, header] of headers.entries()) {
    const field = Object.entries(mapping.mapping).find(([, sourceHeader]) => sourceHeader === header)?.[0] as NormalizedImportField | undefined;
    if (field) {
      normalized[field] = row[index]?.trim() ?? "";
    }
  }

  return normalized;
}
