import MindsDB, { Database } from 'mindsdb-js-sdk';

export class MindsDBClient {
    private static connectionHost: string | undefined;
    private static user: string | undefined;
    private static password: string | undefined;
    private static connectionStateListeners = new Set<(connected: boolean) => void>();

    static onConnectionStateChanged(listener: (connected: boolean) => void): () => void {
        this.connectionStateListeners.add(listener);
        return () => {
            this.connectionStateListeners.delete(listener);
        };
    }

    private static notifyConnectionStateChanged() {
        const connected = this.isConnected();
        for (const listener of this.connectionStateListeners) {
            try {
                listener(connected);
            } catch (e) {
                console.error('MindsDB connection state listener error:', e);
            }
        }
    }

    private static isOfflineError(error: any): boolean {
        const code = String(error?.code || error?.cause?.code || '').toUpperCase();
        if (['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ETIMEDOUT', 'ECONNRESET'].includes(code)) {
            return true;
        }

        const message = String(error?.message || error || '').toLowerCase();
        return (
            message.includes('network error') ||
            message.includes('fetch failed') ||
            message.includes('failed to fetch') ||
            message.includes('socket hang up') ||
            message.includes('connect econnrefused') ||
            message.includes('econnrefused') ||
            message.includes('enotfound') ||
            message.includes('ehostunreach') ||
            message.includes('etimedout') ||
            message.includes('connection refused')
        );
    }

    private static handlePossibleOfflineError(error: any) {
        if (this.isConnected() && this.isOfflineError(error)) {
            this.disconnect();
        }
    }

    static async connect(host: string, user?: string, password?: string) {
        try {
            const axios = (await import('axios')).default;
            const httpClient = axios.create({ baseURL: host });
            let token = password;

            // For local connections with credentials, we often need to exchange them for a token
            // as the SDK's built-in auth logic skips local endpoints.
            if (user && password && (host.includes('localhost') || host.includes('127.0.0.1'))) {
                try {
                    const loginResponse = await axios.post(`${host.replace(/\/+$/, '')}/api/login`, {
                        email: user,
                        username: user,
                        password: password
                    }, {
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (loginResponse.data && loginResponse.data.token) {
                        token = loginResponse.data.token;
                    }
                } catch (loginError) {
                    console.warn("MindsDB manual login attempt failed, using password as-is:", loginError);
                }
            }

            if (token) {
                httpClient.interceptors.request.use((config: any) => {
                    config.headers['Authorization'] = `Bearer ${token}`;
                    return config;
                });
            }

            // Provide a host, user, and password to the connect method
            await MindsDB.connect({ host, user: user || '', password: password || '', httpClient });

            // Validate connectivity now (SDK connect can be lazy and not fail until first query).
            await MindsDB.SQL.runQuery('SELECT 1;');

            this.connectionHost = host;
            this.user = user;
            this.password = token; // Store the token (or original password if no token returned)
            this.notifyConnectionStateChanged();
            return true;
        } catch (error) {
            this.connectionHost = undefined;
            this.user = undefined;
            this.password = undefined;
            console.error("MindsDB Connection Error:", error);
            throw error;
        }
    }

    static isConnected(): boolean {
        return !!this.connectionHost;
    }

    static getHost(): string | undefined {
        return this.connectionHost;
    }

    static getToken(): string | undefined {
        return this.password;
    }

    static disconnect() {
        const wasConnected = this.isConnected();
        this.connectionHost = undefined;
        this.user = undefined;
        this.password = undefined;
        if (wasConnected) {
            this.notifyConnectionStateChanged();
        }
    }

    static async getSystemDatabases(): Promise<any[]> {
        if (!this.isConnected()) {return [];}
        try {
            const dbs = await MindsDB.Databases.getAllDatabases();
            return dbs.filter(d => d.name === 'information_schema' || d.name === 'log');
        } catch (e) {
            this.handlePossibleOfflineError(e);
            console.error(e);
            return [];
        }
    }

    static async getProjects(): Promise<any[]> {
        if (!this.isConnected()) {return [];}
        try {
            return await MindsDB.Projects.getAllProjects();
        } catch (e) {
            this.handlePossibleOfflineError(e);
            console.error(e);
            return [];
        }
    }

    static async getDatasources(): Promise<any[]> {
        if (!this.isConnected()) {return [];}
        try {
            const query = "SHOW FULL DATABASES WHERE type = 'data'";
            const result = await MindsDB.SQL.runQuery(query);
            return result.rows || [];
        } catch (e) {
            this.handlePossibleOfflineError(e);
            console.error(e);
            return [];
        }
    }

    static async runQuery(query: string) {
        if (!this.isConnected()) {throw new Error("Not connected to MindsDB. Please connect first.");}
        try {
            return await MindsDB.SQL.runQuery(query);
        } catch (error) {
            this.handlePossibleOfflineError(error);
            throw error;
        }
    }

    static async uploadFile(filePath: string, fileName: string): Promise<boolean> {
        if (!this.isConnected()) {throw new Error("Not connected to MindsDB. Please connect first.");}
        const baseUrl = this.connectionHost?.replace(/\/+$/, '');
        if (!baseUrl) {throw new Error("No host URL found.");}
        
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            
            const fileBuffer = await fs.readFile(filePath);
            const fileBlob = new Blob([fileBuffer]);
            
            const formData = new FormData();
            formData.append('file', fileBlob, path.basename(filePath));
            formData.append('original_file_name', path.basename(filePath));
            
            const headers: any = {};
            if (this.password) {
                headers['Authorization'] = `Bearer ${this.password}`;
            }
            
            const response = await fetch(`${baseUrl}/api/files/${fileName}`, {
                method: 'PUT',
                body: formData as any,
                headers: headers
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
            }
            return true;
        } catch (error) {
            this.handlePossibleOfflineError(error);
            console.error("Error uploading file:", error);
            throw error;
        }
    }

    static async getProjectItems(project: string, type: string): Promise<any[]> {
        if (!this.isConnected()) {return [];}
        try {
            // Mapping UI folder names to query types
            const queryMap: { [key: string]: string } = {
                'agents': 'agents',
                'jobs': 'jobs',
                'knowledge_bases': 'knowledge_bases',
                'models': 'models',
                'views': 'views'
            };
            const typeKey = queryMap[type] || type;
            const query = `SHOW ${typeKey} FROM ${project}`;
            const result = await MindsDB.SQL.runQuery(query) as any;
            return result.rows || [];
        } catch (error) {
            this.handlePossibleOfflineError(error);
            throw error;
        }
    }
}
