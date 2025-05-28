const { equals, delay } = require('@yaalalabs/p8-e2e-api-framework');
const {v4: uuidv4} = require("uuid");
function createOrderUpdatePayload(buy, sell) {
    return {
        payload: {
            buy: buy,
            sell: sell,
            instrumentSession: "OPEN",
        },
        type: "data",
    };
}

function createInstrumentSessionPayload(symbol, marketId) {
    return {
        payload: {
            symbol: symbol,
            marketId: marketId,
            publish: true,
            instrumentSession: "OPEN",
        },
        type: "data",
    };
}

function createExecutionReportPayload(order, traderUsername, execType, orderStatus, quantityScale, priceScale, tradeQty=undefined) {
    return {
        payload: {
            intStatus: 200,
            clOrderId: order.clOrderId,
            execType: execType,
            price: parseFloat(order.price).toFixed(priceScale),
            orderQty: parseFloat(order.orderQty).toFixed(quantityScale),
            stopPrice: parseFloat(0).toFixed(priceScale),
            leavesQty: parseFloat(execType === "TRADE" ? orderStatus === 'PFILLED' ? (order.orderQty - tradeQty) : 0 : order.orderQty).toFixed(quantityScale),
            averagePrice: parseFloat(execType === "TRADE" ? order.price : 0).toFixed(priceScale),
            cumExecSize: parseFloat(execType === "TRADE" ? tradeQty ?? order.orderQty : 0).toFixed(quantityScale),
            orderStatus: orderStatus,
            tif: order.tif,
            orderType: order.orderType,
            side: order.side,
            userId: order.userId,
            marketId: order.marketId,
            marketType: "SPOT",
            symbol: order.symbol,
            requestUserId: traderUsername,
            balanceAllocation: (parseFloat(0)).toFixed(8),
            feeAllocation: (parseFloat(0)).toFixed(8),
            positionUpdates: [],
        },
        type: "EXEC_REPORT",
    };
}

function createOrderExpectedRes(orderRequest, quantityScale, priceScale, traderUsername) {
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

function createOrderReq(symbol, trader, side, price, quantity, tif, orderCapacity, marketId) {
    return {
        orderType: "LMT",
        side: side,
        price: price,
        orderQty: quantity,
        tif: tif,
        symbol: symbol,
        orderCapacity: orderCapacity,
        marketId: marketId,
        clOrderId: trader.nextId(),
        userId: trader.getUsername(),
    };
}

async function submitOrder(symbol, trader, side, price, quantity, tif, orderCapacity, quantityScale, priceScale, marketId) {
    const orderRequest = createOrderReq(symbol, trader, side, price, quantity, tif, orderCapacity, marketId);
    const actualResponse = await trader.submitOrder(orderRequest);

    // validate responses
    await equals(createOrderExpectedRes(orderRequest, quantityScale, priceScale, trader.getUsername()), actualResponse);
    await trader.expect([createExecutionReportPayload(orderRequest, trader.getUsername(), "NEW", "NEW", quantityScale, priceScale)]);
    console.log("Order Submitted ", symbol, actualResponse.orderId);
}

async function submitOrderAndValidateSuccessResponses(symbol, trader, side, price, quantity, tif, orderCapacity, quantityScale, priceScale, marketId) {
    const orderRequest = createOrderReq(symbol, trader, side, price, quantity, tif, orderCapacity, marketId);
    const actualResponse = await trader.submitOrder(orderRequest);

    // validate responses
    await equals(createOrderExpectedRes(orderRequest, quantityScale, priceScale, trader.getUsername()), actualResponse);
    await trader.expect([
        createOrderUpdatePayload([
            {
                size: parseFloat(orderRequest.orderQty).toFixed(quantityScale),
                price: parseFloat(orderRequest.price).toFixed(priceScale),
            }], []),
        createInstrumentSessionPayload(symbol, marketId),
        createExecutionReportPayload(orderRequest, trader.getUsername(), "NEW", "NEW", quantityScale, priceScale)
    ]);
}

async function submitOrderAndValidateErrorResponses(symbol, trader, side, price, quantity, tif, orderCapacity, marketId, rejectReason) {
    const orderRequest = createOrderReq(symbol, trader, side, price, quantity, tif, orderCapacity, marketId);
    const actualResponse = await trader.submitOrder(orderRequest);

    // validate responses
    await equals(rejectReason, actualResponse);
}

async function cancelExistingOrdersBySymbol(symbol, marketId, admin, waitUntilCancel = true) {
    await admin.sendMassCancel({
        requestId: uuidv4(),
        marketId: marketId,
        symbol: symbol,
        reason: "e2eTest",
    });

    if (waitUntilCancel) {
        await waitUntilOrderCancel(admin);
    }
}

async function cancelExistingOrdersByFirm(admin, firmId, markets, waitUntilCancel = true) {
    if (Array.isArray(markets)) {
        for (const marketId of markets) {
            await admin.sendMassCancel({
                requestId: uuidv4(),
                firmId: firmId,
                marketId: marketId,
                reason: "e2eTest",
            });
        }
    } else {
        await admin.sendMassCancel({
            requestId: uuidv4(),
            firmId: firmId,
            marketId: markets,
            reason: "e2eTest",
        });
    }
    if (waitUntilCancel) {
        await waitUntilOrderCancel(admin, markets);
    }
}

async function waitUntilOrderCancel(admin, markets) {
    // Poll until orders to be cancelled or timeout after 30 seconds
    const timeout = Date.now() + 30000;
    let hasActiveOrders = true;
    const isRelevantMarket = order => Array.isArray(markets) ? markets.includes(order.marketId) : order.marketId === markets;

    while ((Date.now() < timeout) && hasActiveOrders) {
        console.log("waiting until order mass cancel ...");
        let activeOrders = (await admin.queryOrders(getOrderQuery())).filter(isRelevantMarket);
        hasActiveOrders = activeOrders.length !== 0;
        if (hasActiveOrders) await delay(1000);
    }

    if (hasActiveOrders) {
        throw new Error(`Timed out waiting for admin order cancel`);
    }
    console.log("Order mass cancel is succeeded ...");
}

function getOrderQuery(trader, page, limit) {
    return {
        "includeActive": true,
        "includeInactive": false,
        "queryFilter": {"marketType": "SPOT"},
        "page": page ?? 1,
        "limit": limit ?? 25
    };
}

module.exports = {
    createOrderUpdatePayload,
    createInstrumentSessionPayload,
    createExecutionReportPayload,
    createOrderExpectedRes,
    createOrderReq,
    cancelExistingOrdersBySymbol,
    cancelExistingOrdersByFirm,
    submitOrder,
    submitOrderAndValidateSuccessResponses,
    submitOrderAndValidateErrorResponses
};