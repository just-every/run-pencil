import type { Plugin } from 'vite';
import type { BackupManifest } from '../src/core/features/backup/model';
export function createBackupManifest(): BackupManifest;
export function backupManifest(): Plugin;
