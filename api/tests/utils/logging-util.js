function log(testClassName, testCaseId) {
    return function log(message) {
        const timestamp = new Date().toISOString();
        console.log(`${timestamp} [${testClassName}] [${testCaseId}] ${message}`);
    };
}

module.exports = {
    log
};
