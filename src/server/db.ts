import { sequelize, initModels } from './models/index.js';

export async function initDatabase() {
  try {
    // Initialize all models and associations
    initModels();

    // Test connection
    await sequelize.authenticate();
    console.log('[Database] Connection established successfully');

    // Sync database (create tables if they don't exist)
    // In production, you'd use migrations instead
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      console.log('[Database] Models synchronized');
    }

    return true;
  } catch (error) {
    console.error('[Database] Unable to connect:', error);
    throw error;
  }
}

export async function closeDatabase() {
  await sequelize.close();
  console.log('[Database] Connection closed');
}
