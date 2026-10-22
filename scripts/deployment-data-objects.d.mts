import { z } from 'zod';
export type ArchiveObject = { bucket: 'FORM_ASSETS'; key: string; mime: 'image/png' | 'image/jpeg' | 'image/webp'; customMetadata: {workspaceId: string; flowId: string; mime: 'image/png' | 'image/jpeg' | 'image/webp'}; data: string };
export const objectBytesLimit: number;
export const archiveObject: z.ZodType<ArchiveObject>;
export function objectBytes(object: ArchiveObject): Uint8Array;
export function checkObject(object: ArchiveObject): Promise<Uint8Array>;
export function objectReferences(table: {name?:string;columns:string[]}, rows: Iterable<Array<{type:string;value?:unknown}>>): Generator<{key:string;mime:string}>;
export function requireObjectReferences(tables: Array<{columns:string[];rows:Array<Array<{type:string;value?:unknown}>>}>, objects: Map<string, ArchiveObject>): void;
export function bucketObjects(bucket: R2Bucket): AsyncGenerator<ArchiveObject>;
