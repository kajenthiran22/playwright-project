import { SessionType } from "../session";

export enum PasswordChallenge {
    NEW_PASSWORD_REQUIRED = "NEW_PASSWORD_REQUIRED",
    SMS_MFA = "SMS_MFA"
}

export abstract class AuthProvider{

    abstract init(sessionType: SessionType);
    abstract signIn(username: string, password: string);
    abstract signOut();
}