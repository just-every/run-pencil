import type { Plugin } from 'vite';
export function isPencilArchive(file: string): Promise<boolean>;
export function assertNoPencilArchive(path: string): Promise<void>;
export function pencilArchiveOutputGuard(): Plugin;
