import { request, APIResponse } from '@playwright/test';
import { getAdminApiUrl, getTraderApiUrl } from "../configuration";
import { SessionType} from "../session";

const debugL3 = require('debug')('fw-L3-get-token');
const debugL2 = require('debug')('fw-L2-get-token');
const debugL1 = require('debug')('fw-L1-get-token');

const config = require('config');

export enum ClientType {
    admin = "ADMIN",
    trader = "TRADER"
}

export class GetToken {
    private username: string;
    private password: string;
    private type: ClientType;

    public constructor(id: string, type: SessionType) {
        try {
            this.username = config.get('sessions.' + id + '.username');
            this.password = config.get('sessions.' + id + '.password');
        } catch (err) {
            try {
                this.username = config.get('rest-interface.sessions.' + id + '.username');
                this.password = config.get('rest-interface.sessions.' + id + '.password');
            } catch (err) {
                this.username = id;
                this.password = (process.env.ProductVariant === "cix") ? 'Yl@123456789' : 'Yl@12345';
            }
        }

        // this.username = 'apiadmin01';
        // this.password = 'Yl@12345';
        
        this.type = type == SessionType.admin ? ClientType.admin : ClientType.trader;
        debugL1('created username=' + this.username + ', password=' + this.password + ', type=' + this.type);
    }

    public setUsername(username: string) {
        this.username = username;
    }

    public setPassword(password: string) {
        this.password = password;
    }

    public async getToken(): Promise<string>{
        const getTokenUrl = this.type == ClientType.admin ? getAdminApiUrl('/auth/v1/get-token') : getTraderApiUrl('/auth/v1/get-token');         
        const getTokenRequest = {  
            type: this.type,
            username: this.username,
            password: this.password
        }

        // Create context
        const apiContext = await request.newContext();
        try {
            const response: APIResponse = await apiContext.post(getTokenUrl, {
                data: getTokenRequest,
                headers: {
                    'Content-Type': 'text/plain'
                }
            });

            const body = await response.json();                                  
            debugL3('response:\n' + JSON.stringify(body));                       
            return body.payload;                                                 
        }
        catch (error: any) {
            const status = error.response?.status?.() ?? 'unknown';             
            const data   = error.response ? await error.response.json() : error;    
            debugL1(`error: (${status})\n` + JSON.stringify(data));            
            throw error;                                                         
        }
        finally { await apiContext.dispose() }
    }

    public async getGuestUserToken(){
        const getGuestUserTokenUrl = getTraderApiUrl('/auth/v1/get-guest-user-token');
        const getGuestUserTokenRequest = {type : "GUEST"}                    

        // Create context
        const apiContext = await request.newContext();

        try {
            const response: APIResponse = await apiContext.post(getGuestUserTokenUrl, {
                data: getGuestUserTokenRequest,
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
            const body = await response.json();
            debugL3('response:\n' + JSON.stringify(body));
            return body.payload;
        }
        catch (error: any) {
            const status = error.response?.status?.() ?? 'unknown';
            const data = error.response ? await error.response.json() : error;
            debugL1(`error: (${status})\n` + JSON.stringify(data));
            throw error;
        }
        finally { await apiContext.dispose() }
    }
}