import 'dotenv/config';
import { faker } from '@faker-js/faker';
import { sequelize, initModels, User, Category, Product, Order, OrderItem } from './models/index.js';
import { SEED_CONFIGS, SeedSize } from '../shared/types.js';

// Get seed size from environment
const seedSize = (process.env.SEED_SIZE as SeedSize) || 'small';
const config = SEED_CONFIGS[seedSize];

console.log(`[Seed] Starting database seeding with size: ${seedSize}`);
console.log(`[Seed] Config:`, config);

async function seed() {
  try {
    // Initialize models
    initModels();

    // Sync database (drop and recreate tables)
    console.log('[Seed] Syncing database...');
    await sequelize.sync({ force: true });
    console.log('[Seed] Database synced');

    // Seed Categories
    console.log(`[Seed] Creating ${config.categories} categories...`);
    const categories = await seedCategories(config.categories);
    console.log(`[Seed] Created ${categories.length} categories`);

    // Seed Products
    console.log(`[Seed] Creating ${config.products} products...`);
    const products = await seedProducts(config.products, categories);
    console.log(`[Seed] Created ${products.length} products`);

    // Seed Users
    console.log(`[Seed] Creating ${config.users} users...`);
    const users = await seedUsers(config.users);
    console.log(`[Seed] Created ${users.length} users`);

    // Seed Orders
    console.log(`[Seed] Creating ${config.orders} orders...`);
    await seedOrders(config.orders, users, products, config.itemsPerOrder);
    console.log(`[Seed] Created orders with items`);

    console.log('[Seed] Seeding completed successfully!');
    
    // Print summary
    const summary = {
      users: await User.count(),
      categories: await Category.count(),
      products: await Product.count(),
      orders: await Order.count(),
      orderItems: await OrderItem.count(),
    };
    console.log('[Seed] Summary:', summary);

  } catch (error) {
    console.error('[Seed] Error:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function seedCategories(count: number): Promise<Category[]> {
  const categoryNames = new Set<string>();
  
  // Generate unique category names
  while (categoryNames.size < count) {
    categoryNames.add(faker.commerce.department());
  }

  const categories = Array.from(categoryNames).map(name => ({
    name,
    description: faker.commerce.productDescription(),
  }));

  return Category.bulkCreate(categories);
}

async function seedProducts(count: number, categories: Category[]): Promise<Product[]> {
  const batchSize = 1000;
  const products: Product[] = [];
  
  for (let i = 0; i < count; i += batchSize) {
    const batch = [];
    const currentBatchSize = Math.min(batchSize, count - i);
    
    for (let j = 0; j < currentBatchSize; j++) {
      batch.push({
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        price: parseFloat(faker.commerce.price({ min: 1, max: 1000 })),
        stock: faker.number.int({ min: 0, max: 500 }),
        categoryId: faker.helpers.arrayElement(categories).id,
      });
    }
    
    const created = await Product.bulkCreate(batch);
    products.push(...created);
    
    if ((i + batchSize) % 5000 === 0 || i + batchSize >= count) {
      console.log(`[Seed] Products: ${Math.min(i + batchSize, count)}/${count}`);
    }
  }
  
  return products;
}

async function seedUsers(count: number): Promise<User[]> {
  const batchSize = 1000;
  const users: User[] = [];
  const usedEmails = new Set<string>();
  
  for (let i = 0; i < count; i += batchSize) {
    const batch = [];
    const currentBatchSize = Math.min(batchSize, count - i);
    
    for (let j = 0; j < currentBatchSize; j++) {
      let email: string;
      // Ensure unique emails
      do {
        email = faker.internet.email().toLowerCase();
      } while (usedEmails.has(email));
      usedEmails.add(email);
      
      batch.push({
        email,
        name: faker.person.fullName(),
      });
    }
    
    const created = await User.bulkCreate(batch);
    users.push(...created);
    
    if ((i + batchSize) % 10000 === 0 || i + batchSize >= count) {
      console.log(`[Seed] Users: ${Math.min(i + batchSize, count)}/${count}`);
    }
  }
  
  return users;
}

async function seedOrders(
  count: number,
  users: User[],
  products: Product[],
  itemsPerOrder: { min: number; max: number }
): Promise<void> {
  const batchSize = 500;
  const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
  
  // Create date range for orders (last 2 years)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);
  
  for (let i = 0; i < count; i += batchSize) {
    const orderBatch = [];
    const currentBatchSize = Math.min(batchSize, count - i);
    
    for (let j = 0; j < currentBatchSize; j++) {
      const orderDate = faker.date.between({ from: startDate, to: endDate });
      
      orderBatch.push({
        userId: faker.helpers.arrayElement(users).id,
        status: faker.helpers.arrayElement(statuses),
        totalAmount: 0, // Will be calculated from items
        createdAt: orderDate,
        updatedAt: orderDate,
      });
    }
    
    const orders = await Order.bulkCreate(orderBatch);
    
    // Create order items for each order
    const itemBatch = [];
    for (const order of orders) {
      const numItems = faker.number.int(itemsPerOrder);
      const selectedProducts = faker.helpers.arrayElements(products, numItems);
      let orderTotal = 0;
      
      for (const product of selectedProducts) {
        const quantity = faker.number.int({ min: 1, max: 5 });
        const price = parseFloat(product.price.toString());
        orderTotal += price * quantity;
        
        itemBatch.push({
          orderId: order.id,
          productId: product.id,
          quantity,
          price,
        });
      }
      
      // Update order total
      order.totalAmount = orderTotal;
    }
    
    // Bulk create order items
    if (itemBatch.length > 0) {
      await OrderItem.bulkCreate(itemBatch);
    }
    
    // Update order totals
    await Promise.all(orders.map(order => 
      Order.update(
        { totalAmount: order.totalAmount },
        { where: { id: order.id } }
      )
    ));
    
    if ((i + batchSize) % 5000 === 0 || i + batchSize >= count) {
      console.log(`[Seed] Orders: ${Math.min(i + batchSize, count)}/${count}`);
    }
  }
}

// Run seed
seed().catch(error => {
  console.error('[Seed] Fatal error:', error);
  process.exit(1);
});
