/** Extract completion claims only from Codex's actual assistant message items. */
export function assistantMessagesFromCodexEvents(input) {
  const messages = [];
  const add = (value) => {
    if (typeof value === "string") {
      for (const line of value.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try { add(JSON.parse(line)); } catch { /* Unstructured stdout is not an assistant message. */ }
      }
      return;
    }
    if (Array.isArray(value)) { value.forEach(add); return; }
    if (!value || typeof value !== "object") return;
    const item = value.item && typeof value.item === "object" ? value.item : undefined;
    const type = typeof item?.type === "string" ? item.type : value.type;
    if ((type === "agent_message" || type === "assistant_message") && typeof (item?.text ?? value.text) === "string") {
      messages.push(item?.text ?? value.text);
    }
    if (value.raw && typeof value.raw === "object") add(value.raw);
  };
  add(input);
  return messages;
}

export function isCompletionClaim(text) {
  const message = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!message) return false;
  const negative = /\b(?:could not|couldn't|cannot|can't|can not|unable to|failed to|did not|didn't|have not|haven't|has not|hasn't|not yet|never)\s+(?:fully\s+)?(?:complete|completed|finish|finished|do|implement|fix|deliver|accomplish)\b|\b(?:is|are|was|were|seems?)\s+not\s+(?:yet\s+)?(?:done|complete|completed|finished)\b/i;
  if (negative.test(message)) return false;
  const affirmative = /\b(?:task|work|changes?|implementation|request|requirements?|criteria|everything|it)\s+(?:(?:is|are|was|were)\s+|(?:has|have)\s+been\s+)(?:successfully\s+)?(?:done|complete|completed|finished)\b/i.test(message)
    || /\b(?:task|work|changes?|implementation|request|requirements?|criteria|everything|it)\s+(?:(?:successfully\s+)?(?:done|complete|completed|finished)(?:\s+successfully)?)\b/i.test(message)
    || /\b(?:i|we)\s+(?:(?:have|has)\s+)?(?:successfully\s+)?(?:completed|finished|implemented|fixed|delivered)\b/i.test(message);
  if (affirmative) return true;
  const verifiedChange = /\b(?:implemented|updated|fixed|added|changed|created|refactored|corrected|removed)\b[\s\S]{0,700}\b(?:verif(?:ication|ier|y)|tests?|checks?)\b[\s\S]{0,180}\b(?:passed|pass|succeeded|success|successful)\b/i;
  if (verifiedChange.test(message)) return true;
  // Unicode escapes keep these multilingual checks stable across Windows shell code pages.
  const turkishVerifiedChange = /\b(?:d\u00FCzelttim|g\u00FCncelledim|ekledim|uygulad\u0131m|olu\u015Fturdum|tamamlad\u0131m)\b[\s\S]{0,700}\b(?:do\u011Frulama|verif(?:ication|ier|y)|test)\b[\s\S]{0,180}\b(?:pass|passed|ba\u015Far\u0131yla|ba\u015Far\u0131l\u0131|ge\u00E7ti)\b/i;
  const turkishCompletedChange = /\b(?:node\s+)?verify(?:\.mjs)?\b[\s\S]{0,140}\bPASS\b/i.test(message)
    && /(?:tamamland[\u0131i]|ba\u015Far\u0131yla|\u00E7al\u0131\u015Ft\u0131|art\u0131k\s+.{0,100}(?:d\u00F6nd\u00FCr|g\u00FCncelle|ekl|d\u00FCzelt))/i.test(message);
  return turkishVerifiedChange.test(message) || turkishCompletedChange || /^(?:done|completed|finished)(?:\s+successfully)?[.!]?$/i.test(message);
}

export function hasCompletionClaim(events) {
  return assistantMessagesFromCodexEvents(events).some(isCompletionClaim);
}
