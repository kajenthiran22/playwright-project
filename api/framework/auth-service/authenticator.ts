import { SessionType } from "../session";
import { AuthProvider } from "./auth-provider";
import { AuthProviderFactory } from "./auth-provider-factory";
import { P8TokenIssuer } from "./p8-token-issuer";

const debugL3 = require('debug')('fw-L3-authenticator');
const debugL2 = require('debug')('fw-L2-authenticator');
const debugL1 = require('debug')('fw-L1-authenticator');

export class Authenticator{

    constructor(readonly authProvider: AuthProvider, readonly tokenIssuer: P8TokenIssuer){
    }

    public static async get(sessionType: SessionType) {
        const provider = await AuthProviderFactory.get(sessionType);
        return new Authenticator(provider, new P8TokenIssuer(sessionType));
    };

    public async signIn(username: string, password: string){
        debugL2('sign-in username=' + username + ', password=' + password);

        try {
            const providerToken = await this.authProvider.signIn(username, password);
            const token = await this.tokenIssuer.getP8Token(providerToken);
            return token;      
        } catch (err) {
            debugL1('error: ' + JSON.stringify(err));
            throw err;
        }
    }

    public async signOut(){
        debugL2('sign-out');

        try {
            await this.authProvider.signOut();                
        } catch (err) {
            debugL1('sign-out error: ' + JSON.stringify(err));
            throw err;
        }
    }
}