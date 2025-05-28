import axios, { Method, AxiosResponse, AxiosError } from "axios";
import { getAdminApiUrl, getTraderApiUrl } from "../configuration";
import { SessionType } from "../session";
const debugL3 = require('debug')('fw-L3-session');
const debugL2 = require('debug')('fw-L2-session');
const debugL1 = require('debug')('fw-L1-session');
export class P8TokenIssuer {
    private authURL;

    constructor(sessionType: SessionType) {
        if (sessionType === SessionType.admin) {
            this.authURL = getAdminApiUrl('authenticate');
        } else {
            this.authURL = getTraderApiUrl('authenticate');
        }
    }

    public async getP8Token(idToken: string) {
        return new Promise((resolve, reject) => {
            const config = {
                url: this.authURL,
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'text/plain'
                }
            };

            axios.get<AxiosResponse>(
                this.authURL,
                config
            ).then((result: AxiosResponse<any>) => {
                debugL3('response:\n' + JSON.stringify(result.data));
                return resolve(result.data.payload);
            })
            .catch((err: AxiosError) => {
                debugL1('error: (' + err.response.status + ')\n' + JSON.stringify(err.response.data));                
                return reject(err);
            });

        });
    }
}