import path from "node:path";

export interface ClaudeLaunchPlan {
  executable: string;
  args: string[];
}

/** Load W2's Claude Code hooks plugin for this session without changing Claude settings. */
export function buildClaudeLaunchPlan(w2Home: string, executable: string, forwardedArgs: string[] = []): ClaudeLaunchPlan {
  return { executable, args: ["--plugin-dir", path.resolve(w2Home), ...forwardedArgs] };
}
