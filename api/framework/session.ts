import { AxiosError, AxiosResponse } from 'axios';
//import config from 'config';
import { PathLike } from 'fs';
import { stringify } from 'qs';
import { getAdminApiBaseUrl, getTraderApiBaseUrl, getTraderApiUrl, getWebSocketUrl } from "./configuration";
import { RestClient } from './rest-client';
import Web3 from "web3";
import { v4 as uuidv4 } from 'uuid';
import { Validator } from './validator';
import { Authenticator } from './auth-service/authenticator';
import { GetToken } from './auth-service/get-token';
const debugL3 = require('debug')('fw-L3-session');
const debugL2 = require('debug')('fw-L2-session');
const debugL1 = require('debug')('fw-L1-session');

const config = require('config');

export enum SessionType {
    admin = "ADMIN",
    trader = "TRADER",
    guest = "GUEST"
}
export class Session {

    private username: string;
    private password: string;
    private userWalletAddress: string;
    private type: SessionType;
    private token: string;
    public isLoggedIn: boolean;
    private authenticator: GetToken;

    private requestConfig: any;
    private session: any;
    private sessionId: any;
    private userId
    private validator: Validator;
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

        this.session = id
        this.type = type;
        this.validator = new Validator();
        this.authenticator = new GetToken(id, type);
        debugL1('created username=' + this.username + ', password=' + this.password + ', type=' + this.type);
    }

    public getUsername(): string {
        return this.username;
    }

    public getwalletAddress(): string {
        return this.userWalletAddress;
    }

    public setLoginStatus(status: boolean) {
        this.isLoggedIn = status;
    }

    public setUsername(username: string) {
        this.username = username;
        this.authenticator.setUsername(username);
    }

    public setPassword(password: string) {
        this.password = password;
        this.authenticator.setPassword(password);
    }
    public setRequestConfig(requestConfig: string) {
        this.requestConfig = requestConfig;
    }
    public getType(): string {
        return this.type;
    }

    public getAuthenticationToken(): string {
        return this.token;
    }

    public getRequestConfig(): any {
        return this.requestConfig;
    }
    public getSession(): any {
        return this.session;
    }
    public getUserId(): any {
        return this.userId;
    }

    public async login() {
        debugL1('login username=' + this.username);
        let baseUrl: string;
        if (this.type == SessionType.admin) {
            baseUrl = getAdminApiBaseUrl();
        } else {
            baseUrl = getTraderApiBaseUrl();
        }

        // this.token = "eyJraWQiOiI1akpYMzJOR2JUeEF5MlwvZjVFSzFXOEhtUWpwYlBKWVwvVTVwUXZsdnk1aUk9IiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiIwN2RmNzg5Zi1kMGMyLTQ5YjgtOGU5NC02M2U2YWI3NjM0NzQiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tXC91cy1lYXN0LTFfclROYVZtaWlBIiwiY29nbml0bzp1c2VybmFtZSI6InB1bGEtc3VwZXIiLCJyZW1lbWJlckRldmljZUR1cmF0aW9uIjoiOTgiLCJvcmlnaW5fanRpIjoiNWNiYWZkNDktNjkzZC00NmZkLTg1NWItYjhlYThjMjczYjA3IiwiYXVkIjoiNW11ZDE0MG92ZTRuaDhqYWgxaTBvdmtpN2siLCJldmVudF9pZCI6IjQxOTgzNGY1LWNhMzMtNGY1Yi05NzQ5LTcxZDVlNzg2MjNkYSIsIm9hdGgiOiJ7XCJpc0FueUFkbWluXCI6dHJ1ZSxcImlzQWRtaW5cIjp0cnVlLFwiaXNTZWxmY2FyZUFkbWluXCI6ZmFsc2UsXCJpc0FueVRyYWRlclwiOmZhbHNlLFwiaXNUcmFkZXJcIjpmYWxzZSxcImlzR3Vlc3RcIjpmYWxzZX0iLCJ0b2tlbl91c2UiOiJpZCIsImF1dGhfdGltZSI6MTY3NTA2NTE3OSwic2Vzc2lvblRva2VuIjoiMmEzNWIwNGUtNDc4Mi00OGMxLTlmYTctODY0NjNlNjc5MTk4IiwiZW5hYmxlTWZhIjoiZmFsc2UiLCJleHAiOjE2NzUxMTkxNzgsImlhdCI6MTY3NTA2NTE3OSwianRpIjoiOWRmNWVjNTgtOTJkOC00OTU0LTg3YmItNDQ5MjZlYTdkNjA5IiwiZW1haWwiOiJwdWxhQHlhYWxhbGFicy5jb20ifQ.0D23J6lK2JgDeW0bSqjPtKO4AChKQOrMvWYEP1PLj7QJU8_SzNTmrrZK9xhYHPfuc2iXtSFWDGbRWMr5koWOD2zxC78-7pN2VYAM4-yCIdQDviCR6r8kNpACDwUWLP4qUyiNTdi0G2J3csmZ0Tsn5WopTdNEwaJL2gGZ3y01I3L3vAuEChrmtLLU978F9QJn8Gc5LQa0LcHl0SstqLL2ykFxi7mZ2FfLuDgxvTy91qN2nE6-_gaTs2ZVpBVpQ7oGGkLVEDwVubBveSqKIOiX_QAh4nEM8sgCY3FsiLeZ-imN_UtZmvWxWWiF7WXabsVLVcjbkHX6aCA6kfe7DTxxSg"
        this.token = await this.authenticator.getToken();
        debugL3('authentication token=' + this.token);
        if (!this.token) {
            throw this.token;
        }
        this.requestConfig = {
            returnRejectedPromiseOnError: true,
            withCredentials: true,
            timeout: 30000,
            baseURL: baseUrl,
            headers: {
                common: {
                    'accept': 'application/json',
                    'authorization': 'Bearer ' + this.token,
                    'cache-control': 'no-cache',
                    'content-type': 'application/json',
                    'pragma': 'no-cache'
                },
            },
            paramsSerializer: (params: PathLike) => {
                stringify(params, {
                    indices: false
                })
            },
        }

        debugL3('request config' + JSON.stringify(this.requestConfig, null, 2));
    }

    public async getTraderWSUrl() {
        debugL1('Getting websocket url= ' + this.username);
        let baseWebSocketUrl: string;
        baseWebSocketUrl = getWebSocketUrl();
        this.token = await this.authenticator.getToken();
        debugL3('authentication token=' + this.token);
        if (!this.token) {
            throw this.token;
        }
        return this.generateWebSocketUrl(baseWebSocketUrl,this.token)
    }

    private generateWebSocketUrl(baseWebSocketUrl: string, bearerToken: string): string {
        const isManual = true; 
        const urlWithToken = `${baseWebSocketUrl}?xtoken=${encodeURIComponent(bearerToken)}`;
        const finalUrl = `${urlWithToken}&isManual=${isManual}`;
        return finalUrl;
    }

    public async logout() {
        debugL1('logout username=' + this.username);
        // if (this.authenticator) {
        //     this.authenticator.signOut(this);
        // }
    }
    public async walletLogin() {
        let baseUrl: string = getTraderApiBaseUrl();
        let web3 = new Web3()
        let client = new RestClient(this);
        let address = config.get('sessions.' + this.session + '.walletAddress');
        this.userWalletAddress = address;
        let privateKey = config.get('sessions.' + this.session + '.privateKey');
        let reqNonce = {
            address: address,
            requestId: uuidv4()
        }
        let result = await this.getnonce(client, reqNonce);
        let sign = web3.eth.accounts.sign(result.nonce, privateKey);
        let reqVerify = {
            address: address,
            nonce: result.nonce,
            sign: sign.signature,
            requestId: uuidv4()
        }
        let verify = await this.verifySign(client, reqVerify);

        if (!verify.credential.Token) {
            throw this.token;
        }
        this.token = verify.credential.Token
        this.sessionId = verify.sessionId
        debugL3('authentication token=' + this.token);
        this.requestConfig = {
            returnRejectedPromiseOnError: true,
            withCredentials: true,
            timeout: 30000,
            baseURL: baseUrl,
            headers: {
                common: {
                    'accept': 'application/json',
                    'authorization': 'Bearer ' + this.token,
                    'cache-control': 'no-cache',
                    'content-type': 'application/json',
                    'pragma': 'no-cache'
                },
            },
            paramsSerializer: (params: PathLike) => {
                stringify(params, {
                    indices: false
                })
            },
        }

        debugL3('request config' + JSON.stringify(this.requestConfig, null, 2));
    }
    private async verifySign(client: RestClient, reqVerify: { address: any; nonce: any; sign: string; requestId: string; }) {
        return await client.post<any>(getTraderApiUrl('verify'), reqVerify)
            .then((result: AxiosResponse<any>) => {
                debugL3('response:\n' + JSON.stringify(result.data));
                this.userId = result.data.payload.user.id
                return result.data.payload;
            })
            .catch((err: AxiosError) => {
                debugL1('error:\n' + JSON.stringify(err.response.data));
                return err.response.data;
            });
    }

    private async getnonce(client: RestClient, reqNonce: { address: any; requestId: string; }) {
        return await client.post<any>(getTraderApiUrl('nonce'), reqNonce)
            .then((result: AxiosResponse<any>) => {
                debugL3('response:\n' + JSON.stringify(result.data));
                return result.data.payload;
            })
            .catch((err: AxiosError) => {
                debugL1('error:\n' + JSON.stringify(err.response.data));
                return err.response.data;
            });
    }

    public async walletlogout() {
        let client = new RestClient(this);
        let logoutRequest = {
            sessionId: this.sessionId,
            requestId: uuidv4()
        }
        return await client.post<any>(getTraderApiUrl('logout'), logoutRequest)
            .then((result: AxiosResponse<any>) => {
                debugL3('response:\n' + JSON.stringify(result.data));
            })
            .catch((err: AxiosError) => {
                debugL1('error:\n' + JSON.stringify(err.response.data));
                return err.response.data;
            });
    }

    protected validateResponse(request: any, method: any, ep: any): any {
        return this.validator.validate(request, method, ep);
    }
}
