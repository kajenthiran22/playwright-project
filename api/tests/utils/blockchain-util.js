const { equals } = require('../../framework/verify');

async function createTokens(admin, tokens, log) {
    const createdTokenSymbols = [];

    for (const token of tokens) {
        const request = JSON.parse(JSON.stringify(token));  

        request.comment = 'end-to-end tests';

        const response = await admin.createNewToken(request);
        equals('OK', response.status);  

        log(`Token created: ${request.symbol}`);
        createdTokenSymbols.push(request.symbol);
    }

    return createdTokenSymbols;  
}

module.exports = {
    createTokens
};