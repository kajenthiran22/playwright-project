import { AxiosError, AxiosResponse } from 'axios';
import { getReferenceData, getTraderApiEndPoint, getTraderApiUrl, updateReferenceData, UrlParams } from './configuration';
import { RestClient } from './rest-client';
import { Session, SessionType } from './session';
import { WebSocket } from './web-socket';
import { v4 as uuidv4 } from 'uuid';
import chai from 'chai';


const debugL3 = require('debug')('fw-L3-trader-session');
const debugL2 = require('debug')('fw-L2-trader-session');
const debugL1 = require('debug')('fw-L1-trader-session');

export class TraderSession extends Session {

    protected err: AxiosError;
    protected client: RestClient;
    protected socket: WebSocket;
    protected orders: any[];
    protected quotes: any[];
    protected id: number;
    protected firmId?: string;

    public constructor(id: string, firmId?: string) {
        super(id, SessionType.trader);
        this.id = 0;
        if (firmId) {
            this.firmId = firmId;
        }
    }

    public async start(marketId: string, symbol: string, options?: any, enableQuoteBookSubscription?: boolean) {
        debugL1(" start", marketId, symbol, options)

        await super.login();

        this.client = new RestClient(this);
        this.socket = new WebSocket(this, options);
        await this.socket.connect();

        //this.socket.subscribeForHeartbeats();
        let request = this.socket.subscribeForTrades(marketId, symbol);
        let response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);
        await this.socket.expect({
            id: "trade.4",
            type: 'initial_data'
        });

        request = this.socket.subscribeForOrderBook(marketId, symbol);
        response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);
        await this.socket.expect({
            id: "orderbook.5",
            type: 'initial_data'
        });

        if (enableQuoteBookSubscription == null || enableQuoteBookSubscription) {
            request = this.socket.subscribeForQuoteBook(marketId, symbol);
            response = JSON.parse(JSON.stringify(request));
            response['status'] = 'OK';
            await this.socket.expect(response);
            // await this.socket.expect({
            //     id: 'quoteBook.5',
            //     type: 'data'
            // });
        }

        request = this.socket.subscribeForMDStat(marketId, symbol);
        response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);
        await this.socket.expect({
            id: response.id,
            type: 'initial_data'
        });

        request = this.socket.subscribeForOrders();
        response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);

        request = this.socket.subscribeForPositions();
        response = JSON.parse(JSON.stringify(request));
        // response['status'] = 'OK';
        await this.socket.expect(response);

        request = this.socket.subscribeForNegotiations();
        response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);

        request = this.socket.subscribeForRFQ();
        response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);

        request = this.socket.subscribeForRegistryTransaction();
        response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);

        if (this.firmId != null) {
            request = this.socket.subscribeForTradeCaptures(this.firmId);
            response = JSON.parse(JSON.stringify(request));
            response['status'] = 'OK';
            await this.socket.expect(response);
        }

        request = await this.socket.subscribeForNotification();
        response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);

        request = await this.socket.subscribeForUserPosition();
        response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);


        debugL1("------------- subscription success-------------------------")
        this.socket.clear();
        this.orders = [];
        this.quotes = [];
        this.socket.startHeartbeat();
    }

    public unsubscribeForOrderBook(marketId, symbol) {
        this.socket.unsubscribeForOrderBook(marketId, symbol);
    }

    public async unsubscribeForQuoteBook(marketId, symbol) {
        this.socket.unsubscribeForQuoteBook(marketId, symbol);
    }

    public unsubscribeForPositions(userId) {
        this.socket.unsubscribeForPositions(userId);
    }

    public unsubscribeForMDStat(marketId, symbol) {
        this.socket.unsubscribeForMDStat(marketId, symbol);
    }

    public unsubscribeForTrades(marketId, symbol) {
    this.socket.unsubscribeForTrades(marketId, symbol);
    }

    public subscribeForAllMdStats(marketIds) {
        this.socket.subscribeForAllMdStats(marketIds);
    }

    public unsubscribeForAllMdStats(marketIds) {
        this.socket.unsubscribeForAllMdStats(marketIds);
    }

    public async subscribeForNotifications(options?: any) {
        debugL1(" subscribeForNotifications", options)
        await super.login();

        this.client = new RestClient(this);

        this.socket = new WebSocket(this, options);
        await this.socket.connect();

        //this.socket.subscribeForHeartbeats();

        let request = await this.socket.subscribeForNotification();
        let response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);

        debugL1("------------- subscription success-------------------------")
        this.socket.clear();
        this.orders = [];
        this.quotes = [];
        this.socket.startHeartbeat();
    }

    public async subscribeForAuctions(options?: any) {


        let request = this.socket.subscribeForAuctions();
        let response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);

        debugL1("------------- subscription success-------------------------")
        this.socket.clear();
        this.orders = [];
        this.quotes = [];
    }

    public async subscribeForChats(options?: any) {


        let request = this.socket.subscribeForUserChats();
        let response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);

        debugL1("------------- subscription success-------------------------")
        this.socket.clear();
    }

    public async lazyStart() {
        await super.login();

        this.client = new RestClient(this);

        this.socket = new WebSocket(this);
        await this.socket.connect();

        this.orders = [];
        this.quotes = [];
        this.socket.startHeartbeat();
    }

    public async stop() {
        debugL1("* Logging out - ", this.getUsername())
        await this.cancelAllOrders();

        if (this.socket) {
            await this.socket.clearHearbeatSub();
            await this.socket.disconnect();
        }

        await this.logout();
    }

    public clear(): any[] {
        return this.socket.clear();
    }

    public async expect(message: any, timeout: any = 0, splice: boolean = true) {
        if (this.socket.connected() == false) {
            debugL1("socket disconnected. expect will fail")
            chai.expect.fail('socket disconnected');
        }
        return await this.socket.expect(message, timeout, splice);
        // try{
        //     let result = await this.socket.expect(message);
        //     return result;
        // } catch (err) {
        //     debugL1("expect failed", err)
        //     return null;
        // }
    }

    public nextId() {
        const now = new Date();
        return 'teste2e-' + this.getUsername() + '-' + now.getTime() + '-' + this.id++;
    }

    public getOrder(clOrderId: string) {
        for (let i = 0; i < this.orders.length; i++) {
            if (this.orders[i].clOrderId == clOrderId) {
                return this.orders[i];
            }
        }

        return null;
    }

    private async postWithValidate(id: string, message: any, validateResponse: boolean = false) {
        this.err = null;
        let result = await this.client.post<any>(getTraderApiUrl(id), message)
            .then((result: AxiosResponse<any>) => {
                debugL3('response:\n' + JSON.stringify(result.data));
                return result;
            })
            .catch((err: AxiosError) => {
                debugL1('error:\n' + JSON.stringify(err.response.data));
                this.err = err;
                return err.response;
            });

        if ((validateResponse) && (this.err != null))
            this.validateResponse(result, 'post', getTraderApiEndPoint(id));

        return result.data;
    }

    private async putWithValidate(id: string, message: any, validateResponse: boolean = false, params?: UrlParams) {
        this.err = null;
        let result = await this.client.put<any>(getTraderApiUrl(id, params), message)
            .then((result: AxiosResponse<any>) => {
                debugL3('response:\n' + JSON.stringify(result.data));
                return result;
            })
            .catch((err: AxiosError) => {
                debugL3('Error: ', err);
                debugL1('error: (' + err.response?.status + ')\n' + JSON.stringify(err.response?.data));
                this.err = err;
                return err.response;
            });

        if ((validateResponse) && (this.err != null))
            this.validateResponse(result, 'put', getTraderApiEndPoint(id));

        return result.data;
    }

    private async getWithValidate(id: string, params?: UrlParams, validateResponse: boolean = false) {
        this.err = null;
        let result = await this.client.get<any>(getTraderApiUrl(id, params))
            .then((result: AxiosResponse<any>) => {
                debugL3('response:\n' + JSON.stringify(result.data));
                return result;
            })
            .catch((err: AxiosError) => {
                debugL1('error: (' + err.response.status + ')\n' + JSON.stringify(err.response.data));
                this.err = err;
                return err.response;
            });

        if ((validateResponse) && (this.err != null))
            this.validateResponse(result, 'get', getTraderApiEndPoint(id));

        return result.data;
    }

    private async deleteWithValidate(id: string, message: any, validateResponse: boolean = false) {
        this.err = null;
        let result = await this.client.delete<any>(getTraderApiUrl(id), message)
            .then((result: AxiosResponse<any>) => {
                debugL3('response:\n' + JSON.stringify(result.data));
                return result;
            })
            .catch((err: AxiosError) => {
                debugL1('error:\n' + JSON.stringify(err.response.data));
                this.err = err;
                return err.response;
            });

        if ((validateResponse) && (this.err != null))
            this.validateResponse(result, 'delete', getTraderApiEndPoint(id));

        return result.data;
    }

    public async submitOrder(order: any, validateResponse: boolean = false) {
        order.requestId = this.nextId();
        debugL2('submitting order ' + JSON.stringify(order));

        let result = await this.postWithValidate("/spot/v1/order", order, validateResponse);
        if (result.payload && result.payload.orderId) {
            debugL2('caching order ' + result.payload.orderId);
            this.orders.push(result.payload);
        }

        return result;
    }

    public async modifyOrder(order: any, validateResponse: boolean = false) {
        debugL2('modifying order ' + JSON.stringify(order));

        let result = await this.putWithValidate("/spot/v1/order", order, validateResponse);
        if (result.payload && result.payload.orderId) {
            debugL2('caching order ' + result.payload.orderId);
            this.orders.push(result.payload);
        }
        return result;
    }

    public async cancelOrder(order: any, validateResponse: boolean = false) {
        order.requestUserId = this.getUsername();
        order.requestId = this.nextId();
        debugL2('cancelling order ' + JSON.stringify(order));

        let result = await this.deleteWithValidate("/spot/v1/order", order, validateResponse);
        if (result.status == 'OK' && result.payload && result.payload.orderId) {
            debugL2('removing order ' + result.payload.orderId);
            this.removeOrder(result.payload.orderId);
        }
        return result;
    }

    public async queryOrders(query: any, validateResponse: boolean = false) {
        debugL2('querying orders ' + JSON.stringify(query));

        let result = await this.postWithValidate("/order/v1/query/", query, validateResponse);
        return result.payload;
    }

    public async cancelAllOrders() {
        debugL1('cancelling all orders for ' + this.getUsername());
        for (let i = 0; i < this.orders.length; i++) {
            await this.cancelOrder({
                userId: this.getUsername(),
                orderId: this.orders[i].orderId,
                clOrderId: this.nextId(),
                symbol: this.orders[i].symbol,
                marketId: this.orders[i].marketId
            });
        }

        this.orders = [];
    }

    public async sendMassCancelRequest(massCancel: any, validateResponse: boolean = false) {
        debugL1('mass cancel ' + massCancel);

        let result = await this.postWithValidate("/order/v1/mass-cancel", massCancel, validateResponse);
        return result;
    }

    public async sleep(timeout: number) {
        return new Promise((resolve: any, reject: any) => {
            setTimeout(function () {
                return resolve('Ok');
            }, timeout);
        });
    }

    public clearOrders(filter: any) {
        let len = this.orders.length;
        while (len--) {
            const order = this.orders[len]
            if (this.isMatch(order, filter)) {
                this.orders.splice(len, 1)
            }
        }
    }

    public removeOrder(orderId: string) {
        let removedOrder: any = undefined;
        for (let i = 0; i < this.orders.length; i++) {
            if (this.orders[i].orderId == orderId) {
                removedOrder = this.orders[i];
                this.orders.splice(i, 1)
            }
        }

        return removedOrder;
    }

    public sendHB() {
        this.socket.subscribeForHeartbeats();
    }

    private isMatch(order: any, filter: any): boolean {
        for (let key in filter) {
            if (filter[key] != order[key]) {
                return false;
            }
        }
        return true;
    }

    public async submitFuturesOrder(order: any, validateResponse: boolean = false) {
        order.requestId = this.nextId();
        debugL2('submitting futures-order ' + JSON.stringify(order));

        let result = await this.postWithValidate("/futures/v1/order", order, validateResponse);
        if (result.payload && result.payload.orderId) {
            debugL2('caching order ' + result.payload.orderId);
            this.orders.push(result.payload);
        }

        return result;
    }

    public async cancelFuturesOrder(order: any, validateResponse: boolean = false) {
        order.requestUserId = this.getUsername();
        order.requestId = this.nextId();
        debugL2('cancelling futures order ' + JSON.stringify(order));

        let result = await this.deleteWithValidate("/futures/v1/order", order, validateResponse);
        return result;
    }

    public async transfer(fromAccount: string, toAccount: string, symbol: string, amount: string, validateResponse: boolean = false) {
        debugL2('transfer funds ');

        const transferRequest = {
            requestId: uuidv4(),
            sendingAccountId: fromAccount,
            receivingAccountId: toAccount,
            symbol: symbol,
            amount: amount
        }

        let result = await this.postWithValidate("/position/v1/transfer", transferRequest, validateResponse);
        return result;
    }

    public async redeemTokens(firmId: string, symbol: string, amount: string, validateResponse: boolean = false) {
        debugL2('trader token redemption');

        const request = {
            requestId: uuidv4(),
            firmId,
            symbol,
            amount
        }

        let result = await this.postWithValidate("token-redeem", request, validateResponse);
        return result;
    }

    public async withdrawFromWallet(accountId: string, externalAccountAddress: string, symbol: string, networkId: string, amount: string, validateResponse: boolean = false) {
        debugL2('trader withdrawal');

        const withdrawalRequest = {
            requestId: uuidv4(),
            accountId,
            externalAccountAddress,
            symbol,
            networkId,
            amount
        }

        let result = await this.postWithValidate("/position/v1/wallet/withdraw", withdrawalRequest, validateResponse);
        return result;
    }

    public async createDepositAddress(accountId: string, symbol: string, networkId: string, validateResponse: boolean = false) {
        debugL2('create deposit address');

        const depositAddressRequest = {
            accountId,
            symbol,
            networkId
        }

        let result = await this.postWithValidate("/position/v1/wallet/address", depositAddressRequest, validateResponse);
        return result;
    }

    public async estimateFees(symbol: string, networkId: string, validateResponse: boolean = false) {
        debugL2('estimate fees');

        const depositAddressRequest = {
            symbol,
            networkId
        }

        let result = await this.postWithValidate("/position/v1/wallet/fee-estimation", depositAddressRequest, validateResponse);
        return result;
    }

    public async getBalances(validateResponse: boolean = false) {
        debugL2('get balances ');

        let result = await this.getWithValidate("/position/v1/balance/{accountId}", undefined, validateResponse);
        return result;
    }

    public async getNotifications(validateResponse: boolean = false) {
        debugL2('get notifications');

        let result = await this.getWithValidate("/notification/v1", undefined, validateResponse);
        return result;
    }

    public async setMarginMode(marginMode: any, validateResponse: boolean = false) {
        marginMode.requestUserId = this.getUsername();
        marginMode.requestId = uuidv4();

        debugL2('setting futures margin mode ' + JSON.stringify(marginMode));

        let result = await this.postWithValidate("/futures/v1/margin-mode", marginMode, validateResponse);
        return result;
    }

    public async setLeverage(leverage: any, validateResponse: boolean = false) {
        // leverage.requestUserId = this.getUsername();
        // leverage.requestId = uuidv4();

        debugL2('setting leverage' + JSON.stringify(leverage));

        let result = await this.postWithValidate("/futures/v1/leverage", leverage, validateResponse);
        return result;
    }

    public async submitQuote(quote: any, validateResponse: boolean = false) {
        quote.requestId = this.nextId();
        debugL2('submitting quote ' + JSON.stringify(quote));

        let result = await this.postWithValidate("/indication/v1/", quote, validateResponse);
        if (result.payload && result.payload.quoteId) {
            debugL2('caching quote ' + result.payload.quoteId);
            this.quotes.push(result.payload);
        }

        return result;
    }

    public async cancelQuote(quoteCancel: any, validateResponse: boolean = false) {
        quoteCancel.requestId = this.nextId();
        debugL2('submitting quote cancel' + JSON.stringify(quoteCancel));

        let result = await this.deleteWithValidate("/indication/v1/", quoteCancel, validateResponse);
        return result;
    }

    public async createNegotiation(negotiationRequest: any, validateResponse: boolean = false) {
        negotiationRequest.requestId = this.nextId();
        debugL2('submitting negotiation request ' + JSON.stringify(negotiationRequest));

        let result = await this.postWithValidate("/negotiation/v1", negotiationRequest, validateResponse);
        return result;
    }

    public async counterNegotiation(negotiationRequest: any, validateResponse: boolean = false) {
        negotiationRequest.requestId = this.nextId();
        debugL2('submitting counter negotiation request ' + JSON.stringify(negotiationRequest));

        let result = await this.postWithValidate("/negotiation/v1/counter", negotiationRequest, validateResponse);
        return result;
    }

    public async acceptNegotiation(negotiationRequest: any, validateResponse: boolean = false) {
        negotiationRequest.requestId = this.nextId();
        debugL2('submitting accept negotiation request ' + JSON.stringify(negotiationRequest));

        let result = await this.postWithValidate("/negotiation/v1/accept", negotiationRequest, validateResponse);
        return result;
    }

    public async confirmNegotiation(negotiationRequest: any, validateResponse: boolean = false) {
        negotiationRequest.requestId = this.nextId();
        debugL2('submitting confirm negotiation request ' + JSON.stringify(negotiationRequest));

        let result = await this.postWithValidate("/negotiation/v1/confirm", negotiationRequest, validateResponse);
        return result;
    }

    public async approveNegotiation(negotiationRequest: any, validateResponse: boolean = false) {
        negotiationRequest.requestId = this.nextId();
        debugL2('submitting approve negotiation request ' + JSON.stringify(negotiationRequest));

        let result = await this.postWithValidate("negotiation-approve", negotiationRequest, validateResponse);
        return result;
    }

    public async rejectNegotiation(negotiationRequest: any, validateResponse: boolean = false) {
        negotiationRequest.requestId = this.nextId();
        debugL2('submitting reject negotiation request ' + JSON.stringify(negotiationRequest));

        let result = await this.postWithValidate("/negotiation/v1/reject", negotiationRequest, validateResponse);
        return result;
    }

    public async cancelNegotiation(negotiationCancel: any, validateResponse: boolean = false) {
        negotiationCancel.requestId = this.nextId();
        debugL2('submitting negotiation cancel ' + JSON.stringify(negotiationCancel));

        let result = await this.deleteWithValidate("/negotiation/v1", negotiationCancel, validateResponse);
        return result;
    }

    public async createRFQ(rfqRequest: any, validateResponse: boolean = false) {
        rfqRequest.requestId = this.nextId();
        debugL2('submitting create rfq request ' + JSON.stringify(rfqRequest));

        let result = await this.postWithValidate("/rfq/v1", rfqRequest, validateResponse);
        return result;
    }

    public async createRFQBulkRequest(rfqRequestArray: any[], messageType: string = "RFQ_CREATE_REQUEST", validateResponse: boolean = false) {
        const bulkRequest = { "messageType": messageType, "payload": [] };

        for (var rfqRequest of rfqRequestArray) {
            rfqRequest.requestId = this.nextId();
        }
        bulkRequest.payload = rfqRequestArray;

        debugL2('submitting rfq  bulk request ' + JSON.stringify(bulkRequest));

        let result = await this.postWithValidate("/rfq/v1/bulk", bulkRequest, validateResponse);
        return result;
    }

    public async createRFQBulkResponse(rfqResponseArray: any[], validateResponse: boolean = false) {
        const bulkRequest = { "messageType": "RFQ_RESPOND_REQUEST", "payload": [] };
        for (var rfqRequest of rfqResponseArray) {
            rfqRequest.requestId = this.nextId();
        }
        bulkRequest.payload = rfqResponseArray;

        debugL2('submitting rfq  bulk response ' + JSON.stringify(bulkRequest));

        let result = await this.postWithValidate("/rfq/v1/bulk", bulkRequest, validateResponse);
        return result;
    }


    public async respondRFQ(rfqResponse: any, validateResponse: boolean = false) {
        rfqResponse.requestId = this.nextId();
        debugL2('submitting rfq response ' + JSON.stringify(rfqResponse));

        let result = await this.postWithValidate("/rfq/v1/response/respond", rfqResponse, validateResponse);
        return result;
    }


    public async acceptRFQ(rfqAccept: any, validateResponse: boolean = false) {
        rfqAccept.requestId = this.nextId();
        debugL2('submitting rfq accept ' + JSON.stringify(rfqAccept));

        let result = await this.postWithValidate("/rfq/v1/trade", rfqAccept, validateResponse);
        return result;
    }

    public async cancelTrade(requestBody: any, validateResponse: boolean = false) {
        requestBody.requestId = this.nextId();
        debugL2('submitting cancel trade ' + JSON.stringify(requestBody));

        let result = await this.deleteWithValidate("/trade/v1/trade-report", requestBody, validateResponse);
        return result;
    }

    public async cancelBlockTrade(requestBody: any, validateResponse: boolean = false) {
        requestBody.requestId = this.getUsername()+"_"+uuidv4();
        debugL2('submitting cancel block trade ' + JSON.stringify(requestBody));
        let result = await this.deleteWithValidate("/trade/v1/trade-capture-report", requestBody, validateResponse);
        return result;
    }

    public async cancelRFQ(rfqCancel: any, validateResponse: boolean = false) {
        rfqCancel.requestId = this.nextId();
        debugL2('submitting rfq cancel ' + JSON.stringify(rfqCancel));

        let result = await this.deleteWithValidate("/rfq/v1", rfqCancel, validateResponse);
        return result;
    }
    public async interestCalculation(calculationRequest: any, validateResponse: boolean = false) {
        calculationRequest.requestId = this.nextId();
        debugL2('submitting interest calculation request ' + JSON.stringify(calculationRequest));
        return await this.postWithValidate("/trade/v1/interest-calculation", calculationRequest, validateResponse);
    }

    public async dealSplit(dealSplitRequest: any, validateResponse: boolean = false) {
        dealSplitRequest.requestId = this.nextId();
        debugL2('submitting deal split request ' + JSON.stringify(dealSplitRequest));

        let result = await this.postWithValidate("/rfq/v1/deal-split", dealSplitRequest, validateResponse);
        return result;
    }

    public async portfolioHoldingsQuery(queryParams: any, validateResponse: boolean = false) {
        debugL2("portfolioHoldingsQuery with query params: " + JSON.stringify(queryParams));

        const params: UrlParams = {
            queryParams: queryParams,
        };
        return await this.getWithValidate("/portfolio/v1/holding", params, validateResponse);
    }

    public async portfolioIssuancesQuery(queryParams: any, validateResponse: boolean = false) {
        debugL2("portfolioIssuancesQuery with query params: " + JSON.stringify(queryParams));

        const params: UrlParams = {
            queryParams: queryParams,
        };
        return await this.getWithValidate("/portfolio/v1/issuance", params, validateResponse);
    }

    // Created this new function
    public async cancelExistingRFQs() {
        const queriedRfqs = await this.queryRFQ();
        if (queriedRfqs.payload?.rfqs?.length > 0) {
            for (let i = 0; i < queriedRfqs.payload.rfqs.length; i++) {
                if (queriedRfqs.payload.rfqs[i].state == "NEW") {
                    await this.cancelRFQ({
                        symbol: queriedRfqs.payload.rfqs[i].symbol,
                        rfqId: queriedRfqs.payload.rfqs[i].rfqId,
                    });
                }
            }
        } else {
            debugL3("No RFQs found or payload is undefined");
        }
    }

    public async createChat(chatRequest: any, validateResponse: boolean = false) {
        chatRequest.requestId = this.nextId();
        debugL2('submitting chat request ' + JSON.stringify(chatRequest));

        let result = await this.postWithValidate("/chat/v1", chatRequest, validateResponse);
        return result;
    }

    public async queryChats(chatQueryRequest: any, validateResponse: boolean = false) { //TODO:rename function
        chatQueryRequest.requestId = this.nextId();
        debugL2('submitting chat request ' + JSON.stringify(chatQueryRequest));
        return await this.postWithValidate("/chat/v1/chats", chatQueryRequest, validateResponse);
    }

    public async reAskRFQ(reAskRFQRequest: any, validateResponse: boolean = false) {
        reAskRFQRequest.requestId = this.nextId();
        debugL2('submitting reask request ' + JSON.stringify(reAskRFQRequest));
        return await this.postWithValidate("/rfq/v1/refresh", reAskRFQRequest, validateResponse);
    }


    public async unsubscribe() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    public async performSingleSearch(search) {
        debugL2('DOB Single search ' + JSON.stringify(search));
        let result = await this.client
            .post<any>(getTraderApiUrl('single-search'), search)
            .then((result: AxiosResponse<any>) => {
                debugL2('response:\n' + JSON.stringify(result.data));
                return result;
            })
            .catch((err: any) => {
                debugL2('error:\n' + JSON.stringify(err.response.data));
                return err.response.data;
            });

        return result;
    }

    public async performHighlevelSearch(search) {
        debugL2('DOB Highlevel search ' + JSON.stringify(search));
        let result = await this.client
            .post<any>(getTraderApiUrl('/dob/search/highlevel'), search)
            .then((result: AxiosResponse<any>) => {
                debugL2('response:\n' + JSON.stringify(result.data));
                return result;
            })
            .catch((err: any) => {
                debugL2('error:\n' + JSON.stringify(err.response.data));
                return err.response.data;
            });

        return result;
    }

    public async performDynamicSearch(search) {
        debugL2('DOB Dynamic search ' + JSON.stringify(search));
        let result = await this.client
            .post<any>(getTraderApiUrl('/dob/search/dynamic'), search)
            .then((result: AxiosResponse<any>) => {
                debugL2('response:\n' + JSON.stringify(result.data));
                return result;
            })
            .catch((err: any) => {
                debugL2('error:\n' + JSON.stringify(err.response.data));
                return err.response.data;
            });

        return result;
    }

    public async validateSearchSocketMessage(message: any, key?: string) {
        let Response = await this.socket.compare(message, key).catch((err) => {
            debugL2('socket message error \n', err);
            return { isValid: false, socketRes: err };
        });
        return Response;
    }

    public async submitOffBookTrade(trade: any, validateResponse: boolean = false) {
        trade.requestId = this.nextId();
        debugL2('submitting off-book trade as TCR' + JSON.stringify(trade));
        let result = await this.postWithValidate("/trade/v1/trade-capture-report", trade, validateResponse);
        return result;
    }

    public async submitBlockTrade(trade: any, validateResponse: boolean = false) {
        trade.requestId = this.getUsername()+"_"+uuidv4();
        debugL2('submitting Block trade ' + JSON.stringify(trade));
        let result = await this.postWithValidate("/trade/v1/block-trade", trade, validateResponse);
        return result;
    }

    

    public async cancelOffBookTrade(trade: any, validateResponse: boolean = false) {
        trade.requestUserId = this.getUsername();
        trade.requestId = this.nextId();
        debugL2('cancelling off-book trade ' + JSON.stringify(trade));

        let result = await this.deleteWithValidate("/trade/v1/trade-capture-report", trade, validateResponse);
        return result;
    }

    public async submitOtcTrade(trade: any, validateResponse: boolean = false) {
        trade.requestId = this.nextId();
        debugL2('submitting OTC trade' + JSON.stringify(trade));
        let result = await this.postWithValidate("/trade/v1/trade-submit", trade, validateResponse);
        return result;
    }

    public async transferTokenSelfCare(assetId: any, request: any, validateResponse: boolean = false) {
        debugL2(`transfer self care trader tokens with body: ${JSON.stringify(request)}`);

        const params: UrlParams = {
            pathParams: {
                assetId
            }
        }

        return await this.putWithValidate("/corda/v1/asset/{assetId}/transfer", request, validateResponse, params);
    }

    public async withdrawTokenSelfCare(assetId: any, request: any, validateResponse: boolean = false) {
        debugL2(`withdraw self care trader tokens with body: ${JSON.stringify(request)}`);

        const params: UrlParams = {
            pathParams: {
                assetId
            }
        }

        return await this.putWithValidate("/corda/v1/asset/{assetId}/withdraw", request, validateResponse, params);
    }

    public async redeemTokenSelfCare(assetId: any, request: any, validateResponse: boolean = false) {
        debugL2(`redeem tokens with body: ${JSON.stringify(request)}`);

        const params: UrlParams = {
            pathParams: {
                assetId
            }
        }

        return await this.putWithValidate("/corda/v1/asset/{assetId}/redeem", request, validateResponse, params);
    }

    public async assetQuerySelfCare(assetId: any, validateResponse: boolean = false) {
        debugL2("get self care asset query balance.");

        const params: UrlParams = {
            pathParams: {
                assetId
            }
        }

        return await this.getWithValidate("/corda/v1/asset/{assetId}", params, validateResponse);
    }

    public async assetsQuerySelfCare(validateResponse: boolean = false) {
        debugL2("get self care assets query balances.");

        return await this.getWithValidate("/corda/v1/assets", null, validateResponse);
    }

    // Query the existing RFQs
    public async queryRFQ(validateResponse: boolean = false) { //TODO:rename function
        debugL1("get exisiting RFQs.");
        return await this.getWithValidate("/rfq/v1/rfqs", null, validateResponse);
    }

    public async queryRFQHistory(request: any, validateResponse: boolean = false) {
        debugL1("get RFQ history.");
        return await this.postWithValidate("/rfq/v1/queryInitiationRecords", request, validateResponse);
    }

    public async queryRFQResponseHistory(request: any, validateResponse: boolean = false) {
        debugL1("get RFQ response history.");
        return await this.postWithValidate("/rfq/v1/queryLatestResponseHistory", request, validateResponse);
    }

    public async transactionsQuerySelfCare(validateResponse: boolean = false) {
        debugL2("get self care transactions.");

        return await this.getWithValidate("/corda/v1/transactions", null, validateResponse);
    }

    public async getPositions(firmId: string, validateResponse: boolean = false) {
        debugL2(`submit ${firmId} positions request.`);

        const request = {
            firmId
        }

        let result = await this.postWithValidate("/position/v1/query", request, validateResponse);
        return result;
    }

    public async updateIndicativeRates(rateTableId: any, request: any) {
        debugL2('update user indicativeRate=' + rateTableId + ', request=' + JSON.stringify(request));
        return updateReferenceData('/refdata/v1/rates-tables/', rateTableId, request, this.client);
    }

    public async getIndicativeRates(rateTableId: any, request: any) {
        debugL2('get user indicativeRate=' + rateTableId + ', request=' + JSON.stringify(request));
        return await getReferenceData('/refdata/v1/rates-tables/', rateTableId, this.client);
    }

    public async tradeRequest(tradeRequest: any, validateResponse: boolean = false) {
        tradeRequest.requestId = this.nextId();
        debugL2('trade request ' + JSON.stringify(tradeRequest));

        let result = await this.postWithValidate("/indication/v1/trade", tradeRequest, validateResponse);
        return result;
    }

    public async createQuoteBulkRequest(requestId: string, quoteRequestArray: any[], validateResponse: boolean = false) {
        const bulkRequest = { "requestId": requestId, "indications": quoteRequestArray };
        debugL2('submitting Live Prices  bulk request ' + JSON.stringify(bulkRequest));
        return await this.postWithValidate("/indication/v1/bulk-submit", bulkRequest, validateResponse);
    }

    public async createQuoteCancelRequest(quoteCancelRequest: any, validateResponse: boolean = false) {
        debugL2('submitting Quote Cancel Request, request ' + JSON.stringify(quoteCancelRequest));
        return await this.deleteWithValidate("/indication/v1/", quoteCancelRequest, validateResponse);
    }

    public async createClickToTradeRequest(clickToTradeRequest: any, validateResponse: boolean = false) {
        debugL2('submitting Click To Trade Request, request ' + JSON.stringify(clickToTradeRequest));
        return await this.postWithValidate("/indication/v1/trade", clickToTradeRequest, validateResponse);
    }

    public async accountAssetQuery(assetId: any, accountId: any, validateResponse: boolean = false) {
        debugL2("get account's asset balance");

        const params: UrlParams = {
            pathParams: {
                assetId,
                accountId
            }
        }
        return await this.getWithValidate("/corda/v1/account/{accountId}/asset/{assetId}", params, validateResponse);
    }

    public async closeAllOpenPositions(trader: TraderSession, marketId: string, price: string) {
        debugL2("close all open positions");

        const allPositions = await this.postWithValidate("/position/v1/query", {});
        debugL2("Retrieved all positions: ", JSON.stringify(allPositions));
        
        try {
            await Promise.all(allPositions.payload.result.accounts.map(async (account) => {
                if (account.type === "FUTURES") {
                    account.positions.forEach(async (position) => {
                        if (!position.marginMode) {
                            return;
                        }
                        const quantity = Number(position.quantity);
                        const initialSide = quantity > 0 ? "B" : "S";
                        const closingSide = quantity < 0 ? "B" : "S";
                        const orderQty = Math.abs(quantity).toString();
        
                        try {
                            // Submit the limit order
                            await trader.submitOrder({
                                userId: trader.getUsername(),
                                clOrderId: trader.nextId(),
                                marketId: marketId,
                                symbol: position.instrument.symbol,
                                orderType: "LMT",
                                side: initialSide,
                                orderQty: orderQty,
                                price: price,
                                tif: "GTC",
                            });
                            debugL2(`Limit order submitted for ${position.instrument.symbol}`);
        
                            // Submit the market order
                            await this.submitOrder({
                                userId: this.getUsername(),
                                clOrderId: this.nextId(),
                                marketId: marketId,
                                symbol: position.instrument.symbol,
                                orderType: "MKT",
                                side: closingSide,
                                orderQty: orderQty,
                                price: "0",
                                tif: "IOC",
                            });
                            debugL2(`Market order submitted for ${position.instrument.symbol}`);
                        } catch (error) {
                            debugL2(`Failed to submit order for ${position.instrument.symbol}: ${error}`);
                        }
                    });
                }
            }));
        } catch (error) {
            debugL2(`Failed to close all open positions: ${error}`);
        }
        
    }

    public async subscribeForMDStat(marketId: string, symbol: string) {
        this.socket.subscribeForMDStat(marketId, symbol);
    }

    public async depositTransactions(data:any , validateResponse: boolean = false) {
        debugL2('deposit transactions ' + JSON.stringify(data));
        return await this.postWithValidate("/integrations/v1/transaction", data, validateResponse);
    }

    public async approveBlockTrade(trade: any, validateResponse: boolean = false) {
        trade.requestId = this.getUsername()+"_"+uuidv4();
        trade.tradeTimestamp = Date.now();
        debugL2('submitting Block trade ' + JSON.stringify(trade));
        let result = await this.postWithValidate("/trade/v1/block-trade-approve", trade, validateResponse);
        return result;
    }
    
}