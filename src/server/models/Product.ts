import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from './index.js';
import type { Category } from './Category.js';

interface ProductAttributes {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  categoryId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ProductCreationAttributes extends Optional<ProductAttributes, 'id' | 'description'> {}

export class Product extends Model<ProductAttributes, ProductCreationAttributes> implements ProductAttributes {
  declare id: number;
  declare name: string;
  declare description: string | null;
  declare price: number;
  declare stock: number;
  declare categoryId: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Associations
  declare category?: Category;
}

export function initProduct() {
  Product.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      categoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id',
        },
      },
    },
    {
      sequelize,
      tableName: 'products',
      timestamps: true,
      indexes: [
        { fields: ['categoryId'] },
        // Note: intentionally NOT indexing name for slow text search demo
      ],
    }
  );
}
