const { equals, contains, compare } = require('../../framework/verify');

/**
 * Invokes the specified API action with the given parameters 
 * and validates the response against the expected result.
 */
async function invokeApiAndValidate(getExpectedResponse, action, params, apiClient, log, transactionData) {
    log(`Querying for ${JSON.stringify(params)}`)
    const expectedResponse = await getExpectedResponse(transactionData, params);
    const actualResponse = await action.apply(apiClient, [params]);
    await validateResult(expectedResponse, actualResponse, log);
}

async function validateResult(expectedResponse, actualResponse, log) { 
    try {
        equals(
            { status: expectedResponse.status, payload: expectedResponse.payload },
            { status: actualResponse.status, payload: actualResponse.payload }
        );
        log('Result validated successfully.');
    } catch (error) {
        log(`Validation failed: ${error.message}`);
        throw new Error(`Validation failed: ${error.message}`);
    }
}

async function validateError(expectedResponse, actualResponse, log) {
    try {
        equals(
            { status: expectedResponse.status, error: expectedResponse.error },
            { status: actualResponse.status, error: actualResponse.error }
        );
        log('Error validated successfully.');
    } catch (error) {
        log(`Validation failed: ${error.message}`);
        throw new Error(`Validation failed: ${error.message}`);
    }
}

function recordMatches(expected, actual, ignoreFields = [], log) {
    for (const key in expected) {
        
        if (ignoreFields.includes(key)) {
            continue;
        }
        // check the key
        if (!Object.prototype.hasOwnProperty.call(actual, key)) {
            log(`recordMatches: Key "${key}" not found in actual record.`);
            return false;
        }
        // check the field values.
        if (!compare(expected[key], actual[key])) {
            log(`recordMatches: Mismatch for key "${key}": expected ${JSON.stringify(expected[key])} vs actual ${JSON.stringify(actual[key])}`);
            return false;
        }
    }
    return true;
}
  
async function validateRecords(expectedRecords, actualRecords, ignoreFields = [], log) {
    expectedRecords.forEach((expectedRecord, index) => {
        const found = actualRecords.find(actualRecord =>
            recordMatches(expectedRecord, actualRecord, ignoreFields, log)
        );
        if (!found) {
            throw new Error(`Expected record not found at index ${index}: ${JSON.stringify(expectedRecord)}`);
        } else {
            log(`Record validated successfully: ${JSON.stringify(expectedRecord)}`);
        }
    });
}

module.exports = {
    invokeApiAndValidate,
    validateResult,
    validateRecords,
    validateError
};
