// llamaToolCallParser.ts
// Utility to parse Llama tool call format: [tool1(arg1=val1, arg2=val2), tool2(arg=val)]
// Returns: Array<{ name: string, args: Record<string, any> }>

export function parseLlamaToolCalls(input: string): Array<{ name: string, args: Record<string, any> }> {
  // Find the last [ ... ] block in the string
  const match = input.match(/\[.*\]$/s);
  if (!match) return [];
  const callsStr = match[0].slice(1, -1).trim();
  if (!callsStr) return [];

  // Split on '),', but keep parentheses balanced
  const calls: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < callsStr.length; i++) {
    if (callsStr[i] === '(') depth++;
    if (callsStr[i] === ')') depth--;
    if (callsStr[i] === ',' && depth === 0) {
      calls.push(callsStr.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (start < callsStr.length) calls.push(callsStr.slice(start).trim());

  // Parse each call: toolName(arg1=val1, arg2=val2)
  return calls
    .map(call => {
      const fnMatch = call.match(/^(\w+)\((.*)\)$/s);
      if (!fnMatch) return undefined;
      const name = fnMatch[1];
      const argsStr = fnMatch[2];
      const args: Record<string, any> = {};
      // Split args on ',' not inside quotes or parentheses
      let arg = '', inStr = false, strChar = '', paren = 0;
      for (let i = 0; i <= argsStr.length; i++) {
        const c = argsStr[i] || ',';
        if ((c === '"' || c === "'") && !inStr) { inStr = true; strChar = c; arg += c; continue; }
        if (inStr && c === strChar) { inStr = false; arg += c; continue; }
        if (inStr) { arg += c; continue; }
        if (c === '(') { paren++; arg += c; continue; }
        if (c === ')') { paren--; arg += c; continue; }
        if (c === ',' && paren === 0) {
          const eq = arg.indexOf('=');
          if (eq > 0) {
            const k = arg.slice(0, eq).trim();
            let v = arg.slice(eq + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
            else if (!isNaN(Number(v))) v = String(Number(v));
            args[k] = v;
          }
          arg = '';
          continue;
        }
        arg += c;
      }
      return { name, args };
    })
    .filter((x): x is { name: string; args: Record<string, any> } => Boolean(x));
}
