import fs from "fs";
import { expect } from "chai";
import { OpenApiDocument, OpenApiValidator } from "express-openapi-validate";

const debugL1 = require('debug')('fw-L1-validator');
export class Validator {
    protected openApiValidator: OpenApiValidator = undefined;

    public constructor() {
        try {
            const apiDocument = JSON.parse(fs.readFileSync('./openapi.json', 'utf-8'));
            this.openApiValidator = new OpenApiValidator(apiDocument, {});
        } catch (err) {
            debugL1('error: ' + JSON.stringify(err));
        }
    }

    validate(message: any, method: any, ep: any) {
        const validateResponse = this.openApiValidator.validateResponse(method, ep);
        expect(validateResponse(message)).to.be.undefined;
        return message;
    }
}
