import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Session } from './session';

const debugL3 = require('debug')('fw-L3-rest-client');
const debugL2 = require('debug')('fw-L2-rest-client');
const debugL1 = require('debug')('fw-L1-rest-client');
export class RestClient {

    private api: AxiosInstance;
    private config: AxiosRequestConfig;

    public constructor (session: Session) {
        this.config = session.getRequestConfig();
        this.api = axios.create(this.config);
        this.api.interceptors.request.use((param: AxiosRequestConfig) => ({
            ...param
        }));
        this.api.interceptors.response.use((param: AxiosResponse) => ({
            ...param
        }));
    }

    public getUri (): string {
        return this.api.getUri(this.config);
    }

    public request<T, R = AxiosResponse<T>> (): Promise<R> {
        return this.api.request(this.config);
    }

    public get<T, R = AxiosResponse<T>> (url: string): Promise<R> {
        return this.api.get(url, this.config);
    }

    public delete<T, R = AxiosResponse<T>> (url: string, data?: any): Promise<R> {
        this.config.data = data;
        return this.api.delete(url, this.config);
    }

    public head<T, R = AxiosResponse<T>> (url: string): Promise<R> {
        return this.api.head(url, this.config);
    }

    public post<T, R = AxiosResponse<T>> (url: string, data?: any): Promise<R> {
        debugL1('post ' + url);
        debugL3('payload:\n' + JSON.stringify(data));
        return this.api.post(url, data, this.config);
    }

    public put<T, R = AxiosResponse<T>> (url: string, data?: any): Promise<R> {
        return this.api.put(url, data, this.config);
    }

    public patch<T, R = AxiosResponse<T>> (url: string, data?: any): Promise<R> {
        return this.api.patch(url, data, this.config);
    }
}
