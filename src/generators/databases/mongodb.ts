// MongoDB generator - simplified version without AI calls
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface MongoDBSchema {
  collections: MongoCollection[];
}

export interface MongoCollection {
  name: string;
  schema: any;
  indexes: string[];
}

export async function generateMongoDBStack(prompt: string, projectPath: string): Promise<void> {
  console.log(chalk.cyan('\n🍃 Generating MongoDB stack...\n'));

  // Create MongoDB connection utility
  const connectionCode = `import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/helix-app';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongoose) => {
      return mongoose;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
`;

  await fs.ensureDir(path.join(projectPath, 'src', 'lib'));
  await fs.writeFile(path.join(projectPath, 'src', 'lib', 'mongodb.ts'), connectionCode);
  console.log(chalk.green('✅ Created MongoDB connection utility'));

  console.log(chalk.cyan('\n📦 MongoDB setup complete\n'));
}
