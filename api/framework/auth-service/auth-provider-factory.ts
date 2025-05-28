import { SessionType } from "../session";
import { AuthProvider } from "./auth-provider";
import { Auth0AuthProvider } from "./auth0-auth-provider";

let authService;

export class AuthProviderFactory {
    
    public static async get(sessionType: SessionType): Promise<AuthProvider> {
        authService = new Auth0AuthProvider();
        await authService.init(sessionType);
        return authService;
    }
}