export type SupabaseConfigValues = {
  url?: string;
  anonKey?: string;
};

export type SupabaseConfigOptions = {
  allowHttp?: boolean;
};

function isPlaceholder(value: string): boolean {
  return /^(replace-with|your-project|your-|change-me|example)/i.test(value.trim());
}

export function isUsableSupabaseConfig(
  values: SupabaseConfigValues,
  options: SupabaseConfigOptions = {},
): boolean {
  const url = values.url?.trim() ?? "";
  const anonKey = values.anonKey?.trim() ?? "";
  if (!url || !anonKey || isPlaceholder(url) || isPlaceholder(anonKey)) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || (options.allowHttp === true && parsed.protocol === "http:");
  } catch {
    return false;
  }
}
