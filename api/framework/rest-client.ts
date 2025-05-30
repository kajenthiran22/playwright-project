import { request, APIResponse, APIRequestContext } from '@playwright/test';
import { Session } from './session';

const debugL3 = require('debug')('fw-L3-rest-client');
const debugL2 = require('debug')('fw-L2-rest-client');
const debugL1 = require('debug')('fw-L1-rest-client');

export class RestClient {

    private apiContext!: APIRequestContext;
    private config: any;

    private constructor(apiContext: APIRequestContext, config: any) {
        this.apiContext = apiContext;
        this.config = config;
    }

    public static async create(session: Session): Promise<RestClient> {
        const config = session.getRequestConfig();
        const apiContext = await request.newContext(config);
        return new RestClient(apiContext, config);
    }    

    public getUri(): string {
        // Playwright does not have getUri; return baseURL if present
        return this.config.baseURL || '';
    }

    public async request(url: string, options?: any): Promise<APIResponse> {
        debugL1('request ' + url);
        return await this.apiContext.fetch(url, { ...this.config, ...options });
    }

    public async get(url: string): Promise<APIResponse> {
        debugL1('get ' + url);
        return await this.apiContext.get(url, this.config);
    }

    public async delete(url: string, data?: any): Promise<APIResponse> {
        debugL1('delete ' + url);
        return await this.apiContext.delete(url, { ...this.config, data });
    }

    public async head(url: string): Promise<APIResponse> {
        debugL1('head ' + url);
        return await this.apiContext.head(url, this.config);
    }

    public async post(url: string, data?: any): Promise<APIResponse> {
        debugL1('post ' + url);
        debugL3('payload:\n' + JSON.stringify(data));
        return await this.apiContext.post(url, { ...this.config, data });
    }

    public async put(url: string, data?: any): Promise<APIResponse> {
        debugL1('put ' + url);
        return await this.apiContext.put(url, { ...this.config, data });
    }

    public async patch(url: string, data?: any): Promise<APIResponse> {
        debugL1('patch ' + url);
        return await this.apiContext.patch(url, { ...this.config, data });
    }

    public async dispose() {
        await this.apiContext.dispose();
    }
}

    