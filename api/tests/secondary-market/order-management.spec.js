const { expect, test } = require('@playwright/test');
const { AdminSession } = require('../../framework/admin-session');
const { TraderSession } = require('../../framework/trader-session');
const { delay } = require('../../framework/utils');
const { equals } = require('../../framework/verify');
const {
    createOrderReq,
    cancelExistingOrdersBySymbol,
    submitOrderAndValidateSuccessResponses,
    submitOrderAndValidateErrorResponses
} = require('../utils/trade-and-order-util');
const {
    updateFirm
} = require('../utils/firm-util');
const TestBase = require('../base/test-base');

const timestamp = Date.now();
const admin = new AdminSession('admin');
const equityTrader = new TraderSession("traderapi12", "Firm1");
const debtTrader = new TraderSession("traderapi06", "Firm1");
const equitySymbol = 'E2EOM_EQ_' + timestamp;
const equityAsset = 'E2EOM_EQ.E_' + timestamp.toString().slice(-6);
const debtSymbol = 'E2EOM_DBT_' + timestamp;
const debtAsset = 'E2EOM_DB.D_' + timestamp.toString().slice(-6);
const tickStructure = 'E2ETK' + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
const instrumentParam = 'e2eip' + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
const buySide = 'B', sellSide = 'S';
const equityMarketId = 'equity';
const debtMarketId = 'debt';

class OrderManagementTest extends TestBase {
    constructor() {
        super('OrderManagementTest', 'OM', []);
        this.admin = admin;
        this.equityTrader = equityTrader;
        this.debtTrader = debtTrader;
        this.sessions.push(this.admin);
    }
}


test.describe('Order Management ', () => {
    // test.describe.configure({ mode: 'serial' });

    const orderManagementTest = new OrderManagementTest();
    orderManagementTest.setupHooks();

    test('Setup1 - Equity asset creation ', async () => {
        const request = {
            symbol: equityAsset,
            type: 'BPX_EQUITY',
            firmIdx: 1,
            tokenSubType: 'VOTING',
            quantityScale: 0,
            issuedShares: 50000
        };
        const expectedResponse = { status: 'OK', payload: request };
        const actualResponse = await admin.addInstrument(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('Setup2 - Tick structure creation', async () => {
        const request = {
            tickStructureId: tickStructure,
            ticks: [{ start: '1', end: '10', tick: '0.1' }, { start: '10', end: '20', tick: '0.1' }]
        };
        const expectedResponse = { status: 'OK', payload: request };
        const actualResponse = await admin.addTickStructure(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('Setup3 - Instrument Parameter creation', async () => {
        const tickStructureIdx = (await admin.getTickStructure(tickStructure)).payload.idx;

        const request = {
            instrumentParameterId: instrumentParam,
            tickStructureIdx: tickStructureIdx,
            minimumSizeVariation: '2',
            minimumSize: '2',
            maximumSize: '50000',
            maximumValue: '800000',
            protectionThresholdOnLimitOrders: '30',
            circuitBreaker: '12'
        };
        const expectedResponse = { status: 'OK', payload: request };
        const actualResponse = await admin.addInstrumentParameter(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('Setup4 - Equity instrument creation', async () => {
        const baseInstrumentIdx = (await admin.getInstrument(equityAsset)).payload.idx;
        const instrumentParameterIdx = (await admin.getInstrumentParameter(instrumentParam)).payload.idx;

        const request = {
            symbol: equitySymbol,
            shortName: equitySymbol,
            type: 'BPX_EQUITY_PAIR',
            status: 'ACTIVE',
            baseInstrumentIdx: baseInstrumentIdx,
            quoteInstrumentIdx: 2,
            isin: 'T0378331005',
            markets: [1],
            instrumentParameterIdx: instrumentParameterIdx,
            settlementCycle: 'T_PLUS_2',
            priceScale: 2,
            quantityScale: 0,
            cfiCode: 'ESVUFR',
            admissionDate: '2024-12-10',
            referencePrice: '10',
            requestDate: '2024-12-03',
            approvalDate: '2024-12-07'
        };
        const expectedResponse = { status: 'OK', payload: request };
        const actualResponse = await admin.addInstrument(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('Setup5 - Start Equity Trade session', async () => {
        await equityTrader.start(equityMarketId, equitySymbol);
    });

    test('Setup6 - Debt asset creation ', async () => {
        const request = {
            symbol: debtAsset,
            type: 'BPX_DEBT',
            settlementInstrumentIdx: 1,
            parValue: '1000',
            issueDate: '2024-01-01',
            maturityDate: '2025-12-31',
            firmIdx: 1,
            quantityScale: 0,
            issuedAmount: 10000,
            assetDataIdx: 1,
            seniority: 'SENIOR',
            coupon: '5.500',
            couponsPerYear: '4',
            couponPaymentDate: ["2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31"],
            dayCountConvention: 'THIRTY360'
        };

        const expectedResponse = { status: 'OK', payload: request };
        const actualResponse = await admin.addInstrument(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('Setup7 - Debt instrument creation', async () => {
        const baseInstrumentIdx = (await admin.getInstrument(debtAsset)).payload.idx;
        const instrumentParameterIdx = (await admin.getInstrumentParameter(instrumentParam)).payload.idx;

        const request = {
            symbol: debtSymbol,
            shortName: debtSymbol,
            type: 'BPX_DEBT_PAIR',
            status: 'ACTIVE',
            baseInstrumentIdx: baseInstrumentIdx,
            quoteInstrumentIdx: 2,
            description: 'Test Debt 1 OM',
            isin: 'T0378331005',
            markets: [2],
            instrumentParameterIdx: instrumentParameterIdx,
            settlementCycle: 'T_PLUS_2',
            priceScale: 2,
            quantityScale: 0,
            cfiCode: 'ESVUFR',
            referencePrice: '10.00',
            admissionDate: '2024-12-10',
            requestDate: '2024-12-03',
            approvalDate: '2024-12-07'
        };
        const expectedResponse = { status: 'OK', payload: request };
        const actualResponse = await admin.addInstrument(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);

    });

    test('Setup8 - Start Debt Trade session', async () => {
        await debtTrader.start(debtMarketId, debtSymbol);
    });

    test('OM_1.1 - New order submission with order capacity - DEAL', async () => {
        const request = createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId);
        const expectedResponse = {
            status: 'OK',
            payload: { side: buySide, price: '10.00', orderQty: '1000', orderCapacity: 'DEAL', orderStatus: 'NEW' }
        };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_1.2 - New order submission with order capacity - MTCH', async () => {
        const request = createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'MTCH', equityMarketId);
        const expectedResponse = {
            status: 'OK',
            payload: { side: buySide, price: '10.00', orderQty: '1000', orderCapacity: 'MTCH', orderStatus: 'NEW' }
        };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_1.3 - New order submission with order capacity - AOTC', async () => {
        const request = createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'AOTC', equityMarketId);
        const expectedResponse = {
            status: 'OK',
            payload: { side: buySide, price: '10.00', orderQty: '1000', orderCapacity: 'AOTC', orderStatus: 'NEW' }
        };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_3 - Price is inconsistent with the applicable Tick Structure', async () => {
        const request = createOrderReq(equitySymbol, equityTrader, buySide, '10.02', '1000', 'GTC', 'DEAL', equityMarketId);
        const expectedResponse = {
            status: 'OK',
            payload: { orderStatus: 'REJECTED', rejectReason: 'Price is not a multiple of the price tick' }
        };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_4 - Order Size is not a multiple of the applicable Minimum Size Variation', async () => {
        const request = createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '3', 'GTC', 'DEAL', equityMarketId);
        const expectedResponse = {
            status: 'OK',
            payload: {
                orderStatus: 'REJECTED',
                rejectReason: 'Order size should be a multiple of the minimum size variation'
            }
        };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_5 - Order Size is less than the applicable Minimum Size', async () => {
        const request = createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '1', 'GTC', 'DEAL', equityMarketId);
        const expectedResponse = {
            status: 'OK',
            payload: { orderStatus: 'REJECTED', rejectReason: 'Size is below the minimum size' }
        };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_7 - Order Size is greater than the applicable Maximum Size', async () => {
        const request = createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '60000', 'GTC', 'DEAL', equityMarketId);
        const expectedResponse = {
            status: 'OK',
            payload: { orderStatus: 'REJECTED', rejectReason: 'Size is above the maximum size' }
        };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_9 - Value is greater than the applicable Maximum Value', async () => {
        const request = createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '850000', 'GTC', 'DEAL', equityMarketId);
        const expectedResponse = {
            status: 'OK',
            payload: { orderStatus: 'REJECTED', rejectReason: 'Size is above the maximum size' }
        };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_15.1 - Outside the Price Band for Sell Order', async () => {
        const request = createOrderReq(equitySymbol, equityTrader, sellSide, '6.00', '1000', 'GTC', 'DEAL', equityMarketId);
        const expectedResponse = {
            status: 'OK',
            payload: {
                orderStatus: 'REJECTED',
                rejectReason: 'The price of the limit order exceeds the price band defined for this instrument.'
            }
        };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_15.2 - Outside the Price Band for Buy Order', async () => {
        const request = createOrderReq(equitySymbol, equityTrader, buySide, '15.00', '1000', 'GTC', 'DEAL', equityMarketId);
        const expectedResponse = {
            status: 'OK',
            payload: {
                orderStatus: 'REJECTED',
                rejectReason: 'The price of the limit order exceeds the price band defined for this instrument.'
            }
        };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_16 - Market has been Halted', async () => {
        await admin.setMarketSession(equityMarketId, 'HALT');

        const request = createOrderReq(equitySymbol, equityTrader, sellSide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId);
        const expectedResponse = {
            status: 'OK',
            payload: { orderStatus: 'REJECTED', rejectReason: 'Market or instrument is halted' }
        };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);

        await admin.setMarketSession(equityMarketId, 'OPEN');
        await delay(1000);
    });

    test('OM_17 - Instrument market session has been Halted', async () => {
        await admin.setInstrumentSession(equityMarketId, equitySymbol, 'HALT');

        const request = createOrderReq(equitySymbol, equityTrader, sellSide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId);
        const expectedResponse = {
            status: 'OK',
            payload: { orderStatus: 'REJECTED', rejectReason: 'Market or instrument is halted' }
        };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);

        await admin.setInstrumentSession(equityMarketId, equitySymbol, 'OPEN');
        await delay(1000);
    });

    test('OM_18.1 - Instrument is in suspended state', async () => {
        const instrument = (await admin.getInstrument(equitySymbol)).payload;
        await admin.updateInstrument(equitySymbol, {
            idx: instrument.idx,
            symbol: equitySymbol,
            shortName: instrument.shortName,
            type: instrument.type,
            status: 'SUSPENDED',
            baseInstrumentIdx: instrument.baseInstrumentIdx,
            quoteInstrumentIdx: instrument.quoteInstrumentIdx,
            isin: instrument.isin,
            markets: instrument.markets,
            instrumentParameterIdx: instrument.instrumentParameterIdx,
            settlementCycle: instrument.settlementCycle,
            priceScale: instrument.priceScale,
            quantityScale: instrument.quantityScale,
            cfiCode: instrument.cfiCode,
            admissionDate: instrument.admissionDate,
            referencePrice: instrument.referencePrice,
            requestDate: instrument.requestDate,
            approvalDate: instrument.approvalDate,
            ref_ver: instrument.ref_ver
        });

        const request = createOrderReq(equitySymbol, equityTrader, sellSide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId);
        const expectedResponse = { status: 'FAILED', error: { rejectReason: 'Instrument not active' } };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateError(expectedResponse, actualResponse);
    });

    test('OM_18.2 - Instrument is in inactive state', async () => {
        const instrument = (await admin.getInstrument(equitySymbol)).payload;
        await admin.updateInstrument(equitySymbol, {
            idx: instrument.idx,
            symbol: equitySymbol,
            shortName: instrument.shortName,
            type: instrument.type,
            status: 'INACTIVE',
            baseInstrumentIdx: instrument.baseInstrumentIdx,
            quoteInstrumentIdx: instrument.quoteInstrumentIdx,
            isin: instrument.isin,
            markets: instrument.markets,
            instrumentParameterIdx: instrument.instrumentParameterIdx,
            settlementCycle: instrument.settlementCycle,
            priceScale: instrument.priceScale,
            quantityScale: instrument.quantityScale,
            cfiCode: instrument.cfiCode,
            admissionDate: instrument.admissionDate,
            referencePrice: instrument.referencePrice,
            requestDate: instrument.requestDate,
            approvalDate: instrument.approvalDate,
            ref_ver: instrument.ref_ver
        });

        const request = createOrderReq(equitySymbol, equityTrader, sellSide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId);
        const expectedResponse = { status: 'FAILED', error: { rejectReason: 'Instrument not active' } };
        const actualResponse = await equityTrader.submitOrder(request);
        await orderManagementTest.validateError(expectedResponse, actualResponse);

        const instrumentEdit = (await admin.getInstrument(equitySymbol)).payload;
        await admin.updateInstrument(equitySymbol, {
            idx: instrumentEdit.idx,
            symbol: equitySymbol,
            shortName: instrument.shortName,
            type: instrumentEdit.type,
            status: 'ACTIVE',
            baseInstrumentIdx: instrumentEdit.baseInstrumentIdx,
            quoteInstrumentIdx: instrumentEdit.quoteInstrumentIdx,
            isin: instrumentEdit.isin,
            markets: instrument.markets,
            instrumentParameterIdx: instrumentEdit.instrumentParameterIdx,
            settlementCycle: instrumentEdit.settlementCycle,
            priceScale: instrumentEdit.priceScale,
            quantityScale: instrumentEdit.quantityScale,
            cfiCode: instrumentEdit.cfiCode,
            admissionDate: instrumentEdit.admissionDate,
            referencePrice: instrumentEdit.referencePrice,
            requestDate: instrumentEdit.requestDate,
            approvalDate: instrumentEdit.approvalDate,
            ref_ver: instrumentEdit.ref_ver
        });
    });

    test.skip('OM_19.2.1 - An inactive user submits an order', async () => {
        const user = (await admin.getUser('traderapi12')).payload;
        await admin.updateUser(user.userId, {
            idx: user.idx,
            status: 'INACTIVE',
            userId: user.userId,
            fullName: user.fullName,
            type: user.type,
            userType: user.userType,
            accounts: user.accounts,
            roles: user.roles,
            firmIdx: user.firmIdx,
            unitIdx: user.unitIdx,
            email: user.email,
            ref_ver: user.ref_ver
        });

        const request = createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId);
        const expectedResponse = {status: "FAILED", error: {rejectReason: "User not active"}};
        const actualResponse = await equityTrader.submitOrder(request);
        equals(expectedResponse, actualResponse);
    });

    test.skip('OM_19.2.2 - Active An inactive user', async () => {
        const userEdit = (await admin.getUser('traderapi12')).payload;
        await admin.updateUser(userEdit.userId, {
            idx: userEdit.idx,
            status: 'ACTIVE',
            userId: userEdit.userId,
            fullName: userEdit.fullName,
            type: userEdit.type,
            userType: userEdit.userType,
            accounts: userEdit.accounts,
            roles: userEdit.roles,
            firmIdx: userEdit.firmIdx,
            unitIdx: userEdit.unitIdx,
            email: userEdit.email,
            ref_ver: userEdit.ref_ver
        });
        expect((await admin.getUser('traderapi12')).payload.status).toBe('ACTIVE');
        await equityTrader.start(equityMarketId, equitySymbol);
    });

    test('OM_20.1 - Trader modifies the price of an open order', async () => {
        const order = (await equityTrader.submitOrder(createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId))).payload;
        const modifiedPrice = '9.00';

        const request = {
            clOrderId: equityTrader.nextId(),
            origClOrderId: order.clOrderId,
            marketId: order.marketId,
            orderId: order.orderId,
            orderQty: order.orderQty,
            orderType: order.orderType,
            price: modifiedPrice,
            side: order.side,
            symbol: order.symbol,
            tif: order.tif,
            userId: order.userId
        };
        const expectedResponse = {
            status: 'OK',
            payload: { orderId: order.orderId, price: modifiedPrice, execType: 'REPLACED' }
        };
        const actualResponse = await equityTrader.modifyOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_20.2 - Trader modifies the size of an open order', async () => {
        const order = (await equityTrader.submitOrder(createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId))).payload;
        const modifiedSize = '1500';

        const request = {
            clOrderId: equityTrader.nextId(),
            origClOrderId: order.clOrderId,
            marketId: order.marketId,
            orderId: order.orderId,
            orderQty: modifiedSize,
            orderType: order.orderType,
            price: order.price,
            side: order.side,
            symbol: order.symbol,
            tif: order.tif,
            userId: order.userId
        };
        const expectedResponse = {
            status: 'OK',
            payload: { orderId: order.orderId, orderQty: modifiedSize, execType: 'REPLACED' }
        };
        const actualResponse = await equityTrader.modifyOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_20.3 - Trader modifies the tif of an open order', async () => {
        const order = (await equityTrader.submitOrder(createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId))).payload;
        const modifiedTif = 'DAY';

        const request = {
            clOrderId: equityTrader.nextId(),
            origClOrderId: order.clOrderId,
            marketId: order.marketId,
            orderId: order.orderId,
            orderQty: order.orderQty,
            orderType: order.orderType,
            price: order.price,
            side: order.side,
            symbol: order.symbol,
            tif: modifiedTif,
            userId: order.userId
        };
        const expectedResponse = {
            status: 'OK',
            payload: { orderId: order.orderId, tif: modifiedTif, execType: 'REPLACED' }
        };
        const actualResponse = await equityTrader.modifyOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_21 - Trader cancels an open order', async () => {
        const order = (await equityTrader.submitOrder(createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId))).payload;

        const request = {
            clOrderId: equityTrader.nextId(),
            origClOrderId: order.clOrderId,
            marketId: order.marketId,
            orderId: order.orderId,
            symbol: order.symbol,
            userId: order.userId
        };
        const expectedResponse = { status: 'OK', payload: { orderStatus: 'CANCELED', orderId: order.orderId } };
        const actualResponse = await equityTrader.cancelOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);
    });

    test('OM_24.1 - Day orders are automatically cancelled at the end of trading day', async () => {
        const order = (await equityTrader.submitOrder(createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId))).payload;
        const modifiedTif = 'DAY';
        const dayOrder = {
            clOrderId: equityTrader.nextId(),
            origClOrderId: order.clOrderId,
            marketId: order.marketId,
            orderId: order.orderId,
            orderQty: order.orderQty,
            orderType: order.orderType,
            price: order.price,
            side: order.side,
            symbol: order.symbol,
            tif: modifiedTif,
            userId: order.userId
        };
        await equityTrader.modifyOrder(dayOrder);
        await admin.setMarketSession(equityMarketId, 'CLOSE');

        await equityTrader.expect([
            {
                payload: {
                    symbol: order.symbol,
                    orderId: order.orderId,
                    price: order.price,
                    orderQty: order.orderQty,
                    orderStatus: 'EXPIRED',
                    tif: modifiedTif
                }
            }
        ]);

        await admin.setMarketSession(equityMarketId, 'OPEN');
        await delay(1000);
    });

    test('OM_24.2.1 - GTC orders are not cancelled at the end of the trading day', async () => {
        const order = (await equityTrader.submitOrder(createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId))).payload;
        await admin.setMarketSession(equityMarketId, 'CLOSE');

        await equityTrader.expect([
            {
                payload: {
                    symbol: order.symbol,
                    orderId: order.orderId,
                    price: order.price,
                    orderQty: order.orderQty,
                    orderStatus: 'NEW',
                    tif: order.tif
                }
            }
        ]);

        await admin.setMarketSession(equityMarketId, 'OPEN');
        await delay(1000);
    });

    test('OM_24.2.2 - GTC orders can be cancelled on the trading day', async () => {
        const order = (await equityTrader.submitOrder(createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '800', 'GTC', 'DEAL', equityMarketId))).payload;
        await admin.setMarketSession(equityMarketId, 'CLOSE');
        await admin.setMarketSession(equityMarketId, 'OPEN');
        await delay(1000);

        const request = {
            clOrderId: equityTrader.nextId(),
            origClOrderId: order.clOrderId,
            marketId: order.marketId,
            orderId: order.orderId,
            symbol: order.symbol,
            userId: order.userId
        };
        const expectedResponse = { status: 'OK', payload: { orderStatus: 'CANCELED', orderId: order.orderId } };
        const actualResponse = await equityTrader.cancelOrder(request);
        await orderManagementTest.validateResult(expectedResponse, actualResponse);

        await equityTrader.expect([
            {
                payload: {
                    symbol: order.symbol,
                    orderId: order.orderId,
                    price: order.price,
                    orderQty: order.orderQty,
                    orderStatus: 'CANCELED',
                    tif: order.tif
                }
            }
        ]);
    });

    test('OM_24.2.3 - GTC orders remain open for execution for the next trading day', async () => {
        const order = (await equityTrader.submitOrder(createOrderReq(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId))).payload;
        await admin.setMarketSession(equityMarketId, 'CLOSE');
        await admin.setMarketSession(equityMarketId, 'OPEN');
        await delay(1000);

        const trader2 = new TraderSession("api-trader2", "Firm2");
        await trader2.start(equityMarketId, equitySymbol);
        await trader2.submitOrder({
            orderType: 'LMT',
            side: 'S',
            price: '10.00',
            orderQty: '25000',
            tif: 'GTC',
            symbol: equitySymbol,
            orderCapacity: 'DEAL',
            marketId: equityMarketId,
            clOrderId: trader2.nextId(),
            userId: trader2.getUsername()
        });

        await equityTrader.expect([
            {
                payload: {
                    symbol: order.symbol,
                    orderId: order.orderId,
                    price: order.price,
                    orderQty: order.orderQty,
                    orderStatus: 'FILLED',
                    tif: order.tif
                }
            }
        ]);
    });

    test.describe('OM_27 - CCP and Clearing Member', () => {

        test.beforeEach(async () => {
            // Clean up any existing orders before each test
            console.log('=============> Time at OM_27 beforeEach start: ' + new Date().toISOString());

            await cancelExistingOrdersBySymbol(debtSymbol, debtMarketId, admin);

            console.log('=============> Time at OM_27 cancel equity order: ' + new Date().toISOString());

            await cancelExistingOrdersBySymbol(equitySymbol, equityMarketId, admin);

            console.log('=============> Time at OM_27 cancel debt order: ' + new Date().toISOString());

            await debtTrader.start(debtMarketId, debtSymbol);

            console.log('=============> Time at OM_27 beforeEach end: ' + new Date().toISOString());
        });

        test('OM_27.1 - Trader submitting an equity order from a firm which does not have a CCP Account', async () => {

            console.log('=============> Time at OM_27.1 start: ' + new Date().toISOString());

            let firmData = (await admin.getFirm("Firm1")).payload;
            const ccpAccount = firmData.ccpAccount;

            console.log('=============> Time at OM_27.1 get firm 1: ' + new Date().toISOString());

            await updateFirm(firmData.firmId, firmData.name, firmData.status, firmData.type, firmData.ref_ver,
                firmData.ref_seq, firmData.lei, firmData.idx, firmData.clearingMember, null, admin);

            const expectedResponse = {
                status: 'OK',
                payload: {
                    orderStatus: 'REJECTED',
                    rejectReason: 'Your CCP account details have not been set up. Please contact market operations'
                }
            };

            console.log('=============> Time at OM_27.1 updateFirm 1: ' + new Date().toISOString());

            await submitOrderAndValidateErrorResponses(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId, expectedResponse);

            console.log('=============> Time at OM_27.1 submitOrderAndValidateErrorResponses: ' + new Date().toISOString());

            firmData = (await admin.getFirm("Firm1")).payload;

            console.log('=============> Time at OM_27.1 get firm 1: ' + new Date().toISOString());

            await updateFirm(firmData.firmId, firmData.name, firmData.status, firmData.type, firmData.ref_ver,
                firmData.ref_seq, firmData.lei, firmData.idx, firmData.clearingMember, ccpAccount, admin);

            console.log('=============> Time at OM_27.1 updateFirm 2: ' + new Date().toISOString());

            console.log('=============> Time at OM_27.1 end: ' + new Date().toISOString());
        });

        test('OM_27.2 - Trader submitting an equity order from a firm which does not have a Clearing Member', async () => {

            console.log('=============> Time at OM_27.2 start: ' + new Date().toISOString());
            
            let firmData = (await admin.getFirm("Firm1")).payload;
            const clearingMember = firmData.clearingMember;

            console.log('=============> Time at OM_27.2 get firm 1: ' + new Date().toISOString());

            await updateFirm(firmData.firmId, firmData.name, firmData.status, firmData.type, firmData.ref_ver,
                firmData.ref_seq, firmData.lei, firmData.idx, null, firmData.ccpAccount, admin);

            const expectedResponse = {
                status: 'OK',
                payload: {
                    orderStatus: 'REJECTED',
                    rejectReason: 'Your CCP account details have not been set up. Please contact market operations'
                }
            };

            console.log('=============> Time at OM_27.2 updateFirm 1: ' + new Date().toISOString());

            await submitOrderAndValidateErrorResponses(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', equityMarketId, expectedResponse);

            console.log('=============> Time at OM_27.2 submitOrderAndValidateErrorResponses: ' + new Date().toISOString());

            firmData = (await admin.getFirm("Firm1")).payload;

            console.log('=============> Time at OM_27.2 get firm 2: ' + new Date().toISOString());

            await updateFirm(firmData.firmId, firmData.name, firmData.status, firmData.type, firmData.ref_ver,
                firmData.ref_seq, firmData.lei, firmData.idx, clearingMember, firmData.ccpAccount, admin);

            console.log('=============> Time at OM_27.2 updateFirm 2: ' + new Date().toISOString());

            console.log('=============> Time at OM_27.2 end: ' + new Date().toISOString());
        });

        test('OM_27.3 - Trader submitting an debt order from a firm which does not have a CCP Account', async () => {
            let firmData = (await admin.getFirm("Firm1")).payload;
            const ccpAccount = firmData.ccpAccount;

            await updateFirm(firmData.firmId, firmData.name, firmData.status, firmData.type, firmData.ref_ver,
                firmData.ref_seq, firmData.lei, firmData.idx, firmData.clearingMember, null, admin);
            const asset = (await admin.getInstrument(debtSymbol)).payload;
            await submitOrderAndValidateSuccessResponses(debtSymbol, debtTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', asset.quantityScale, asset.priceScale, debtMarketId);

            firmData = (await admin.getFirm("Firm1")).payload;
            await updateFirm(firmData.firmId, firmData.name, firmData.status, firmData.type, firmData.ref_ver,
                firmData.ref_seq, firmData.lei, firmData.idx, firmData.clearingMember, ccpAccount, admin);
        });

        test('OM_27.4 - Trader submitting an debt order from a firm which does not have a Clearing Member', async () => {
            let firmData = (await admin.getFirm("Firm1")).payload;
            const clearingMember = firmData.clearingMember;

            await updateFirm(firmData.firmId, firmData.name, firmData.status, firmData.type, firmData.ref_ver,
                firmData.ref_seq, firmData.lei, firmData.idx, null, firmData.ccpAccount, admin);
            const asset = (await admin.getInstrument(debtSymbol)).payload;
            await submitOrderAndValidateSuccessResponses(debtSymbol, debtTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', asset.quantityScale, asset.priceScale, debtMarketId);

            firmData = (await admin.getFirm("Firm1")).payload;
            await updateFirm(firmData.firmId, firmData.name, firmData.status, firmData.type, firmData.ref_ver,
                firmData.ref_seq, firmData.lei, firmData.idx, clearingMember, firmData.ccpAccount, admin);
        });

        test('OM_27.5 - Trader successfully submitting an equity order from a firm which has both Clearing Member and CCP Account', async () => {
            const asset = (await admin.getInstrument(debtSymbol)).payload;
            await submitOrderAndValidateSuccessResponses(equitySymbol, equityTrader, buySide, '10.00', '1000', 'GTC', 'DEAL', asset.quantityScale, asset.priceScale, equityMarketId);
        });
    });
});