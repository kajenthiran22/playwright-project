import axios, { AxiosError, AxiosResponse } from "axios";
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
        return new Promise((resolve, reject) => {
            const getTokenUrl = this.type == ClientType.admin ? getAdminApiUrl('/auth/v1/get-token') : getTraderApiUrl('/auth/v1/get-token');         
            const config = {
                url: getTokenUrl,
                headers: {
                    'Content-Type': 'text/plain'
                }
            };
            const getTokenRequest = {  
                    type: this.type,
                    username: this.username,
                    password: this.password
                }            
            axios.post<AxiosResponse>(
                getTokenUrl,
                getTokenRequest,
                config
            ).then((result: AxiosResponse<any>) => {
                debugL3('response:\n' + JSON.stringify(result.data));
                return resolve(result.data.payload);
            })
            .catch((err: AxiosError) => {
                // debugL1('error: (' + err.response.status + ')\n' + JSON.stringify(err.response.data));
                debugL1(JSON.stringify(err))                
                return reject(err);
            });
        });
    }

    public async getGuestUserToken(){

        return new Promise((resolve, reject) => {
            const getGuestUserTokenUrl = getTraderApiUrl('/auth/v1/get-guest-user-token');
            const getGuestUserTokenRequest = {type : "GUEST"}                    
            const config = {
                url: getGuestUserTokenUrl,
                headers: {
                    'Content-Type': 'text/plain'
                }
            };
            axios.post<AxiosResponse>(
                getGuestUserTokenUrl,
                getGuestUserTokenRequest,
                config
            ).then((result: AxiosResponse<any>) => {
                debugL3('response:\n' + JSON.stringify(result.data));
                return resolve(result.data.message);
            })
            .catch((err: AxiosError) => {
                debugL1('error: (' + err.response.status + ')\n' + JSON.stringify(err.response.data));                
                return reject(err);
            });
        });
    }
}