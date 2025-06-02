const { expect, test } = require('@playwright/test');
const { AdminSession } = require('../../framework/admin-session');
const { TraderSession } = require('../../framework/trader-session');
const { delay } = require('../../framework/utils');
const { equals, contains } = require('../../framework/verify');
const TestBase = require('../base/test-base');
const debugL3 = require('debug')('fw-L3-admin-session');
const { triggerSOD, triggerEOD, changeTradingDate } = require('../utils/opcycle-util');
const { toZonedTime, format } = require('date-fns-tz');

const admin = new AdminSession('admin');
const trader1 = new TraderSession("api-trader1", "Firm1")
const trader2 = new TraderSession("api-trader2", "Firm2");
const { v4: uuidv4 } = require('uuid');
const instruments = ["RLC.E", "SH.E",];
class TradePathTest extends TestBase {
    constructor() {
        super('On-Book Trade Path', 'TP', []);
        this.admin = admin;
        this.trader1 = trader1;
        this.trader2 = trader2;
        this.currency = "GBX";
        this.marketId = 'equity';
        this.baseQuantityScale = 8;
        this.feePercentage = 0.075;
        this.viewOnly = new AdminSession(this.viewOnlyId);
        this.sessions.push(this.admin, this.viewOnly);
    }

    async before() {
        await super.before();
        this.log('Setting up initial market and instrument data');
        this.market = (await this.admin.getMarket('equity')).payload;
        this.instrumentMap = new Map();
        for (const symbol of instruments) {
            const instrument = await this.admin.getInstrument(symbol);
            const quantityScale = instrument.payload.quantityScale;
            const priceScale = instrument.payload.priceScale;

            this.instrumentMap.set(symbol, { quantityScale, priceScale });
        }

        await this.trader1.start(this.market.marketId, instruments[0]);
        await this.trader2.start(this.market.marketId, instruments[0]);

        await this.admin.resetMarketSession(this.market.marketId, 'CLOSE');
        await this.admin.setMarketSession(this.market.marketId, 'OPEN');

        await this.cancelExistingOrders(instruments[0]);
    }

    async cancelExistingOrders(symbol) {
        await this.admin.sendMassCancel({
            requestId: uuidv4(),
            marketId: this.market.marketId,
            symbol: symbol,
            reason: "e2eTest",
        });
    }

    createOrder(symbol, trader, side, price, quantity) {
        return {
            orderType: "LMT",
            side: side,
            price: price,
            orderQty: quantity,
            tif: "GTC",
            symbol: symbol,
            orderCapacity: "DEAL",
            marketId: this.market.marketId,
            clOrderId: trader.nextId(),
            userId: trader.getUsername(),
        };
    }
    createOrderExpectedRes(orderRequest, traderUsername) {
        const instrument = this.instrumentMap.get(orderRequest.symbol)
        const priceScale = instrument.priceScale
        const quantityScale = instrument.quantityScale
        return {
            status: "OK",
            payload: {
                clOrderId: orderRequest.clOrderId,
                execType: "NEW",
                price: parseFloat(orderRequest.price).toFixed(priceScale),
                orderQty: parseFloat(orderRequest.orderQty).toFixed(quantityScale),
                stopPrice: parseFloat(0).toFixed(priceScale),
                leavesQty: parseFloat(orderRequest.orderQty).toFixed(quantityScale),
                averagePrice: parseFloat(0).toFixed(priceScale),
                cumExecSize: parseFloat(0).toFixed(quantityScale),
                orderStatus: "NEW",
                tif: orderRequest.tif,
                orderType: orderRequest.orderType,
                side: orderRequest.side,
                userId: orderRequest.userId,
                marketId: orderRequest.marketId,
                marketType: "SPOT",
                symbol: orderRequest.symbol,
                requestUserId: traderUsername
            },
        };
    }
    createOrderUpdatePayload(buy, sell) {
        return {
            payload: {
                buy: buy,
                sell: sell,
                instrumentSession: "OPEN",
            },
            type: "data",
        };
    }

    createInstrumentSessionPayload(symbol) {
        return {
            payload: {
                symbol: symbol,
                marketId: this.marketId,
                publish: true,
                instrumentSession: "OPEN",
            },
            type: "data",
        };
    }

    createOrderBookPayload(symbol, price, size) {
        const instrument = this.instrumentMap.get(symbol)
        const priceScale = instrument.priceScale
        const quantityScale = instrument.quantityScale
        return {
            payload: [
                {
                    symbol: symbol,
                    marketId: this.marketId,
                    price: parseFloat(price).toFixed(priceScale),
                    size: parseFloat(size).toFixed(quantityScale),
                    type: "ON_BOOK",
                },
            ],
            type: "data",
        };
    }
    createTradeCapturePayload(buyOrder, sellOrder, symbol, counterparty, price, size, side, status) {
        const instrument = this.instrumentMap.get(symbol)
        const priceScale = instrument.priceScale
        const quantityScale = instrument.quantityScale
        return {
            payload: {
                buyerClientOrderId: buyOrder.clOrderId,
                counterparty: counterparty,
                fillInstrument: symbol,
                marketType: "SPOT",
                messageType: "TCR",
                price: parseFloat(price).toFixed(priceScale),
                quantity: parseFloat(size).toFixed(quantityScale),
                sellerClientOrderId: sellOrder.clOrderId,
                settlementCurrency: this.currency,
                side: side,
                status: status,
                symbol: symbol,
                type: "TWO_SIDED_TRADE",
                tradeSize: parseFloat(size).toFixed(quantityScale),
            },
            type: "TRADE_CAPTURE",
        };
    }

    createExecutionReportPayload(order, traderUsername, execType, orderStatus) {
        const instrument = this.instrumentMap.get(order.symbol)
        const priceScale = instrument.priceScale
        const quantityScale = instrument.quantityScale
        return {
            payload: {
                intStatus: 200,
                clOrderId: order.clOrderId,
                execType: execType,
                price: parseFloat(order.price).toFixed(priceScale),
                orderQty: parseFloat(order.orderQty).toFixed(quantityScale),
                stopPrice: parseFloat(0).toFixed(priceScale),
                leavesQty: parseFloat(execType == "TRADE" ? 0 : order.orderQty).toFixed(quantityScale),
                averagePrice: parseFloat(execType == "TRADE" ? order.price : 0).toFixed(priceScale),
                cumExecSize: parseFloat(execType == "TRADE" ? order.orderQty : 0).toFixed(quantityScale),
                orderStatus: orderStatus,
                tif: order.tif,
                orderType: order.orderType,
                side: order.side,
                userId: order.userId,
                marketId: order.marketId,
                marketType: "SPOT",
                symbol: order.symbol,
                requestUserId: traderUsername,
                balanceAllocation: (parseFloat(0)).toFixed(this.baseQuantityScale),
                feeAllocation: (parseFloat(0)).toFixed(this.baseQuantityScale),
                positionUpdates: [],
            },
            type: "EXEC_REPORT",
        };
    }

    async executeTradeTest(symbol, buyQty, buyPrice, sellQty, sellPrice) {
        const buyOrderRequest = this.createOrder(symbol, this.trader1, "B", buyQty, buyPrice);
        const sellOrderRequest = this.createOrder(symbol, this.trader2, "S", sellQty, sellPrice);

        const buyOrderRes = await this.trader1.submitOrder(buyOrderRequest);
        equals(this.createOrderExpectedRes(buyOrderRequest, this.trader1.getUsername()), buyOrderRes);

        await this.trader1.expect([
            this.createOrderUpdatePayload([
                {
                    size: parseFloat(buyOrderRequest.orderQty).toFixed(this.instrumentMap.get(symbol).quantityScale),
                    price: parseFloat(buyOrderRequest.price).toFixed(this.instrumentMap.get(symbol).priceScale),
                }], []),
            this.createInstrumentSessionPayload(symbol),
            this.createExecutionReportPayload(buyOrderRequest, this.trader1.getUsername(), "NEW", "NEW")
        ]);

        const sellOrderRes = await this.trader2.submitOrder(sellOrderRequest);
        equals(this.createOrderExpectedRes(sellOrderRequest, this.trader2.getUsername()), sellOrderRes);

        await this.trader2.expect([
            this.createOrderUpdatePayload([], []),
            this.createInstrumentSessionPayload(symbol),
            this.createOrderBookPayload(symbol, sellOrderRequest.price, sellOrderRequest.orderQty),
            this.createExecutionReportPayload(sellOrderRequest, this.trader2.getUsername(), "NEW", "NEW"),
            this.createExecutionReportPayload(sellOrderRequest, this.trader2.getUsername(), "TRADE", "FILLED"),
            this.createTradeCapturePayload(buyOrderRequest, sellOrderRequest, symbol, "Firm1", sellOrderRequest.price, sellOrderRequest.orderQty, "SELL", "PENDING"),
            this.createTradeCapturePayload(buyOrderRequest, sellOrderRequest, symbol, "Firm1", sellOrderRequest.price, sellOrderRequest.orderQty, "SELL", "PENDING"),
        ]);

        await this.trader1.expect([
            this.createOrderUpdatePayload([], []),
            this.createInstrumentSessionPayload(symbol),
            this.createOrderBookPayload(symbol, buyOrderRequest.price, buyOrderRequest.orderQty),
            this.createTradeCapturePayload(buyOrderRequest, sellOrderRequest, symbol, "Firm2", buyOrderRequest.price, buyOrderRequest.orderQty, "BUY", "PENDING"),
            this.createTradeCapturePayload(buyOrderRequest, sellOrderRequest, symbol, "Firm2", buyOrderRequest.price, buyOrderRequest.orderQty, "BUY", "PENDING"),
            this.createExecutionReportPayload(buyOrderRequest, this.trader2.getUsername(), "TRADE", "FILLED")
        ]);
    }

    // Converts a date string to a Date object adjusted to the provided time zone.
    getZoneMappedDate(dateStr, timeZone) {
        const now = new Date();
        const date = new Date(dateStr);

        // Set the hours and minutes of the date to match the current time
        date.setHours(now.getHours(), now.getMinutes());
        return toZonedTime(date, timeZone);
    }

    // Formats a date string according to the specified pattern and time zone.
    formatDateWithZone(dateStr, timeZone, pattern) {
        return format(this.getZoneMappedDate(dateStr, timeZone), pattern);
    }
}

test.describe('On-Book Trade', () => {
    const tradePathTest = new TradePathTest();
    tradePathTest.setupHooks();
    tradePathTest.startTime = Date.now()
    test.describe("TP 1 - On-book trades between buyer Firm1, and seller Firm2", () => {

        const symbol = instruments[0];
        
        test('TP 1.1 - Create On-Book Trade', async () => {
            await tradePathTest.executeTradeTest(symbol, "10", "1000", "10", "1000");
        });

        test('TP 1.2 - Create On-Book Trade', async () => {
            await tradePathTest.executeTradeTest(symbol, "10", "7", "10", "7");
        });

        test('TP 1.3 - Create On-Book Trade', async () => {
            await tradePathTest.executeTradeTest(symbol, "10", "70", "10", "70");
        });

    })

    test.describe("TP 2- Admin query the trade reports", async () => {
        test('TP 2.1 Admin query the trades that occurred after a specific time.', async () => {
            const tradeReportQuery = {
                tradeType: "ALL",
                startTime: this.startTime
            }
            const tradeQueryRes = await admin.postTradeReportQuery(tradeReportQuery);
            equals({ status: 'OK' }, tradeQueryRes);
            equals(3, tradeQueryRes.payload.length)
            let expectedPayload = [];
            expectedPayload.push({
                "buyerFirmId": "Firm1",
                "sellerFirmId": "Firm2",
                "symbol": instruments[0],
                "marketType": "SPOT",
                "settlementCurrency": tradePathTest.currency,
                "status": "PENDING",
                "buyerOrderCapacity": "DEAL",
                "sellerOrderCapacity": "DEAL",
                "tradeType": "ON_BOOK",
            })
            contains(expectedPayload, tradeQueryRes.payload);

        })

        test('TP 2.2 Admin query the trades that occurred before a specific time', async () => {
            const tradeReportQuery = {
                tradeType: "ALL",
                startTime: this.startTime,
                endTime: Date.now()
            }
            const tradeQueryRes = await admin.postTradeReportQuery(tradeReportQuery);
            equals({ status: 'OK' }, tradeQueryRes);
            equals(3, tradeQueryRes.payload.length)
            let expectedPayload = [];
            expectedPayload.push({
                "buyerFirmId": "Firm1",
                "sellerFirmId": "Firm2",
                "symbol": instruments[0],
                "marketType": "SPOT",
                "settlementCurrency": tradePathTest.currency,
                "status": "PENDING",
                "buyerOrderCapacity": "DEAL",
                "sellerOrderCapacity": "DEAL",
                "tradeType": "ON_BOOK",
            })
            contains(expectedPayload, tradeQueryRes.payload);
        })

        test('TP 2.3 Admin, query the trades with a specific symbol', async () => {
            const tradeReportQuery = {
                tradeType: "ALL",
                startTime: this.startTime,
                symbol: instruments[1]
            }
            const tradeQueryRes = await admin.postTradeReportQuery(tradeReportQuery);
            equals({ status: 'OK' }, tradeQueryRes);
            equals(0, tradeQueryRes.payload.length)

        })

        test('TP 2.4.1 Admin, query the CANCELED Trades.', async () => {
            const tradeReportQuery = {
                tradeType: "ALL",
                startTime: this.startTime,
                tradeStatus: ["CANCELED"]
            }
            const tradeQueryRes = await admin.postTradeReportQuery(tradeReportQuery);
            equals({ status: 'OK' }, tradeQueryRes);
            equals(0, tradeQueryRes.payload.length)
        })

        test('TP 2.4.2 Admin, query the PENDING Trades.', async () => {
            const tradeReportQuery = {
                tradeType: "ALL",
                startTime: this.startTime,
                tradeStatus: ["PENDING"]
            }
            const tradeQueryRes = await admin.postTradeReportQuery(tradeReportQuery);
            equals({ status: 'OK' }, tradeQueryRes);
            equals(3, tradeQueryRes.payload.length)
            let expectedPayload = [];
            expectedPayload.push({
                "buyerFirmId": "Firm1",
                "sellerFirmId": "Firm2",
                "symbol": instruments[0],
                "marketType": "SPOT",
                "settlementCurrency": tradePathTest.currency,
                "status": "PENDING",
                "buyerOrderCapacity": "DEAL",
                "sellerOrderCapacity": "DEAL",
                "tradeType": "ON_BOOK",
            })
            contains(expectedPayload, tradeQueryRes.payload);

        })

        test('TP 2.5 Admin, query the trade which is blongs to specific firm.', async () => {
            const tradeReportQuery = {
                tradeType: "ALL",
                startTime: this.startTime,
                firmId: "Firm1"
            }
            const tradeQueryRes = await admin.postTradeReportQuery(tradeReportQuery);
            equals({ status: 'OK' }, tradeQueryRes);
            equals(3, tradeQueryRes.payload.length)
            let expectedPayload = [];
            expectedPayload.push({
                "buyerFirmId": "Firm1",
                "sellerFirmId": "Firm2",
                "symbol": instruments[0],
                "marketType": "SPOT",
                "settlementCurrency": tradePathTest.currency,
                "status": "PENDING",
                "buyerOrderCapacity": "DEAL",
                "sellerOrderCapacity": "DEAL",
                "tradeType": "ON_BOOK",
            })
            contains(expectedPayload, tradeQueryRes.payload);

        })
    })

    test.describe("TP 3- Admin query the trade capture reports", async () => {
        test('TP 3.1 Admin query the trade capture reports that occurred after a specific time.', async () => {

            const tcrReportQuery = {
                tradeType: "ALL",
                startTime: this.startTime
            }
            const tcrQueryRes = await admin.postTradeCaptureQuery(tcrReportQuery);
            equals({ status: 'OK' }, tcrQueryRes);
            equals(6, tcrQueryRes.payload.length)
            let expectedPayload = [];
            expectedPayload.push({
                "symbol": instruments[0],
                "marketType": "SPOT",
                "settlementCurrency": tradePathTest.currency,
                "status": "PENDING",
                "orderCapacity": "DEAL",
                "tradeType": "ON_BOOK",
            })
            contains(expectedPayload, tcrQueryRes.payload);
        })

        test('TP 3.2 Admin query the trade capture reports that occurred before a specific time', async () => {

            const tcrReportQuery = {
                tradeType: "ALL",
                startTime: this.startTime,
                endTime: Date.now()
            }
            const tcrQueryRes = await admin.postTradeCaptureQuery(tcrReportQuery);
            equals({ status: 'OK' }, tcrQueryRes);
            equals(6, tcrQueryRes.payload.length)
            let expectedPayload = [];
            expectedPayload.push({
                "symbol": instruments[0],
                "marketType": "SPOT",
                "settlementCurrency": tradePathTest.currency,
                "status": "PENDING",
                "orderCapacity": "DEAL",
                "tradeType": "ON_BOOK",
            })
            contains(expectedPayload, tcrQueryRes.payload);
        })

        test('TP 3.3 Admin, query the trade capture reports with a specific symbol', async () => {
            const tcrReportQuery = {
                tradeType: "ALL",
                startTime: this.startTime,
                symbol: instruments[1]
            }
            const tcrQueryRes = await admin.postTradeCaptureQuery(tcrReportQuery);
            equals({ status: 'OK' }, tcrQueryRes);
            equals(0, tcrQueryRes.payload.length)
        })

        test('TP 3.4.1 Admin, query the CANCELED trade capture reports.', async () => {
            const tcrReportQuery = {
                tradeType: "ALL",
                startTime: this.startTime,
                status: ["CANCELED"]
            }
            const tcrQueryRes = await admin.postTradeCaptureQuery(tcrReportQuery);
            equals({ status: 'OK' }, tcrQueryRes);
            equals(0, tcrQueryRes.payload.length)
        })

        test('TP 3.4.2 Admin, query the PENDING trade capture reports.', async () => {

            const tcrReportQuery = {
                tradeType: "ALL",
                startTime: this.startTime,
                status: ["PENDING"]
            }
            const tcrQueryRes = await admin.postTradeCaptureQuery(tcrReportQuery);
            equals({ status: 'OK' }, tcrQueryRes);
            equals(6, tcrQueryRes.payload.length)
            let expectedPayload = [];
            expectedPayload.push({
                "symbol": instruments[0],
                "marketType": "SPOT",
                "settlementCurrency": tradePathTest.currency,
                "status": "PENDING",
                "orderCapacity": "DEAL",
                "tradeType": "ON_BOOK",
            })
            contains(expectedPayload, tcrQueryRes.payload);
        })

        test('TP 3.5 Admin, query the trade capture reports wich is blongs to specific firm.', async () => {

            const tcrReportQuery = {
                tradeType: "ALL",
                startTime: this.startTime,
                firmId: "Firm1"
            }
            const tcrQueryRes = await admin.postTradeCaptureQuery(tcrReportQuery);
            equals({ status: 'OK' }, tcrQueryRes);
            equals(3, tcrQueryRes.payload.length)
            let expectedPayload = [];
            expectedPayload.push({
                "symbol": instruments[0],
                "marketType": "SPOT",
                "settlementCurrency": tradePathTest.currency,
                "status": "PENDING",
                "orderCapacity": "DEAL",
                "tradeType": "ON_BOOK",
            })
            contains(expectedPayload, tcrQueryRes.payload);
        })
    })
});

class TradeCancellationTest extends TradePathTest {
    constructor() {
        super('TradeCancellationTest', 'TC', []);
        this.supervisor = admin;
        this.viewOnly = new AdminSession(this.viewOnlyId);
        this.sessions.push(this.supervisor, this.viewOnly);
    }

    async getTradeId(startTime) {
        const tradeReportQuery = {
            tradeType: "ALL",
            startTime: startTime,
            endTime: Date.now(),
            symbol: instruments[0],
            tradeStatus: ["PENDING"],
        };
        const tradeQueryRes = await this.supervisor.postTradeReportQuery(tradeReportQuery);
        
        equals('OK', tradeQueryRes.status); 
        return (tradeQueryRes.payload[0].tradeId).toFixed(0);
    }
}

test.describe("Trade Cancellation", async () => {
    const tradeCancellationTest = new TradeCancellationTest();
    tradeCancellationTest.setupHooks();
    
    test('TC_1.1 - Trade cancellation on the trade date by View Only', async () => {
        const tradeId = await tradeCancellationTest.getTradeId(this.startTime);
        const expectedResponse = {status: 'FAILED', error: { rejectReason: "Request failed. Cause: [UPM002 - You do not have permission to do Trade cancel.] Resolution: [You don't have permission to do this operation. Please contact support if you believe this is an error.]" }}
        const actualResponse = await tradeCancellationTest.viewOnly.cancelTrade({tradeId: tradeId})
        await tradeCancellationTest.validateError(expectedResponse, actualResponse);
    })

    test('TC_1.2 - Trade cancellation on the trade date by Supervisor', async () => {
        const tradeId = await tradeCancellationTest.getTradeId(this.startTime);
        const expectedResponse = {status: 'OK', payload: {status: 'OK'}}
        const actualResponse = await tradeCancellationTest.supervisor.cancelTrade({tradeId: tradeId})
        await tradeCancellationTest.validateResult(expectedResponse, actualResponse);

        const expectedWebsocketMessages = [
            {
                payload: [{
                    tradeId,
                    execType: 'TRADE_CANCEL',
                    type: 'ON_BOOK'
                }],
                type: "data"
            },
            {
                payload: {
                    tradeId,
                    status: 'CANCELED',
                    type: "TWO_SIDED_TRADE",
                    tradeType: 'ON_BOOK'
                },
                type: "TRADE_CAPTURE",
            }
        ];
        await tradeCancellationTest.trader1.expect(expectedWebsocketMessages)
        await tradeCancellationTest.trader2.expect(expectedWebsocketMessages)

        const tradeReportQuery = {
            tradeType: "ALL",
            startTime: this.startTime,
            endTime: Date.now(),
            symbol: instruments[0],
            tradeStatus: ["CANCELED"],
        };
        const tradeQueryRes = await tradeCancellationTest.supervisor.postTradeReportQuery(tradeReportQuery);
        equals(tradeId, tradeQueryRes.payload[0].tradeId.toFixed(0)); // to ensure that the trade status has been updated in Trades - Admin UI

        const tcrReportQuery = {
            tradeType: "ALL",
            startTime: this.startTime,
            status: ["CANCELED"]
        }
        const tcrQueryRes = await admin.postTradeCaptureQuery(tcrReportQuery);
        equals(tradeId, tcrQueryRes.payload[0].tradeId.toFixed(0)); // to ensure that the trade status has been updated in Trade Legs - Admin UI
        equals(tradeId, tcrQueryRes.payload[1].tradeId.toFixed(0));

    })

    test('TC_2 - Trade cancellation after the trade date', async () => {
        const startTimeForNextTrade = Date.now()
        await tradeCancellationTest.executeTradeTest(instruments[0], "10", "70", "10", "70");
        const tradeId = await tradeCancellationTest.getTradeId(startTimeForNextTrade);
        await tradeCancellationTest.supervisor.resetMarketSession('equity', 'CLOSE');
        await tradeCancellationTest.supervisor.resetMarketSession('debt', 'CLOSE');
        await triggerEOD(tradeCancellationTest.supervisor); 
        await delay(2000)
        await triggerSOD(tradeCancellationTest.supervisor); 
        await delay(20000)


        const expectedResponse = {status: 'FAILED', error: { rejectReason: "Request failed. Cause: [VAL018 - Trade cancellations can only be performed on the current trading date of the trade.] Resolution: [Please check the trading date prior to cancellation.]" }}
        const actualResponse = await tradeCancellationTest.supervisor.cancelTrade({tradeId: tradeId})
        await tradeCancellationTest.validateError(expectedResponse, actualResponse);

        const tradeReportQuery = {
            tradeType: "ALL",
            startTime: startTimeForNextTrade,
            endTime: Date.now(),
            symbol: instruments[0],
            tradeStatus: ["PENDING"],
        };
        const tradeQueryRes = await tradeCancellationTest.supervisor.postTradeReportQuery(tradeReportQuery);
        equals(tradeId, tradeQueryRes.payload[0].tradeId.toFixed(0)); // to ensure that the trade status hasn't changed

        // get system time zone
        const systemParams = await tradeCancellationTest.supervisor.getSystemParameters();
        console.log(`System parameters ${JSON.stringify(systemParams)}`);
        systemTimeZone = systemParams.payload.systemTimeZone;
        console.log(`System time zone ${systemTimeZone}`);

        // Reset the trading date as current date
        const currentDate = new Date();
        const currentDateStr = tradeCancellationTest.formatDateWithZone(
            currentDate,
            systemTimeZone,
            "yyyy-MM-dd"
        );

        await changeTradingDate(tradeCancellationTest.supervisor, currentDateStr);
    })
})
