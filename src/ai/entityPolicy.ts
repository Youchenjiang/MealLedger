// Per-entity-type policy for AI-assisted capture (口說記帳): whether the AI
// may mention accounts/categories that do not exist yet, and how a confirmed
// write should handle them. See ADR 0012.
export type AiEntityPolicyOption = "existing" | "ask" | "auto";

export type AiEntityPolicy = {
  account: AiEntityPolicyOption;
  category: AiEntityPolicyOption;
};

export const DEFAULT_AI_ENTITY_POLICY: AiEntityPolicy = {
  // Preserve the current strict behavior until the user opts in.
  account: "existing",
  category: "existing",
};

const ENTITY_POLICY_KEY = "mealledger.ai.entity-policy";

const OPTIONS: readonly AiEntityPolicyOption[] = ["existing", "ask", "auto"];

export function isAiEntityPolicyOption(value: unknown): value is AiEntityPolicyOption {
  return typeof value === "string" && (OPTIONS as readonly string[]).includes(value);
}

export function readAiEntityPolicy(): AiEntityPolicy {
  try {
    const stored = window.localStorage.getItem(ENTITY_POLICY_KEY);
    if (!stored) {
      return DEFAULT_AI_ENTITY_POLICY;
    }
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    return {
      account: isAiEntityPolicyOption(parsed.account) ? parsed.account : DEFAULT_AI_ENTITY_POLICY.account,
      category: isAiEntityPolicyOption(parsed.category) ? parsed.category : DEFAULT_AI_ENTITY_POLICY.category,
    };
  } catch {
    return DEFAULT_AI_ENTITY_POLICY;
  }
}

export function writeAiEntityPolicy(policy: AiEntityPolicy): void {
  try {
    window.localStorage.setItem(ENTITY_POLICY_KEY, JSON.stringify(policy));
  } catch {
    // Preference persistence is best effort.
  }
}
