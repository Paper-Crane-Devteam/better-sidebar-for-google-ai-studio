declare module 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js' {
    export class IDBBatchAtomicVFS {
        constructor(dbName?: string, options?: any);
        name: string;
        close(): Promise<void>;
    }
}

declare module 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js' {
    export class OriginPrivateFileSystemVFS {
        constructor(options?: any);
        name: string;
        close(): Promise<void>;
    }
}
