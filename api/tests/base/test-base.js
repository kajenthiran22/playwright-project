const { delay } = require('@yaalalabs/p8-e2e-api-framework');
const { setupRefData } = require('../utils/reference-data-util');
const { validateResult, validateError, validateRecords } = require('../utils/validation-util');
const { log } = require('../utils/logging-util');
const timestamp = Date.now().toString().slice(-6);
class TestBase {
    operatorId = "apioperator" + timestamp;
    viewOnlyId = "apiviewonly" + timestamp;
    tradingDate = null;
    nextTradingDate = null;
    systemMode = null;
    systemOperationCycleStatus = null;
    operationsEODStatus = null;
    operationsSODStatus = null;

    constructor(testClassName, testCaseId, sessions, referenceData = {}, transactionData = {}) {
        this.testCaseId = testCaseId;
        this.testClassName = testClassName;
        this.sessions = sessions;
        this.referenceData = referenceData;
        this.transactionData = transactionData;
        this.log = log(testClassName, testCaseId);
    }

    async before() {
        this.log(`Initializing test.`);
        await this.startSessions();
        await this.setupInitialSystemState(this.sessions[0]);

        if (Object.keys(this.referenceData).length > 0) {
            await setupRefData(this.sessions[0], this.referenceData, this.log);
        }

        if (Object.keys(this.transactionData).length > 0) {
            await delay(2000);
            await setupTransactionData(this.sessions[0], this.transactionData, this.log);
        }

        // get initial data
        let retries = 0;
        while (retries < 5 && !this.tradingDate) {
          let initialData = await this.sessions[0].expect([
            { type: "initial_data" },
          ]);

          let systemStateData = initialData.find((item) => {
            if (
              item.payload &&
              typeof item.payload === 'object' &&
              !Array.isArray( item.payload )
            ) {
              return (
                "System/Mode" in item.payload &&
                "System/OperationCycle/Status" in item.payload &&
                "Operations/EOD/Status" in item.payload &&
                "Operations/SOD/Status" in item.payload &&
                "System/Trading/Date" in item.payload &&
                "System/Trading/NextDate" in item.payload
              );
            }
            return false;
          });

          if (systemStateData) {
            this.systemMode = systemStateData.payload["System/Mode"];
            this.systemOperationCycleStatus = systemStateData.payload["System/OperationCycle/Status"];
            this.operationsEODStatus = systemStateData.payload["Operations/EOD/Status"];
            this.operationsSODStatus = systemStateData.payload["Operations/SOD/Status"];
            this.tradingDate = systemStateData.payload["System/Trading/Date"];
            this.nextTradingDate = systemStateData.payload["System/Trading/NextDate"];
          }
          retries++;
        }
        this.log(`Trading Date ${this.tradingDate}`);
        this.log(`Next Trading Date ${this.nextTradingDate}`);
        this.log(`System Mode ${this.systemMode}`);
        this.log(`Operation cycle status ${this.systemOperationCycleStatus}`);
        this.log(`EOD Status ${this.operationsEODStatus}`);
        this.log(`SOD Status ${this.operationsSODStatus}`);
    }

    async after() {
        this.log(`Finishing up test.`);
        await this.stopSessions();
    }

    async setupRefData (referenceData) {
        await setupRefData(this.sessions[0], referenceData, this.log);
    }

    async setupTransactionData (transactionData) {
        await setupTransactionData(this.sessions[0], transactionData, this.log);
    }

    async invokeApiAndValidate(getExpectedResponse, action, params) {
        await invokeApiAndValidate(getExpectedResponse, action, params, this.sessions[0], this.log, this.transactionData);
    }

    async validateResult(expectedResponse, actualResponse) {
        await validateResult(expectedResponse, actualResponse, this.log);
    }

    async validateRecords(expectedRecords, actualRecords, ignoreFields = []) {
        await validateRecords(expectedRecords, actualRecords, ignoreFields, this.log);
    }

    async validateError(expectedResponse, actualResponse) {
        await validateError(expectedResponse, actualResponse, this.log);
    }

    setupHooks() {
        before(async () => {
            await this.before();
        });

        after(async () => {
            await this.after();
        });
    }

    async startSessions() {
        for (const session of this.sessions) {
            if (session && session.start) {
                this.log(`Starting ${session.constructor.name}`);
                await session.start();
            }
        }
    }

    async stopSessions() {
        for (const session of this.sessions) {
            if (session && session.stop) {
                this.log(`Stopping ${session.constructor.name}`);
                await session.stop();
            }
        }
    }

    async setupInitialSystemState(admin) {
        const systemState = (await admin.getSystemState()).payload.state;
        if (systemState === "MAINTENANCE") {
            await admin.setSystemState('ONLINE');
            await admin.expect([
                {
                    payload: {
                        stateKey: "System/Mode",
                        state: "ONLINE",
                        previousState: "MAINTENANCE",
                    },
                    type: "STATE_UPDATE",
                },
            ]);
        }
        await admin.setMarketSession('equity', 'OPEN');
        await admin.setMarketSession('debt', 'OPEN');
    }

    async setSystemInMaintenance() {
        const admin = this.sessions[0];
        for(const marketId of ['equity', 'debt']) {
            const marketSession = await admin.getMarketSession(marketId);
            if (marketSession.sessionType !== 'CLOSE') {
                await admin.setMarketSession(marketId, 'CLOSE');
            }
        }

        const systemState = (await admin.getSystemState()).payload.state;
        if (systemState != "MAINTENANCE") {
            await admin.setSystemState("MAINTENANCE");
            await admin.expect([
                {
                    payload: {
                        stateKey: "System/Mode",
                        state: "MAINTENANCE",
                        previousState: "ONLINE",
                    },
                    type: "STATE_UPDATE",
                },
            ]);
        }
    }
}

module.exports = TestBase;
