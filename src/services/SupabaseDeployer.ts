import { Client } from 'pg';
import fs from 'fs-extra';
import chalk from 'chalk';

export class SupabaseDeployer {
    /**
     * Deploys the content of a SQL file to the configured Supabase database.
     * @param connectionString The Postgres connection string (postgres://user:pass@host:port/db)
     * @param sqlFilePath Path to the SQL file to execute
     */
    static async deploySchema(connectionString: string, sqlFilePath: string): Promise<void> {
        console.log(chalk.blue(`\n⚡ [Supabase Autopilot] Connecting to database...`));

        const client = new Client({
            connectionString: connectionString,
            ssl: { rejectUnauthorized: false }, // Required for Supabase in many envs
        });

        try {
            await client.connect();
            console.log(chalk.green(`✔ Connected.`));

            console.log(chalk.blue(`Reading schema from: ${sqlFilePath}`));
            const sqlContent = await fs.readFile(sqlFilePath, 'utf-8');

            console.log(chalk.yellow(`Executing SQL migration...`));
            await client.query(sqlContent);

            console.log(chalk.green(`✔ Schema deployed successfully.`));
        } catch (err: any) {
            console.error(chalk.red(`\n❌ Deployment Failed:`));
            if (err.message.includes('password authentication failed')) {
                console.error(chalk.red(`   -> Invalid Password in Connection String.`));
            } else if (err.message.includes('addr not available')) {
                console.error(chalk.red(`   -> Host unreachable. Check your internet connection.`));
            } else {
                console.error(chalk.red(`   -> ${err.message}`));
            }
            throw err;
        } finally {
            await client.end();
        }
    }
}
