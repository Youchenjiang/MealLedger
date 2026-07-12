export const csvImportLimits = {
  maxBytes: 10 * 1024 * 1024,
  maxRows: 5_000,
} as const;

const supportedHeaders = new Set([
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
  "refund_linked_record_ids",
  "reason",
  "time_precision",
  "period_start",
  "period_end",
  "tags",
  "event",
  "source_label",
  "notes",
  "日期",
  "帳戶",
  "金額",
  "來源",
  "店家",
  "名稱",
  "種類",
  "原帳戶",
  "後帳戶",
]);

export type CsvValidationResult = {
  ok: boolean;
  headers: string[];
  rows: string[][];
  rowCount: number;
  errors: string[];
};

function blankResult(errors: string[]): CsvValidationResult {
  return { ok: false, headers: [], rows: [], rowCount: 0, errors };
}

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

function parseCsv(text: string): { rows: string[][]; errors: string[] } {
  const rows: string[][] = [];
  const errors: string[] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    pushField();
    if (!isBlankRow(row)) {
      rows.push(row);
    }
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
        if (character === "\n") {
          line += 1;
        }
      }
      continue;
    }

    if (character === '"') {
      if (field.length === 0) {
        quoted = true;
      } else {
        errors.push(`Line ${line}: unexpected quote.`);
      }
    } else if (character === ",") {
      pushField();
    } else if (character === "\r" || character === "\n") {
      pushRow();
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      line += 1;
    } else {
      field += character;
    }
  }

  if (quoted) {
    errors.push(`Line ${line}: unclosed quoted field.`);
  } else if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return { rows, errors };
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function validateCsvBytes(bytes: Uint8Array): CsvValidationResult {
  if (bytes.byteLength > csvImportLimits.maxBytes) {
    return blankResult(`CSV file exceeds ${csvImportLimits.maxBytes / (1024 * 1024)} MB.`.split("\n"));
  }

  const decoded = decodeUtf8(bytes);
  if (decoded === null) {
    return blankResult(["CSV file must be valid UTF-8."]);
  }

  const { rows, errors } = parseCsv(decoded.replace(/^\ufeff/, ""));
  if (rows.length === 0) {
    return blankResult(["CSV file must contain one header row.", ...errors]);
  }

  const headers = rows[0].map((header) => header.trim());
  const normalizedHeaders = headers.map((header) => header.toLocaleLowerCase());
  const duplicateHeaders = normalizedHeaders.filter((header, index) => normalizedHeaders.indexOf(header) !== index);
  const headerErrors = [
    ...errors,
    ...(headers.some((header) => header === "") ? ["CSV headers cannot be empty."] : []),
    ...(duplicateHeaders.length > 0 ? ["CSV headers cannot contain duplicates."] : []),
    ...(headers.some((header) => supportedHeaders.has(header) || supportedHeaders.has(header.toLocaleLowerCase()))
      ? []
      : ["CSV headers do not contain a supported ledger field."]),
  ];

  const dataRows = rows.slice(1);
  if (dataRows.length > csvImportLimits.maxRows) {
    headerErrors.push(`CSV file exceeds ${csvImportLimits.maxRows} data rows.`);
  }

  for (const [index, dataRow] of dataRows.entries()) {
    if (dataRow.length !== headers.length) {
      headerErrors.push(`Row ${index + 2} has ${dataRow.length} fields; expected ${headers.length}.`);
    }
  }

  return {
    ok: headerErrors.length === 0,
    headers,
    rows: dataRows,
    rowCount: dataRows.length,
    errors: headerErrors,
  };
}

export function validateCsvText(text: string): CsvValidationResult {
  return validateCsvBytes(new TextEncoder().encode(text));
}
