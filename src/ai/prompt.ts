import type { AiEntityPolicyOption } from "./entityPolicy";

export type AiLedgerContext = {
  accounts: Array<{ name: string; currency: string }>;
  categories: string[];
  today: string;
  entityPolicy: { account: AiEntityPolicyOption; category: AiEntityPolicyOption };
};

// When the policy allows new entities, the model may return the spoken name of
// a not-yet-existing account/category; otherwise it must pick from the list.
function entityRule(entity: "account" | "category", policy: AiEntityPolicyOption, list: string): string {
  if (policy === "existing") {
    return `- ${entity} 只能從這些${entity === "account" ? "帳戶" : "類別"}選:${list}。`;
  }
  return `- ${entity} 用使用者講的${entity === "account" ? "帳戶" : "類別"}名;若已是現有${entity === "account" ? "帳戶" : "類別"}請用現有名稱,不得編造。現有${entity === "account" ? "帳戶" : "類別"}:${list}。`;
}

export function buildLedgerSystemPrompt(context: AiLedgerContext): string {
  const accountList = context.accounts.map((account) => account.name).join("、") || "(尚未建立帳戶)";
  const categoryList = context.categories.join("、") || "(尚未建立類別)";
  const accountRule = entityRule("account", context.entityPolicy.account, accountList);
  const categoryRule = entityRule("category", context.entityPolicy.category, categoryList);
  return [
    "你是記帳助理。把使用者的記帳描述轉成結構化 JSON。",
    "只能回傳 JSON,不要任何其他文字或 markdown。",
    '- 回傳格式: {"items":[{"kind":"expense","date":"YYYY-MM-DD","account":"帳戶名","category":"類別名","counterparty":"店家/對象","itemName":"品項","amount":123,"currency":"TWD","note":"補充","explicit":["kind","date","counterparty","amount"]}]}',
    "規則:",
    "- kind 只能是 expense(支出)、income(收入)、transfer(轉帳),不確定就用 expense。",
    accountRule,
    categoryRule,
    `- date 用 YYYY-MM-DD,今天為 ${context.today};使用者說「昨天/前天」請換算。`,
    "- amount 是正整數或小數,不含逗號與貨幣符號。",
    "- currency 用三位代碼(TWD/USD/JPY…),若帳戶已定則填帳戶幣別。",
    "- transfer 需另給 transferAccount(帳戶名)與 transferAmount(轉出金額),transferAmount 也用數字。",
    "- 不確定的欄位填空字串,不要編造;counterparty/itemName 不知道就留空。",
    "- explicit 是使用者「明確說出」的欄位名稱陣列(可為空陣列),只能含 kind、date、account、category、counterparty、itemName、amount、currency、note;沒列到的欄位一律視為 AI 推論。",
    "- 若描述含多筆交易,全部列在 items。",
  ].join("\n");
}

const RECEIPT_PROMPT = [
  "請逐行辨識這張發票/收據的每個品項。",
  "重點:品項名稱與金額要分開,「75g」「300ml」這類字樣是包裝容量,不是金額。",
  "金額欄位只填真正的價錢,每行品項列為一筆 items。",
  "總金額以收據的「總計」為準,不要用付款金額。",
].join("\n");

export function buildUserPrompt(input: string, imageDataUrl?: string): string {
  const text = input.trim();
  if (text) return text;
  return imageDataUrl ? RECEIPT_PROMPT : "";
}
