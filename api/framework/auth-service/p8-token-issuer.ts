import { request, APIResponse } from '@playwright/test';
import { getAdminApiUrl, getTraderApiUrl } from "../configuration";
import { SessionType } from "../session";
const debugL3 = require('debug')('fw-L3-session');
const debugL2 = require('debug')('fw-L2-session');
const debugL1 = require('debug')('fw-L1-session');
export class P8TokenIssuer {
    private authURL: string;

    constructor(sessionType: SessionType) {
        if (sessionType === SessionType.admin) {
            this.authURL = getAdminApiUrl('authenticate');
        } else {
            this.authURL = getTraderApiUrl('authenticate');
        }
    }

    public async getP8Token(idToken: string) {
        // return new Promise((resolve, reject) => {
        // const config = {
        //     url: this.authURL,
        //     headers: {
        //         'Authorization': `Bearer ${idToken}`,
        //         'Content-Type': 'text/plain'
        //     }
        // };

        // Create context
        const apiContext = await request.newContext();
        try {
            const response: APIResponse = await apiContext.get(this.authURL, {
                headers: {
                    'Authorization': `Bearer ${idToken}`,
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
}