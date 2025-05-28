import { AuthenticationClient, AuthenticationClientOptions } from "auth0";
import { getAuth0Domain, getAuth0TraderClientId, getAuth0AdminClientId} from "../configuration";
import { SessionType } from "../session";
import { AuthProvider } from "./auth-provider";

const debugL3 = require('debug')('fw-L3-auth0-auth-provider');
const debugL2 = require('debug')('fw-L2-auth0-auth-provider');
const debugL1 = require('debug')('fw-L1-auth0-auth-provider');

export class Auth0AuthProvider extends AuthProvider{

    private clientId;
    private domain;
    private connection;
    private authClient!: AuthenticationClient;

    async init(sessionType: SessionType){
        return new Promise(async (resolve, reject) => {
            try {
                if(this.clientId == undefined){
                    if (sessionType == SessionType.trader) {
                        await getAuth0TraderClientId().then(result => {
                            this.clientId = result;
                        });
                    } else {
                        await getAuth0AdminClientId().then(result => {
                            this.clientId = result;
                        });
                    }
                    
                }
                this.connection = this.getAuth0Connection(sessionType)

                if(this.domain == undefined){
                    this.domain = await getAuth0Domain();
                }
                if(this.authClient == undefined){
                    const authClientOptions: AuthenticationClientOptions = {
                        domain: this.domain,
                        clientId: this.clientId
                    }
                    this.authClient = new AuthenticationClient(authClientOptions);
                }                        
                resolve("OK")
            } catch (error) {
                console.log(error);
                return reject('could not initialize Auth0 provider')
            }
        });               
    }

    async signIn(username: string, password: string): Promise<String> {
        debugL2('sign-in username=' + username + ', password=' + password);        

        const signInParams = {
            username: username,
            password: password,
            realm: this.connection
        }
        try {
            const signInResponse = await this.authClient.oauth.passwordGrant(signInParams);
            debugL3("auth0Token : ", signInResponse.id_token);
            return signInResponse.id_token;
        } catch (err) {
            debugL3('error: ' + JSON.stringify(err));
            if(err){
                throw(err);
            }
        }
    }

    private getAuth0Connection(sessionType: SessionType){
        if(sessionType === SessionType.trader) {
            return `p8-${process.env.EnvName}-trader-connection`;
        }
        else if(sessionType === SessionType.admin){
            return `p8-${process.env.EnvName}-admin-connection`;
        }
    }
    
    async signOut() {
        debugL2('sign-out');
    }
}
