export function assertNoUserHomeLeak(text: string, userHome?: string): void;
export function assertNoAncestorContext(workspace: string): void;
export function configureTrustedProjects(isolation: any, projectPaths: string[]): { count: number; config_sha256: string };
export function configureIsolatedGitWorkspace(runIsolation: any, workspace: string): string;
export function assertModelPromptIsolation(text: string, userHome?: string, repositoryRoot?: string): { status: string; source: string; global_profile_references: number; host_repository_references: number };
export function inspectCodexPromptInput(isolation: unknown, workspace: string, prompt: string): { status: string; source: string; global_profile_references: number; host_repository_references: number };
export function classifyProfileReference(text: string, userHome?: string): string;
export function sanitizeRunValue(value: unknown, replacements: Array<[string, string]>): unknown;
