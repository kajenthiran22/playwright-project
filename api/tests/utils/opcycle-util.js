const { delay } = require('../../framework/utils');
const { equals } = require('../../framework/verify');

async function triggerSOD(admin) {
    for(const marketId of ['equity', 'debt']) {
        const marketSession = await admin.getMarketSession(marketId);
        if (marketSession.sessionType !== 'CLOSE') {
            await admin.setMarketSession(marketId, 'CLOSE');
        }
    }

    let sodCompleted = false;
    let retries = 0;
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

    equals({ status: "OK" }, await admin.runSystemEvent("SOD"));

    while (retries < 10 && !sodCompleted) {
        let stateUpdateData = await admin.expect([
            { type: "STATE_UPDATE" }
        ]);
        stateUpdateData.find(
            (item) => {
                if (item.payload && item.payload.stateKey == "Operations/SOD/Status" && item.payload.state == "DONE") {
                    sodCompleted = true;
                }
            }
        );
        retries++;
    }
    expect(sodCompleted).toBe(true);
}

async function triggerEOD(admin) {
    let eodCompleted = false;
    let retries = 0;
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

    for(const marketId of ['equity', 'debt']) {
        const marketSession = await admin.getMarketSession(marketId);
        if (marketSession.sessionType !== 'CLOSE') {
            await admin.setMarketSession(marketId, 'CLOSE');
        }
    }

    equals({ status: "OK" }, await admin.runSystemEvent("EOD"));

    while (retries < 10 && !eodCompleted) {
        let stateUpdateData = await admin.expect([
            { type: "STATE_UPDATE" }
        ]);
        stateUpdateData.find(
            (item) => {
                if (item.payload && item.payload.stateKey == "Operations/EOD/Status" && item.payload.state == "DONE") {
                    eodCompleted = true;
                }
            }
        );
        retries++;
    }
    expect(eodCompleted).toBe(true);
}

async function changeTradingDate(adminSession, tradingDateStr) {
    // Trigger eod
    await triggerEOD(adminSession);
    await delay(10000);

    // Set next trading date
    let requestNextTradingDay = { nextTradingDay: tradingDateStr };
    let nextTradingDayUpdateResponse = await adminSession.updateNextTradingDay(requestNextTradingDay);
    equals({ status: 'OK' }, nextTradingDayUpdateResponse);

    // Trigger SOD
    await triggerSOD(adminSession);
    await delay(10000);
}

module.exports = {
    triggerSOD,
    triggerEOD,
    changeTradingDate
};