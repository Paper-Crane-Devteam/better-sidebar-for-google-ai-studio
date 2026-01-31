import { initDB } from '@/shared/db';

export const dbReady = initDB()
  .then(() => {
    console.log('Database initialized successfully');
  })
  .catch((err) => {
    console.error('Database initialization failed:', err);
    throw err;
  });
