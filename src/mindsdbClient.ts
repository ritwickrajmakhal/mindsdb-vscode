import MindsDB, { Database } from 'mindsdb-js-sdk';

export class MindsDBClient {
    private static connectionHost: string | undefined;

    static async connect(host: string) {
        try {
            // Provide a host, user, and password to the connect method
            await MindsDB.connect({ host, user: '', password: '' });
            this.connectionHost = host;
            return true;
        } catch (error) {
            console.error("MindsDB Connection Error:", error);
            throw error;
        }
    }

    static isConnected(): boolean {
        return !!this.connectionHost;
    }

    static async getSystemDatabases(): Promise<any[]> {
        if (!this.isConnected()) return [];
        try {
            const dbs = await MindsDB.Databases.getAllDatabases();
            return dbs.filter(d => d.name === 'information_schema' || d.name === 'log');
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    static async getProjects(): Promise<any[]> {
        if (!this.isConnected()) return [];
        try {
            return await MindsDB.Projects.getAllProjects();
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    static async getDatasources(): Promise<any[]> {
        if (!this.isConnected()) return [];
        try {
            const query = "SHOW FULL DATABASES WHERE type = 'data'";
            const result = await MindsDB.SQL.runQuery(query);
            return result.rows || [];
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    static async runQuery(query: string) {
        if (!this.isConnected()) throw new Error("Not connected to MindsDB. Please connect first.");
        return await MindsDB.SQL.runQuery(query);
    }
}
