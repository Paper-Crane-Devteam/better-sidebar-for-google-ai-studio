// 检查 OPFS 支持和内容
(async () => {
  console.log('=== Storage Diagnosis ===');
  
  // 1. 检查 OPFS 支持
  try {
    const root = await navigator.storage.getDirectory();
    console.log('OPFS supported: YES');
    
    // 列出所有文件
    console.log('OPFS files:');
    for await (const [name, handle] of root.entries()) {
      if (handle.kind === 'file') {
        const file = await handle.getFile();
        console.log(`  - ${name} (${file.size} bytes)`);
      } else {
        console.log(`  - ${name}/ (directory)`);
      }
    }
  } catch (e) {
    console.log('OPFS supported: NO or empty', e);
  }
  
  // 2. 列出所有 IndexedDB 数据库
  const dbs = await indexedDB.databases();
  console.log('IndexedDB databases:', dbs);
})();