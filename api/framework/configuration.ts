import exp from 'constants';
import { formatValueForUrl, loadScript } from './utils';
import { AxiosError, AxiosResponse } from 'axios';
import { RestClient } from './rest-client';

const debugL3 = require('debug')('fw-L3-admin-session');
const debugL2 = require('debug')('fw-L2-admin-session');
const debugL1 = require('debug')('fw-L1-admin-session');

const config = require('config');
const fs = require('fs');

const DEFAULT_URL = 'https://e2e.p8.yaalalabs.com/';

export interface UrlParams {
    pathParams?: { [key: string]: string },
    queryParams?: { [key: string]: string }
}

export function getTraderGUIUrl(): string {
    let url = (process.env.ENV_URL || DEFAULT_URL).trim();
    if (url.slice(-1) === '/') {
        url = url.slice(0, -1);
    }
    return url;
}

export function getAdminGUIUrl(): string {
    const url = getTraderGUIUrl();
    const index = url.indexOf('.');
    return url.substr(0, index) + '-admin' + url.substr(index);
}

export function getTraderUrl(): string {
    let url = (process.env.ENV_URL || DEFAULT_URL).trim();
    if (url.slice(-1) === '/') {
        url = url.slice(0, -1);
    }

    const index = url.indexOf('.');
    return url.substr(0, index) + url.substr(index);
}

export function getAdminUrl(): string {
    let url = (process.env.ENV_URL || DEFAULT_URL).trim();
    if (url.slice(-1) === '/') {
        url = url.slice(0, -1);
    }

    const index = url.indexOf('.');
    return url.substr(0, index) + '-admin' + url.substr(index);
}

export function getWebSocketUrl(): string {
    let url = getTraderGUIUrl()
        .replace('https', 'wss')
        .replace('http', 'ws');
    const index = url.indexOf('.');
    return url.substr(0, index) + '-ws' + url.substr(index);
}

export function getTraderApiBaseUrl(): string {
    return `${getTraderUrl()}/api`;
}


export function getTraderApiUrl(target: string, params?: UrlParams): string {
    return getTraderApiBaseUrl() + buildUri(target, params);
}

export function getAdminApiBaseUrl(): string {
    return `${getAdminUrl()}/api`;
}

export function getAdminApiUrl(target: string, params?: UrlParams): string {
    return getAdminApiBaseUrl() + buildUri(target, params);
}

export function buildUri(uri: string, params?: UrlParams) {
    if (params == null) {
        return uri;
    }
    // Replace path parameters
    if (params.pathParams != null) {
        for (const [key, value] of Object.entries(params.pathParams)) {
            uri = uri.replace(`{${key}}`, formatValueForUrl(value));
        }
    }
    // Add query parameters
    if (params.queryParams != null) {
        uri = `${uri}?`;
        for (const [key, value] of Object.entries(params.queryParams)) {
            let prefix = '&';
            if (uri.charAt(uri.length - 1) == '?') {
                prefix = '';
            }
            uri += `${prefix}${key}=${formatValueForUrl(value)}`;
        }
    }
    return uri;
}

// This function is used to get the EP for map with the documentation
// That cannot be done using the URL
export function getAdminApiEndPoint(target: string): string {
    return `/api${target}`;
}

// This function is used to get the EP for map with the documentation
// That cannot be done using the URL
export function getTraderApiEndPoint(target: string): string {
    return `/api${target}`;
}

export async function getUserPoolId() {
    return new Promise(async (resolve, reject) => {
        await loadScript(`${getTraderGUIUrl()}/env/aws-config.js`).then((result: any) => {
            resolve(result.aws_user_pools_id);
        }).catch(e => {
            console.error(e);
            reject(e);
        });
    });
}

export async function getTraderClientId() {
    return new Promise(async (resolve, reject) => {
        await loadScript(`${getTraderGUIUrl()}/env/aws-config.js`).then((result: any) => {
            resolve(result.aws_user_pools_web_client_id);
        }).catch(e => {
            console.error(e);
            reject(e);
        });
    });
}

export async function getAdminClientId() {
    return new Promise(async (resolve, reject) => {
        await loadScript(`${getAdminGUIUrl()}/env/aws-config.js`).then((result: any) => {
            resolve(result.aws_user_pools_web_client_id);
        }).catch(e => {
            console.error(e);
            reject(e);
        });
    });
}

export async function getAuth0Domain() {
    return new Promise(async (resolve, reject) => {
        await loadScript(`${getAdminGUIUrl()}/env/aws-config.js`).then((result: any) => {
            resolve(result.auth0_domain);
        }).catch(e => {
            console.error(e);
            reject(e);
        });
    });
}

export async function getAuth0TestClientId() {
    return new Promise(async (resolve, reject) => {
        await loadScript(`${getAdminGUIUrl()}/env/aws-config.js`).then((result: any) => {
            resolve(result.auth0_client_id);
        }).catch(e => {
            console.error(e);
            reject(e);
        });
    });
}

export async function getAuth0AdminClientId() {
    return new Promise(async (resolve, reject) => {
        await loadScript(`${getAdminGUIUrl()}/env/aws-config.js`).then((result: any) => {
            resolve(result.auth0_client_id);
        }).catch(e => {
            console.error(e);
            reject(e);
        });
    });
}

export async function getAuth0TraderClientId() {
    return new Promise(async (resolve, reject) => {
        await loadScript(`${getTraderGUIUrl()}/env/aws-config.js`).then((result: any) => {
            resolve(result.auth0_client_id);
        }).catch(e => {
            console.error(e);
            reject(e);
        });
    });
}

 export async function updateReferenceData(entity: string, id: any, request: any ,client:RestClient) {
    let result = await client.put<any>(getAdminApiUrl(entity) + id, request)
        .then((result: AxiosResponse<any>) => {
            debugL3('response:\n' + JSON.stringify(result.data));
            return result.data;
        })
        .catch((err: AxiosError) => {
            debugL3('Error: ', err);
            debugL1('error: (' + err.response?.status + ')\n' + JSON.stringify(err.response?.data));
            return err.response?.data;
        });

    return result;
}

export async function getReferenceData(entity: string, id: any,client:RestClient) {
    let result = await client.get<any>(getAdminApiUrl(entity) + id)
        .then((result: AxiosResponse<any>) => {
            debugL3('response:\n' + JSON.stringify(result.data));
            return result.data;
        })
        .catch((err: AxiosError) => {
            debugL3('Error: ', err);
            debugL1('error: (' + err.response?.status + ')\n' + JSON.stringify(err.response?.data));
            return err.response?.data;
        });

    return result;
}

export class ConfigurationProvider {
    private static instance: ConfigurationProvider;

    public profile: string;
    public fixOrRest: string;
    public users = {};

    private constructor(profile: string) {
        this.profile = profile;
        this.profile = config.get('preset.' + this.profile);
        this.fixOrRest = this.profile['fix-or-rest'];
        this.users = this.fixOrRest == 'REST' ? config.get('rest-interface.sessions') : config.get('fix-interface.sessions');

        //custom users loading
        if (this.profile['load-users-from-file']) {
            const userJsonFileName = this.profile ['load-users-from-file'];
            console.log(`Loading users from ${userJsonFileName}`);
            const tempJson = JSON.parse(fs.readFileSync(userJsonFileName));
            const users = tempJson["p8_users"];
            const tempUsers = {};
            tempUsers["admin"] = this.users["admin"];

            let i: number = 1;
            for (let usr of users) {
                let temp = {};
                temp["username"] = usr.userId;
                temp["password"] = "Yl@12345";

                tempUsers["bot" + i] = temp;
                i++;
            }

            this.users = tempUsers;
        }

    }

    public static get(profile?: string) {
        if (!profile) return null;
        if (!ConfigurationProvider.instance) {
            ConfigurationProvider.instance = new ConfigurationProvider(profile)
        }
        return ConfigurationProvider.instance;
    }
}