import { ConfigurationProvider, getWebSocketUrl } from './configuration';
import { Session } from './session';
import { diffString } from 'json-diff';

const Socket = require('ws');
const chai = require('chai');
const verify = require('./verify');
const debugL3 = require('debug')('fw-L3-web-socket');
const debugL1 = require('debug')('fw-L1-web-socket');
const debugL2 = require('debug')('fw-L2-web-socket');
export interface InstrumentDetail {
    marketId: string;
    symbol: string;
}

function getUniqueId(prefix: string): string {
    let tm = ((new Date()).getTime() - 1666915485438) / 1000 // milliseconds from 28/10/2022:000
    return prefix + Math.floor(tm % 1000) + Math.floor(Math.random() * 100);
}
export class WebSocket {

    private session: Session;
    private socket: any;
    private messages: any[];
    private pendingDisconnection: boolean = false;
    private uuid: string = ""
    private timeout: number;
    private options = {
        ignore: {
            heartbeat: true,
            inactivation: true,
            unmatched: false
        }
    };
    private rx = 0;  // temp read  pointer
    private heartbeatInterval: NodeJS.Timeout | null = null;

    public constructor(session: Session, options?: any) {
        this.session = session;
        this.socket = null;
        this.messages = [];
        if (options != undefined) {
            this.options = options;
        }
        this.uuid = getUniqueId(this.session.getUsername())
        const configuration = ConfigurationProvider.get();
        this.timeout = configuration ? configuration.profile['request-timeout'] * 1000 : 30000;
    }

    public async connect(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            debugL1('(' + this.session.getUsername() + ' ' + this.uuid + ') connect()')
            if (this.socket) {
                debugL1('(' + this.session.getUsername() + ' ' + this.uuid + ') existing socket detected. closing it')
                await this.disconnect();
            }

            const url = getWebSocketUrl() + '?xtoken=' + this.session.getAuthenticationToken();

            debugL2('(' + this.session.getUsername() + ' ' + this.uuid + ') connecting to ' + url);
            this.socket = new Socket(url);
            this.socket.onerror = (event) => {
                debugL1('(' + this.session.getUsername() + ' ' + this.uuid + ') socket error ', JSON.stringify(event));
                this.socket = null;
                reject(event.data);
            }

            await new Promise((resolve, reject) => {
                this.socket.onopen = () => {
                    debugL1('(' + this.session.getUsername() + ' ' + this.uuid + ') socket connected');

                    // const sendHeartbeat = () => {
                    //     if (this.socket != null && !this.pendingDisconnection) {
                    //         this.send({
                    //             type: 'heartbeat'
                    //         });
                    //         setTimeout(sendHeartbeat, 10000);
                    //     }                        
                    // };
                    // setTimeout(sendHeartbeat, 10000);

                    resolve(this.socket);
                }
            });
            
            this.socket.onmessage = (event) => {
                const timestamp = Date.now();
                const payload = JSON.parse(event.data);

                if (payload.batch && Array.isArray(payload.batch)) {
                    // Case: Incoming message contains a batch of messages
                    payload.batch.forEach(batchItem => {
                        if (batchItem.data) {
                            processMessage(batchItem.data, timestamp);
                        }
                    });
                } else if (payload.data) {
                    // Case: Normal single message
                    processMessage(payload.data, timestamp);
                } else {
                    debugL1(`(${this.session.getUsername()} ${this.uuid}) Unexpected WebSocket message format:`, JSON.stringify(payload));
                }
            }

            // Function to process each message
            const processMessage = (message, timestamp) => {
                if (message.trace) {
                    message.trace.rx = timestamp;
                } else {
                    message.trace = { rx: timestamp };
                }
            
                debugL2(`(${this.session.getUsername()} ${this.uuid}) received:`, message.type);
                debugL3(`(${this.session.getUsername()} ${this.uuid}) received:\n${JSON.stringify(message)}`);
            
                if (message.type === 'multi') {
                    // Handle multi-message type
                    message.payload.forEach(element => this.filterAndAdd(element));
                } else {
                    // Handle single message
                    this.filterAndAdd(message);
                }
            };

            this.socket.onclose = (event) => {
                if (this.pendingDisconnection)
                    debugL1('(' + this.session.getUsername() + ' ' + this.uuid + ') onclose()-socket disconnected. Expecting=', this.pendingDisconnection);
                else {
                    debugL1('(' + this.session.getUsername() + ' ' + this.uuid + ') onclose()-socket disconnected. Expecting=', this.pendingDisconnection, JSON.stringify(event));
                }
                this.socket = null;
            }
            resolve();
        })

    }
    public startHeartbeat() {
        // Set up an interval to send heartbeat messages every 10 seconds
        this.heartbeatInterval = setInterval(() => {
            if (this.socket !== null && !this.pendingDisconnection) {
                this.send({
                    type: 'heartbeat'
                });
            }
        }, 10000);
    }
    private filterAndAdd(message: any) {
        if (this.pendingDisconnection) {
            debugL1('(' + this.session.getUsername() + ' ' + this.uuid + ') pending disconnected. msg is ignored')
            return
        }

        if (message.type == "heartbeat") {
            //this.send(message);
        }
        else if (this.options.ignore.inactivation && (message.type == 'EXECUTION_REPORT') && (message.payload.orderStatus == 'SUSPENDED')) {
            // ignore order suspension cause by market closure
        }
        else {
            debugL3("---Adding message to queue ", JSON.stringify(message));
            this.messages.push(message);
        }
    }
    public async disconnect() {
        debugL1('(' + this.session.getUsername() + ' ' + this.uuid + ') disconnect called. isPending=', this.pendingDisconnection, " IsSocketNull=", (this.socket == null))
        this.pendingDisconnection = true
        if (this.socket) {
            this.socket.close();
            while (this.socket != null) {
                await new Promise(result => setTimeout(result, 100));
            }
            debugL1('(' + this.session.getUsername() + ' ' + this.uuid + ') truely disconnected')

        }
    }
    public async clearHearbeatSub() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    public connected(): boolean {
        return this.socket != null;
    }

    public send(data: any): boolean {
        debugL3('(' + this.session.getUsername() + ' ' + this.uuid + ') send:\n' + JSON.stringify(data))
        if (this.socket !== null && !this.pendingDisconnection) {
            try {
                this.socket.send(JSON.stringify(data));
                return true;
            } catch (err) {
                console.error(err);
                return false;
            }
        } else {
            chai.expect.fail('(' + this.session.getUsername() + ' ' + this.uuid + ') send failed: connection is not ready or pending disconnection', data);
        }

        return false;
    }

    public sendSubscribeMessage(channel: string, props?: any): any {
        const msg = {
            type: 'subscribe',
            channel,
            ...props
        }
        this.send(msg);
        return msg;
    }

    public sendUnsubscribeMessage(channel: string, props?: any): any {
        const msg = {
            type: 'unsubscribe',
            channel,
            ...props
        }
        this.send(msg);
        return msg;
    }

    public subscribeForHeartbeats() {
        this.send({
            type: 'heartbeat'
        });
    }

    public subscribeForAsset(): any {
        let msg = {
            channel: "myAssets",
            id: "myAssets.7",
            type: "subscribe"
        }
        this.send(msg);
        return msg;
    }

    public subscribeForTrades(marketId: string, symbol: string): any {
        let msg = {
            type: 'subscribe',
            id: 'trade.4',
            channel: 'trade',
            marketId: marketId,
            symbol: symbol
        }
        this.send(msg);
        return msg;
    }

    public unsubscribeForTrades(marketId: string, symbol: string): any {
        let msg = {
            type: 'unsubscribe',
            id: 'trade.4',
            channel: 'trade',
            marketId: marketId,
            symbol: symbol
        }
        this.send(msg);
        return msg;
    }

    public subscribeForRegistryTransaction(): any {
        let msg = {
            type: 'subscribe',
            id: 'registryTransaction.10',
            channel: 'registryTransaction'
        }
        this.send(msg);
        return msg;
    }

    public subscribeForAllRegistryTransaction(): any {
        let msg = {
            channel: 'allRegistryTransaction',
            id: 'allRegistryTransaction.60',
            type: 'subscribe'
        }
        this.send(msg);
        return msg;
    }

    public unSubscribeForAllRegistryTransaction(): any {
        let msg = {
            channel: 'allRegistryTransaction',
            id: 'allRegistryTransaction.60',
            type: 'unsubscribe'
        }
        this.send(msg);
        return msg;
    }

    public unsubscribeForRegistryTransaction(): any {
        let msg = {
            type: 'unsubscribe',
            id: 'registryTransaction.10',
            channel: 'registryTransaction'
        }
        this.send(msg);
        return msg;
    }

    public subscribeForGatewayController(): any {
        let msg = {
            type: 'subscribe',
            id: "gatewayController.xxxxxx",
            channel: 'gatewayController'
        }
        this.send(msg);
        return msg;
    }

    public subscribeForMakerChecker(): any {
        let msg = {
            type: 'subscribe',
            id: "makerCheckerEvent.xxxxxx",
            channel: 'makerCheckerEvent'
        }
        this.send(msg);
        return msg;
    }

    public subscribeForRefData(): any {
        let msg = {
            type: 'subscribe',
            id: "refdata.xxxxxx",
            channel: 'refdata'
        }
        this.send(msg);
        return msg;
    }

    public subscribeForNotification(): any {
        let msg = {
            type: 'subscribe',
            id: "notification.xxxxxx",
            channel: 'notification'
        }
        this.send(msg);
        return msg;
    }

    public subscribeForNftNotification(): any {
        let msg = {
            type: 'subscribe',
            id: "notification.11",
            channel: 'notification'
        }
        this.send(msg);
        return msg;
    }

    public subscribeForNFTOrders(userId?: string): any {
        let msg = {
            type: 'subscribe',
            id: "order.20",
            channel: 'order',
            userId: userId || this.session.getUsername()
        }
        this.send(msg);
        return msg;
    }

    public subscribeForOrderBook(marketId: string, symbol: string, additionalProps?: any): any {
        let msg = {
            type: 'subscribe',
            id: "orderbook.5",
            channel: 'orderbook',
            marketId: marketId,
            symbol: symbol,
            ...additionalProps
        }
        this.send(msg);
        return msg;
    }

    public unsubscribeForOrderBook(marketId: string, symbol: string): any {
        let msg = {
            type: 'unsubscribe',
            id: "orderbook.5",
            channel: 'orderbook',
            marketId: marketId,
            symbol: symbol
        }
        this.send(msg);
        return msg;
    }

    public subscribeForOrders(userId?: string): any {
        let msg = {
            type: 'subscribe',
            id: 'cobOrder.6',
            channel: 'cobOrder',
            userId: userId || this.session.getUsername()
        }
        this.send(msg);
        return msg;
    }

    public subscribeForPositions(userId?: string): any {
        let msg = {
            type: 'subscribe',
            id: 'userPosition.7',
            channel: 'userPosition',
            userId: userId || this.session.getUsername()
        }
        this.send(msg);
        return msg;
    }

    public unsubscribeForPositions(userId?: string): any {
        let msg = {
            type: 'unsubscribe',
            id: 'userPosition.7',
            channel: 'userPosition',
            userId: userId || this.session.getUsername()
        }
        this.send(msg);
        return msg;
    }

    public subscribeForNegotiations(userId?: string): any {
        let msg = {
            type: 'subscribe',
            id: 'negotiation.16',
            channel: 'negotiation',
            userId: userId || this.session.getUsername()
        }
        this.send(msg);
        return msg;
    }

    public subscribeForRFQ(userId?: string): any {
        let msg = {
            type: 'subscribe',
            id: 'rfq.10',
            channel: 'rfq',
            userId: userId || this.session.getUsername()
        }
        this.send(msg);
        return msg;
    }

    public subscribeForAuctions(userId?: string): any {
        let msg = {
            type: 'subscribe',
            id: 'auction.11',
            channel: 'auction',
            userId: userId || this.session.getUsername()
        }
        this.send(msg);
        return msg;
    }

    public subscribeForQuoteBook(marketId: string, symbol: string): any {
        let msg = {
            type: 'subscribe',
            id: 'quoteBook.5',
            channel: 'quoteBook',
            instruments: [{
                marketId: marketId,
                symbol: symbol
            }]
        }
        this.send(msg);
        return msg;
    }

    public unsubscribeForQuoteBook(marketId: string, symbol: string): any {
        let msg = {
            type: 'unsubscribe',
            id: 'quoteBook.5',
            channel: 'quoteBook'
        }
        this.send(msg);
        return msg;
    }

    public subscribeForTradeCaptures(firmId: string): any {
        let msg = {
            type: 'subscribe',
            id: 'tradeCapture.15',
            channel: 'tradeCapture',
            firmId: firmId
        }
        this.send(msg);
        return msg;
    }

    public subscribeForMDStat(marketId: string, symbol: string): any {
        let msg = {
            type: 'subscribe',
            id: 'mdstat.5',
            channel: 'mdstat',
            instruments: [{
                marketId: marketId,
                symbol: symbol
            }]
        }
        this.send(msg);
        return msg;
    }

    public unsubscribeForMDStat(marketId: string, symbol: string): any {
        let msg = {
            type: 'unsubscribe',
            id: 'mdstat.5',
            channel: 'mdstat',
            instruments: [{
                marketId: marketId,
                symbol: symbol
            }]
        }
        this.send(msg);
        return msg;
    }

    public subscribeForAllMdStats(marketIds: string[]): any {
        let msg = {
            type: 'subscribe',
            id: 'allMdStats.6',
            channel: 'allMdStats',
            marketIds
        }
        this.send(msg);
        return msg;
    }

    public unsubscribeForAllMdStats(marketIds: string[]): any {
        let msg = {
            type: 'unsubscribe',
            id: 'allMdStats.6',
            channel: 'allMdStats',
            marketIds
        }
        this.send(msg);
        return msg;
    }

    public subscribeForSystemState(): any {
        let msg = {
            type: 'subscribe',
            id: "systemState.xxxxxx",
            channel: 'systemState'
        }
        this.send(msg);
        return msg;
    }

    public subscribeForUserPosition(): any {
        let msg = {
            channel: "userPosition",
            id: "userPosition.13",
            type: "subscribe"
        }
        this.send(msg);
        return msg;
    }

    public subscribeForUserChats(): any {
        let msg = {
            type: 'subscribe',
            id: "userChats.19",
            channel: 'userChats'
        }
        this.send(msg);
        return msg;
    }

    public subscribeForGeneralData(): any {
        let msg = {
            type: 'subscribe',
            id: "generalData.19",
            channel: 'generalData'
        }
        this.send(msg);
        return msg;
    }

    public triggerLogout(reason: string = "User initiated"): any {
        let msg = {
            type: 'logout',
            reason: reason
        }
        this.send(msg);
        return msg;
    }

    public subscribeForDownstream(): any {
        let msg = {
            type: 'subscribe',
            id: "downstreamTest.39",
            channel: 'downstreamTest'
        }
        this.send(msg);
        return msg;
    }

    public clear(): any[] {
        let messages = this.messages;
        this.messages = [];
        this.rx = 0;
        return messages;
    }
    // Original expect logic had 2 disadvantages
    // 1) Breaking the loop, the moment count is satisfied. This creates interference from previous test cases outputs (which have not been consumed). To avoid this race conditions we had to add 
    //          lot of sleeps and clean the queue.... This was SEVERLY error prone and created huge lags in exectuion
    //              A new retryig mechanism is introduced now. When the total time slpet is not spent, it will automatically retry
    // 2) Cannot handle out of order messages when expecting an array - this is also fixed provided the message arrives within a maximum time period
    public async expect(expected?: any, timeout: number = 0, splice: boolean = true) {
        if (expected != null)
            debugL2('(' + this.session.getUsername() + ' ' + this.uuid + ')--------expect()-------- ', JSON.stringify(expected))
        else
            debugL2('(' + this.session.getUsername() + ' ' + this.uuid + ')--------expect()-------- null')

        let matched = [];
        let count = 1;
        if (expected == null) {
            count = 0;
        }
        else if (Array.isArray(expected)) {
            count = expected.length;
        }

        if (timeout == 0) {
            timeout = ((count == 0) ? 1 : 30 * count) * 1000;
        } else {
            timeout = timeout * 1000;
        }

        let retry = 0
        let results = await this.expectInt(expected, timeout, count, retry)
        matched = matched.concat(results.matched)
        while (results.done == false && results.remainingTime >= 50) {
            debugL2('(' + this.session.getUsername() + ' ' + this.uuid + ')' + "@@@@@ No match found. Retrying again with new timeout(ms)=", results.remainingTime)
            retry++
            results = await this.expectInt(expected, results.remainingTime, results.remainingCount, retry)
            matched = matched.concat(results.matched)
        }

        if (results.remainingCount > 0) {
            if (this.options.ignore.unmatched)
                console.log("not matched. but continuing without failing the test case")
            else
                chai.expect.fail('no match found for ' + JSON.stringify(expected));
        }
        if (splice) {
            // need to pull out the matched messages
            debugL3("---Splicing these messages ,", this.messages.length, this.rx);
            this.messages.splice(0, this.rx)
            this.rx = 0
        } else {
            debugL3("---Not splicing these messages ,", this.messages.length, this.rx);
            this.rx = 0;
        }
        return matched
    }


    private async expectInt(expected: any, timeout: number /* in milliseconds*/, count: number /* expeted msg count*/, retryCount: number): Promise<any> {
        if ((this.connected() == false) && ((this.messages.length - this.rx) < count)) {
            debugL2('(' + this.session.getUsername() + ' ' + this.uuid + ')' + ' NOT CONNECTED.  expectINT() will fail. Expected count=' + count + ' InQ=' + (this.messages.length - this.rx) + '\n');
            chai.expect.fail('not connected');
        }
        else {
            debugL2('(' + this.session.getUsername() + ' ' + this.uuid + ')' + '------------expectINT() expected count=[' + count + '] & timeout=[' + timeout + '] & retry=' + retryCount)
        }

        let sleep = 100;
        let totalSlept = 0
        let matched = []

        for (let i = 0; i < timeout; i += sleep) {
            totalSlept += sleep

            if (!this.connected || (this.messages.length - this.rx) >= count) {
                break;
            }
            await new Promise(result => setTimeout(result, sleep));
        }
        let remaining = (timeout - totalSlept)

        debugL2('(' + this.session.getUsername() + ' ' + this.uuid + ')' + '-------------- wait is over with expectedCount=' + count + " & rcvQ length=" + (this.messages.length - this.rx) + ' remaining time(ms)=' + remaining + "\n")

        if (expected == null) {
            debugL2('expect none');
            chai.expect((this.messages.length - this.rx)).to.equal(0);
        }
        else if (Array.isArray(expected)) {
            let expectedIndex = 0
            let matchedCount = 0
            while (expected.length > 0) {
                let expectedOne = expected[0];
                debugL3("--- Comparing expected[" + expectedIndex++ + "]-- ");
                let match = false;
                for (let i = 0; i < count; i++) {
                    let actual = this.messages[this.rx + i]
                    debugL3("------------- With actual[" + i + "] -- \n");
                    debugL3("--- actual messages", actual);
                    if ((actual != undefined) && (verify.compare(expectedOne, actual))) { // expected count can be < recived count
                        debugL2("-------------------MATCHED element----------------\n")
                        expected.splice(0, 1);
                        matched.push(actual);
                        matchedCount++
                        match = true;
                        break;
                    }
                }
                if (!match) {
                    debugL2("--------------- not-matched ---------. unmatched=" + expected.length + " in the Q=" + (this.messages.length - this.rx))
                    // debugL2("---", JSON.stringify(this.messages));
                    for (const m of this.messages) {
                        if (m.type == expectedOne.type) {
                            debugL3('(' + this.session.getUsername() + ' ' + this.uuid + ') + Closest match: %s', diffString(expectedOne, m, { full: true }));
                        }
                    }

                    // For the next round we have to adjust the expected count without moving the read pointer. 
                    // In order to handle out of order messages the following logic is used
                    // expected array length = this will have the matched messages removed, hences the remainingCount= (expected.length + matchedCount + retryCount)
                    // extra 1, is needed as the current recived Q does not have at least one message unmatched from the expected array
                    // and retryCOunt is added to make sure that with each iteration one extra message is expected in the queue. 
                    // This is to avoid situations where,  count > Q length already.i.e. wait loop just exit without waiting for new messages
                    return { matched: matched, done: false, remainingTime: remaining, remainingCount: (expected.length + matchedCount + 1 + retryCount) }
                }
            }
            this.rx = this.rx + count;
            debugL2('--------- ARRAY FULLY MATCHED ----------');
        }
        else if ((this.messages.length - this.rx) <= 0) {
            if (this.options.ignore.unmatched)
                console.log("no matching messages received within the timeout. but continuing without failing the test case")
            else
                chai.expect.fail('no matching messages received within the timeout ');
        }
        else {
            let actual = this.messages[this.rx]
            this.rx++;

            if (!verify.compare(expected, actual)) {
                debugL2("--------------- not-matched --------")
                return { matched: [], done: false, remainingTime: remaining, remainingCount: 1 }
            } else {
                debugL2("-------------------MATCHED message----------------\n")
                matched.push(actual);
            }
        }

        return { matched: matched, done: true, remainingTime: 0, remainingCount: 0 }
    }

    public async compare(message: any, targetKey?: string) {
        let isValid = false;
        let sleep = 100;
        let exactMessage;

        let key = 'requestId';
        if (targetKey) key = targetKey;

        for (let i = 0; i < this.timeout; i += sleep) {
            exactMessage = this.messages.filter((msg) => {
                if (msg.data && msg.data.payload) {
                    return msg.data.payload[key] == message.data.payload[key];
                } else {
                    return false;
                }
            });
            if (exactMessage.length >= 1) {
                debugL2('found exact socket message');
                break;
            }
            await new Promise((result) => setTimeout(result, sleep));
        }

        let exactIndex = this.messages.indexOf(exactMessage[0]);
        let actualMessage = this.messages.splice(exactIndex, 1)[0];

        debugL2('expected=', message, 'actual=', actualMessage);
        isValid = verify.compare(message, actualMessage);

        return { isValid, socketRes: actualMessage };
    }

}
