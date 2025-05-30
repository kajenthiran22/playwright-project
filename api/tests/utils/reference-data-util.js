const blockchainUtil = require('./blockchain-util')

async function setupRefData(admin, params, log) {
    const { deployTokens } = params;

    if (deployTokens && deployTokens.length > 0) {
        await blockchainUtil.createTokens(admin, deployTokens, log);
    }
}

module.exports = {
    setupRefData
};
