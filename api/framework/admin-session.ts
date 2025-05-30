import { request, APIResponse, APIRequestContext } from '@playwright/test';
import { getAdminApiUrl, getTraderApiUrl, getAdminApiBaseUrl, getAdminApiEndPoint, UrlParams, updateReferenceData } from './configuration';
import { RestClient } from './rest-client';
import { Session, SessionType } from './session';
import { formatValueForUrl } from './utils';
import { WebSocket } from './web-socket';
import { v4 as uuidv4 } from 'uuid';
import { re } from 'mathjs';


const debugL3 = require('debug')('fw-L3-admin-session');
const debugL2 = require('debug')('fw-L2-admin-session');
const debugL1 = require('debug')('fw-L1-admin-session');

export function getUniqueId(prefix: string): string {
    let tm = ((new Date()).getTime() - 1666915485438) / 1000 // milliseconds from 28/10/2022:000
    return prefix + Math.floor(tm % 1000) + Math.floor(Math.random() * 100);
}
export class AdminSession extends Session {

    protected client!: RestClient;
    protected id: number;
    protected err: any;
    protected socket!: WebSocket;

    public constructor(id: string) {
        super(id, SessionType.admin);
        this.id = 0;
    }

    public async start() {
        await super.login();

        this.client = await RestClient.create(this);

        this.socket = new WebSocket(this);
        await this.socket.connect();

        let request = await this.socket.subscribeForGatewayController();
        let response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);

        request = await this.socket.subscribeForRefData();
        response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);

        request = await this.socket.subscribeForMakerChecker();
        response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);
        await this.socket.expect({ "id": "makerCheckerEvent.xxxxxx", "type": "initial_data", "payload": [] });

        request = await this.socket.subscribeForNotification();
        response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);

        await this.socket.unSubscribeForAllRegistryTransaction();
        request = await this.socket.subscribeForAllRegistryTransaction();
        response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);

        let wSRequest = await this.socket.subscribeForSystemState();
        let wSResponse = JSON.parse(JSON.stringify(wSRequest));
        wSResponse['status'] = 'OK';
        await this.socket.expect(wSResponse);

        // request = await this.socket.subscribeForNftNotification();
        // response = JSON.parse(JSON.stringify(request));
        // response['status'] = 'OK';
        // await this.socket.expect(response);

        this.socket.startHeartbeat();
        this.socket.clear();
    }

    public async stop() {
        if (this.socket) {
            await this.socket.clearHearbeatSub();
            await this.socket.disconnect();
        }
        await this.logout();
    }

    public clear() {
        this.socket.clear();
    }

    public async expect(message: any, timeout: any = 0) {
        return await this.socket.expect(message, timeout);
    }

    public nextId() {
        return 'teste2e-' + this.getUsername() + '-' + Date.now() + '-' + this.id++;
    }

    public error() {
        return this.err;
    }

    public async sleep(timeout: number) {
        return new Promise((resolve: any, reject: any) => {
            setTimeout(function () {
                return resolve('Ok');
            }, timeout);
        });
    }

    private async get(entity: string, id?: string) {
        this.err = null;
        try {
            const response: APIResponse = await this.client.get(getAdminApiUrl(entity) + (id ? formatValueForUrl(id) : ''));
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));
            return responseBody;
        } catch (err: any) {
            debugL3('Error: ', err);
            debugL1('error: (' + err.status + ')\n' + JSON.stringify(err));
            this.err = err;
            return err.message;
        }
    }

    private async getDealExportFile(entity: string, id?: string) {
        this.err = null;
        try {
            const response: APIResponse = await this.client.get(entity);
            const responseBody = await response.json();
            const content = Buffer.from(responseBody, 'binary');
            return content;
        } catch (err: any) {
            debugL3('Error: ', err);
            debugL1('error: (' + err.status + ')\n' + JSON.stringify(err));
            this.err = err;
            return err.message;
        }
    }

    public async getCalendars() {
        debugL2('get calendars');
        return this.get('/refdata/v1/calendars/');
    }

    public async getCalendar(calendarId: string) {
        debugL2('get calendar calendarId=' + calendarId);
        return this.get('/refdata/v1/calendars/', calendarId);
    }

    public async getFirms() {
        debugL2('get firms');
        return this.get('/refdata/v1/firms/');
    }

    public async getFirm(firmId: string) {
        debugL2('get firm firmId=' + firmId);
        return this.get('/refdata/v1/firms/', firmId);
    }

    public async getAccounts() {
        debugL2('get accounts');
        return this.get('/refdata/v1/accounts/');
    }

    public async getAccount(accountId: string) {
        debugL2('get account accountId=' + accountId);
        return this.get('/refdata/v1/accounts/', accountId);
    }

    public async getAllAssetData() {
        debugL2('get asset data');
        return this.get('/refdata/v1/asset-data/');
    }

    public async getAssetData(assetName: string) {
        debugL2('get asset data =' + assetName);
        return this.get('/refdata/v1/asset-data/', assetName);
    }

    public async getInstruments() {
        debugL2('get instruments');
        return this.get('/refdata/v1/instruments/');
    }

    public async getInstrument(symbol: string) {
        debugL2('get instrument symbol=' + symbol);
        return this.get('/refdata/v1/instruments/', symbol);
    }

    public async getInstrumentParameters() {
        debugL2('get instrument parameters');
        return this.get('/refdata/v1/instrument-parameters/');
    }

    public async getInstrumentParameter(parameterTableId: string) {
        debugL2('get instrument parameter parameterTableId=' + parameterTableId);
        return this.get('/refdata/v1/instrument-parameters/', parameterTableId);
    }

    public async getMarkets() {
        debugL2('get markets');
        return this.get('/refdata/v1/markets/');
    }

    public async getMarket(marketId: string) {
        debugL2('get market marketId=' + marketId);
        return this.get('/refdata/v1/markets/', marketId);
    }

    public async getRoles() {
        debugL2('get roles');
        return this.get('/refdata/v1/roles/');
    }

    public async getRole(roleId: string) {
        debugL2('get role roleId=' + roleId);
        return this.get('/refdata/v1/roles/', roleId);
    }

    public async getSystemParameters() {
        debugL2('get system parameters');
        return this.get('/refdata/v1/system-parameters/', '__default__');
    }

    public async getTickStructures() {
        debugL2('get tick structures');
        return this.get('/refdata/v1/tick-structures/');
    }

    public async getTickStructure(tickStructureId: string) {
        debugL2('get tick structure tickStructureId=' + tickStructureId);
        return this.get('/refdata/v1/tick-structures/', tickStructureId);
    }

    public async getUnits() {
        debugL2('get units');
        return this.get('/refdata/v1/units/');
    }

    public async getUnit(unitId: string) {
        debugL2('get unit unitId=' + unitId);
        return this.get('/refdata/v1/units/', unitId);
    }

    public async getUsers() {
        debugL2('get users');
        return this.get('/refdata/v1/users/');
    }

    public async getUser(userId: string) {
        debugL2('get user userId=' + userId);
        return this.get('/refdata/v1/users/', userId);
    }

    public async getInstrumentParameterByIndex(idx: number) {
        debugL2('get instrument parameter idx=' + idx);
        const parameters = (await this.getInstrumentParameters()).payload;

        if (Array.isArray(parameters)) {
            const parameter = parameters.find(parameter => parameter.idx == idx);
            return parameter || null;
        }
        return null;
    }

    public async getNotifications() {
        debugL2('get notifications');
        return this.get('/notification/v1');
    }

    public async getWalletSourceAsset(custodyInterface: string, instrumentIdx: number) {
        debugL2('get wallet source asset custodyInterface=' + custodyInterface + ' instrumentIdx=' + instrumentIdx);
        return this.get('wallet-source-assets', custodyInterface + '/' + instrumentIdx);
    }

    public async getExchangeRate(effectiveDate: string) {
        debugL2('get exchange rate date =' + effectiveDate);
        return this.get('/refdata/v1/exchange-rates/', effectiveDate);
    }

    private async add(entity: string, request: any) {
        this.err = null;
        try {
            // request.requestId = this.nextId();
            const response: APIResponse = await this.client.post(getAdminApiUrl(entity), request);
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));
            return responseBody;
        } catch (err: any) {
            debugL3('Error: ', err);
            debugL1('error: (' + err.status + ')\n' + JSON.stringify(err));
            this.err = err;
            return {status: 'ERROR', message: err.message};
        }
    }

    public async addCalendar(request: any) {
        debugL2('add calendar request=' + JSON.stringify(request));
        return this.add('/refdata/v1/calendars/', request);
    }

    public async addFirm(request: any) {
        debugL2('add firm request=' + JSON.stringify(request));
        return this.add('/refdata/v1/firms/', request);
    }

    public async addInstrument(request: any) {
        debugL2('add instrument request=' + JSON.stringify(request));
        return this.add('/refdata/v1/instruments/', request);
    }

    public async addAccount(request: any) {
        debugL2('add account request=' + JSON.stringify(request));
        return this.add('/refdata/v1/accounts/', request);
    }

    public async addAssetData(request: any) {
        debugL2('add asset data = ' + JSON.stringify(request));
        return this.add('/refdata/v1/asset-data/', request);
    }

    public async addInstrumentPolicy(request: any) {
        debugL2('add instrument group request=' + JSON.stringify(request));
        return this.add('/refdata/v1/instrument-policies/', request);
    }

    public async addInstrumentParameter(request: any) {
        debugL2('add instrument parameter request=' + JSON.stringify(request));
        return this.add('/refdata/v1/instrument-parameters/', request);
    }

    public async addMarket(request: any) {
        debugL2('add market request=' + JSON.stringify(request));
        return this.add('/refdata/v1/markets/', request);
    }

    public async addRole(request: any) {
        debugL2('add role request=' + JSON.stringify(request));
        return this.add('/refdata/v1/roles/', request);
    }

    public async addTickStructure(request: any) {
        debugL2('add tick structure request=' + JSON.stringify(request));
        return this.add('/refdata/v1/tick-structures/', request);
    }

    public async addUnit(request: any) {
        debugL2('add unit request=' + JSON.stringify(request));
        return this.add('/refdata/v1/units/', request);
    }

    public async addUser(request: any) {
        debugL2('add user request=' + JSON.stringify(request));
        return this.add('/refdata/v1/users/', request);
    }

    public async addProject(request: any) {
        debugL2('add project request=' + JSON.stringify(request));
        return this.add('/refdata/v1/projects/', request);
    }

    public async addExchangeRate(request: any) {
        debugL2('add exchange rate request=' + JSON.stringify(request));
        return this.add('/refdata/v1/exchange-rates/', request);
    }

    public async changePassword(userId: string, password: String) {
        debugL2('Changing password userId =' + userId + ' Password: ' + password);
        this.err = null;
        const userUrl = getAdminApiUrl('/refdata/v1/users/');
        const request = {};
        request['password'] = password;

        try {
            const response: APIResponse = await this.client.post(userUrl + userId + '/resetPassword', request);
            const responseBody = await response.json();
            debugL2('response:\n' + JSON.stringify(responseBody));
            return responseBody;
        } catch (err: any) {
            debugL3('Error: ', err);
            debugL2('error: (' + err.status + ')\n' + JSON.stringify(err));
            this.err = err;
            return err.message;
        }
    }

    public async addNotification(request: any) {
        debugL2('add notification request=' + JSON.stringify(request));
        return this.add('/notification/v1', request);
    }

    // public async update(entity: string, id: any, request: any) {
    //     this.err = null;
    //     let result = await this.client.put<any>(getAdminApiUrl(entity) + id, request)
    //         .then((result: AxiosResponse<any>) => {
    //             debugL3('response:\n' + JSON.stringify(result.data));
    //             return result.data;
    //         })
    //         .catch((err: AxiosError) => {
    //             debugL3('Error: ', err);
    //             debugL1('error: (' + err.response?.status + ')\n' + JSON.stringify(err.response?.data));
    //             this.err = err;
    //             return err.response?.data;
    //         });

    //     return result;
    // }

    public async updateCalendar(calendarId: any, request: any) {
        debugL2('update calendar calendarId=' + calendarId + ', request=' + JSON.stringify(request));
        return updateReferenceData('/refdata/v1/calendars/', calendarId, request, this.client);
    }

    public async updateFirm(firmId: any, request: any) {
        debugL2('update firm firmId=' + firmId + ', request=' + JSON.stringify(request));
        return updateReferenceData('/refdata/v1/firms/', firmId, request, this.client);
    }

    public async updateAssetData(assetName: any, request: any) {
        debugL2('update asset data =' + assetName + ', request=' + JSON.stringify(request));
        return updateReferenceData('/refdata/v1/asset-data/', assetName, request, this.client);
    }

    public async updateInstrument(symbol: any, request: any) {
        debugL2('update instrument symbol=' + symbol + ', request=' + JSON.stringify(request));
        return updateReferenceData('/refdata/v1/instruments/', symbol, request, this.client);
    }

    public async updateInstrumentParameter(parameterTableId: any, request: any) {
        debugL2('update instrument parameter parameterTableId=' + parameterTableId + ', request=' + JSON.stringify(request));
        return updateReferenceData('/refdata/v1/instrument-parameters/', parameterTableId, request, this.client);
    }

    public async updateMarket(marketId: any, request: any) {
        debugL2('update market marketId=' + marketId + ', request=' + JSON.stringify(request));
        return updateReferenceData('/refdata/v1/markets/', marketId, request, this.client);
    }

    public async updateRole(roleId: any, request: any) {
        debugL2('update role roleId=' + roleId + ', request=' + JSON.stringify(request));
        return updateReferenceData('/refdata/v1/roles/', roleId, request, this.client);
    }

    public async updateSystemParameters(request: any) {
        let parameterId = '__default__';
        debugL2('update system parameter parameterTableId=' + parameterId + ', request=' + JSON.stringify(request));
        return updateReferenceData('/refdata/v1/system-parameters/', parameterId, request, this.client);
    }

    public async updateTickStructure(tickStructureId: any, request: any) {
        debugL2('update tick structure tickStructureId=' + tickStructureId + ', request=' + JSON.stringify(request));
        return updateReferenceData('/refdata/v1/tick-structures/', tickStructureId, request, this.client);
    }

    public async updateUnit(unitId: any, request: any) {
        debugL2('update unit unitId=' + unitId + ', request=' + JSON.stringify(request));
        return updateReferenceData('/refdata/v1/units/', unitId, request, this.client);
    }

    public async updateUser(userId: any, request: any) {
        debugL2('update user userId=' + userId + ', request=' + JSON.stringify(request));
        return updateReferenceData('/refdata/v1/users/', userId, request, this.client);
    }

    public async updateExchangeRate(effectiveDate: string, request: any) {
        debugL2('update exchange rate date=' + effectiveDate + ', request=' + JSON.stringify(request));
        return updateReferenceData('/refdata/v1/exchange-rates/', effectiveDate, request, this.client);
    }

    public async delete(entity: string, id: any, request?: any) {
        this.err = null;
        let params = '';
        for (let key in request) {
            if (params != '') {
                params += '&';
            }
            params += key + '=' + request[key];
        }

        try {
            const response: APIResponse = await this.client.delete(getAdminApiUrl(entity) + id + '?' + params);
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));
            return responseBody;
        } catch (err: any) {
            debugL3('Error: ', err);
            debugL1('error: (' + err.status + ')\n' + JSON.stringify(err));
            this.err = err;
            return err.message;
        }
    }

    public async deleteUser(userId: any, request: { requestedBy: string, comment: string }) {
        debugL2('delete user userId=' + userId);
        return this.delete('/refdata/v1/users/', userId, request);
    }

    public async deleteAccount(accountId: any, request: { requestedBy: string, comment: string }) {
        debugL2('delete account accountId=' + accountId);
        return this.delete('/refdata/v1/accounts/', accountId, request);
    }

    public async deleteInstrument(instrumentId: any, request: { requestedBy: string, comment: string }) {
        debugL2('delete instrument instrumentId=' + instrumentId);
        return this.delete('/refdata/v1/instruments/', instrumentId, request);
    }

    public async deleteInstrumentPolicy(instrumentPolicyId: any, request: { requestedBy: string, comment: string }) {
        debugL2('delete instrument policy instrumentPolicyId=' + instrumentPolicyId);
        return this.delete('/refdata/v1/instrument-policies/', instrumentPolicyId, request);
    }

    public async updateNotification(request: any) {
        debugL2('update notification notification_id=' + request.notification_id + ', request=' + JSON.stringify(request));
        return updateReferenceData('/notification/v1', '', request, this.client);
    }

    private async postWithValidate(id: string, message: any, validateResponse: boolean = false) {
        this.err = null;
        try {
            const response: APIResponse = await this.client.post(getAdminApiUrl(id), message);
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));

            if (validateResponse && !response.ok()) {
                this.validateResponse(response, 'post', getAdminApiEndPoint(id));
            }
            return responseBody;
        } catch (error: any) {
            this.err = error;
            const data = error?.response ? await error.response.json() : error;
            debugL1(`error:\n` + JSON.stringify(data));

            if (validateResponse) {
                this.validateResponse(error.response, 'post', getAdminApiEndPoint(id));
            }
            throw error;
        }
    }

    public async updateNextTradingDay(updateNextTradingDay: any, validateResponse: boolean = false) {
        updateNextTradingDay.requestId = this.nextId();
        debugL2('submitting updateNextTradingDay request ' + JSON.stringify(updateNextTradingDay));

        let result = await this.postWithValidate("/system-manager/v1/updateNextTradingDay", updateNextTradingDay, validateResponse);
        return result;
    }

    private async putWithValidate(id: string, message: any, validateResponse: boolean = false, params?: UrlParams) {
        this.err = null;
        try {
            const response: APIResponse = await this.client.put(getAdminApiUrl(id, params), message);
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));

            if (validateResponse && !response.ok()) {
                this.validateResponse(response, 'put', getAdminApiEndPoint(id));
            }
            return responseBody;
        } catch (error: any) {
            this.err = error;
            const data = error?.response ? await error.response.json() : error;
            debugL1(`error:\n` + JSON.stringify(data));

            if (validateResponse) {
                this.validateResponse(error.response, 'put', getAdminApiEndPoint(id));
            }
            throw error;
        }
    }

    private async deleteWithValidate(id: string, message: any, validateResponse: boolean = false, params?: UrlParams) {
        this.err = null;
        try {  
            const response: APIResponse = await this.client.delete(getAdminApiUrl(id, params), message);
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));

            if (validateResponse && !response.ok()) {
                this.validateResponse(response, 'delete', getAdminApiEndPoint(id));
            }
            return responseBody;
        } catch (error: any) {
            this.err = error;
            const data = error?.response ? await error.response.json() : error;
            debugL1(`error:\n` + JSON.stringify(data));

            if (validateResponse) {
                this.validateResponse(error.response, 'delete', getAdminApiEndPoint(id));
            }
            throw error;
        }
    }

    private async getWithValidate(id: string, params?: UrlParams, validateResponse: boolean = false) {
        this.err = null;
        try {
            const response: APIResponse = await this.client.get(getAdminApiUrl(id, params));
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));
            if (validateResponse && !response.ok()) {
                this.validateResponse(response, 'get', getAdminApiEndPoint(id));
            }
            return responseBody;
        } catch (error: any) { 
            this.err = error;
            const data = error?.response ? await error.response.json() : error;
            debugL1(`error:\n` + JSON.stringify(data));

            if (validateResponse) {
                this.validateResponse(error.response, 'get', getAdminApiEndPoint(id));
            }
            throw error;
        }
    }

    public async flagForDelete(entity: string, id: string, comment: string, validateResponse: boolean = false) {
        const request = {
            action: "DELETE",
            data: { comment },
            key: entity + ":" + id + ":DELETE",
            type: "REFDATA"
        }

        return await this.postWithValidate("/maker-checker/v1/", request, validateResponse);
    }

    public async flagForDeleteMarket(marketId: string, validateResponse: boolean = false) {
        debugL2('flagForDeleteMarket market marketId=' + marketId);
        return this.flagForDelete('MARKET', marketId, "flag for delete market", validateResponse);
    }

    public async getGatewayHistory(includeAllHistory: boolean, filter: any, validateResponse: boolean = false) {
        debugL2('get gateway history');

        this.err = null;
        let request = filter;
        request.includeAllHistory = includeAllHistory;

        return await this.postWithValidate("/gateway/v1/history/", request, validateResponse);
    }

    public async getGatewayStat(requestId: string, interfaceId: string, validateResponse: boolean = false) {
        debugL2('get gateway history');

        this.err = null;
        let request = {
            requestId, interfaceId
        };

        return await this.postWithValidate("/gateway/v1/stat/", request, validateResponse);
    }

    public async disconnectGatewayUser(requestId: string, interfaceId: string, userId: string, validateResponse: boolean = false) {
        debugL2('user disconnected');

        this.err = null;
        let request = {
            requestId, interfaceId, userId
        };

        return await this.putWithValidate("/gateway/v1/disconnect/", request, validateResponse);
    }

    public async resetGatewayUserSequence(requestId: string, interfaceId: string, userId: string, validateResponse: boolean = false) {
        debugL2('gateway user sequence reset');

        this.err = null;
        let request = {
            requestId, interfaceId, userId
        };

        return await this.putWithValidate("/gateway/v1/reset/", request, validateResponse);
    }

    public async setSystemState(state: string, validateResponse: boolean = false) {
        debugL2('set system state state=' + state);
        let request = {
            state: state
        };

        return await this.postWithValidate("/system-manager/v1/systemState/", request, validateResponse);
    }

    public async getSystemState(validateResponse: boolean = false) {
        debugL2('Get system state state');

        return await this.getWithValidate("/system-manager/v1/systemState/", undefined, validateResponse);
    }

    public async runSystemEvent(scheduleEventId: string, validateResponse: boolean = false) {
        debugL2('run system event. event=' + scheduleEventId);
        let request = {
            scheduleEventId: scheduleEventId
        };

        return await this.postWithValidate("/system-manager/v1/requestScheduleEventExecution", request, validateResponse);
    }

    public async forceCompleteSystemEvent(scheduleEventId: string, validateResponse: boolean = false) {
        debugL2('force complete system event. event=' + scheduleEventId);
        let request = {
            scheduleEventId: scheduleEventId
        };

        return await this.postWithValidate("/system-manager/v1/forceCompletetOperationalCycleProcess", request, validateResponse);
    }

    public async requestRefdataDelete(validateResponse: boolean = false) {
        debugL2('starting refdata deletion');

        return await this.postWithValidate("/system-manager/v1/requestRefdataDelete", undefined, validateResponse);
    }

    public async getMarketSession(marketId: string, details?: boolean) {
        debugL2('get market session marketId=' + marketId);

        this.err = null;
        try {
            const response: APIResponse = await this.client.get(getAdminApiUrl('/market-manager/v1/market-session/') + marketId + (details ? '?getInstruments=true' : ''));
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));
            return responseBody;
        } catch (err: any) {
            debugL3('Error: ', err);
            debugL1('error: (' + err.status + ')\n' + JSON.stringify(err));
            this.err = err;
            return err.message;
        }
    }

    public async setMarketSession(marketId: string, sessionType: string) {
        debugL2('set market session marketId=' + marketId + ', sessionType=' + sessionType);
        let request = {
            requestId: this.nextId(),
            sessionType: sessionType
        };

        this.err = null;
        try {
            const response: APIResponse = await this.client.put(getAdminApiUrl('/market-manager/v1/market-session/') + encodeURIComponent(marketId), request);
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));
            return responseBody;
        } catch (err: any) {
            debugL3('Error: ', err);
            debugL1('error: (' + err.status + ')\n' + JSON.stringify(err));
            this.err = err;
            return err.message;
        }
    }

    public async getInstrumentSession(marketId: string, symbol: string) {
        debugL2('get instrument session marketIdx=' + marketId + ', symbol=' + symbol);

        this.err = null;
        try {
            const response: APIResponse = await this.client.get(getAdminApiUrl('/market-manager/v1/instrument-session/') + marketId + '/' + formatValueForUrl(symbol));
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));
            return responseBody;
        } catch (err: any) {
            debugL3('Error: ', err);
            debugL1('error: (' + err.status + ')\n' + JSON.stringify(err));
            this.err = err;
            return err.message;
        }
    }

    public async setInstrumentSession(marketId: string, symbol: string, sessionType: string) {
        debugL2('set instrument session marketId=' + marketId + ', symbol=' + symbol + ", sessionType=" + sessionType);
        let request = {
            requestId: this.nextId(),
            sessionType: sessionType
        };

        this.err = null;
        try {
            const response: APIResponse = await this.client.put(getAdminApiUrl('/market-manager/v1/instrument-session/') + marketId + '/' + formatValueForUrl(symbol), request);
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));
            return responseBody;
        } catch (err: any) {
            debugL3('Error: ', err);
            debugL1('error: (' + err.status + ')\n' + JSON.stringify(err));
            this.err = err;
            return err.message;
        }
    }

    public async waitForMarketSession(marketId: string, sessionType: string, timeout?: number) {
        debugL2('waitForMarketSession marketId=' + marketId + " sessionType=" + sessionType);
        timeout = timeout || 30;
        let elapsed = 0;
        while ((await this.getMarketSession(marketId)).sessionType != sessionType) {
            await new Promise(result => setTimeout(result, 3000));
            elapsed++;
            if (elapsed > timeout) {
                throw new Error('timeout exceeded while waiting for market session change');
            }
        }
    }

    public async waitForInstrumentSession(marketId: string, symbol: string, sessionType: string, timeout?: number) {
        timeout = timeout || 30;
        let elapsed = 0;
        while ((await this.getInstrumentSession(marketId, formatValueForUrl(symbol))).sessionType != sessionType) {
            await new Promise(result => setTimeout(result, 1000));
            elapsed++;
            if (elapsed > timeout) {
                throw new Error('timeout exceeded while waiting for instrument session change');
            }
        }
    }

    public async resetMarketSession(marketId: string, sessionType: string, timeout?: number) {
        timeout = timeout || 30;
        debugL2('resetting market session marketId=' + marketId + ', sessionType=' + sessionType);

        let current = await this.getMarketSession(marketId);
        if (current.sessionType != sessionType) {
            current = await this.setMarketSession(marketId, sessionType);
            if (current.sessionType != sessionType) {
                throw new Error('failed to switch market session');
            }
        }

        current = await this.getMarketSession(marketId, true);
        debugL2('current status:\n' + JSON.stringify(current));
        for (let i = 0; i < current.instrumentSessions.length; i++) {
            await this.setInstrumentSession(marketId, current.instrumentSessions[i].symbol, 'HALT');
            await this.setInstrumentSession(marketId, current.instrumentSessions[i].symbol, 'NONE');
        }

        debugL2('sessions reset marketId=' + marketId + ', sessionType=' + sessionType);
    }

    public async updatePricingData(symbol: string, data: any, validateResponse: boolean = false) {
        debugL2('update pricing symbol=' + symbol + ', data=' + JSON.stringify(data));

        this.err = null;
        let request = {
            symbol: symbol,
            enable: false,
            defaultPricingData: data,
            defaultPricingDataEditSequence: 0
        };

        return await this.postWithValidate("/pricing/v1/enable/", request, validateResponse);
    }

    public async deposit(accountId: string, symbol: string, amount: string, validateResponse: boolean = false) {
        debugL2('deposit funds to an account');

        this.err = null;
        const depositRequest = {
            requestId: uuidv4(),
            accountId: accountId,
            symbol: symbol,
            amount: amount,
        }

        return await this.postWithValidate("/position/v1/deposit", depositRequest, validateResponse);
    }

    public async transfer(sendingAccountId: string, receivingAccountId: string, symbol: string, amount: string, validateResponse: boolean = false) {
        debugL2('transfer funds to an account from an account');

        this.err = null;
        const transferRequest = {
            requestId: uuidv4(),
            receivingAccountId: receivingAccountId,
            symbol: symbol,
            amount: amount,
            sendingAccountId: sendingAccountId
        }

        return await this.postWithValidate("/position/v1/transfer", transferRequest, validateResponse);
    }

    public async withdraw(accountId: string, symbol: string, amount: string, validateResponse: boolean = false) {
        debugL2('withdraw funds from an account');

        this.err = null;
        const withdrawRequest = {
            requestId: uuidv4(),
            accountId: accountId,
            symbol: symbol,
            amount: amount,
        }

        return await this.postWithValidate("/position/v1/withdraw", withdrawRequest, validateResponse);
    }

    public async resetBalances(accountId, symbol) {
        let balanceResponse = await this.getBalance(accountId);
        if (balanceResponse != null) {
            let positions = balanceResponse.payload.result.positions;
            let balanceAdjustmentQty;
            let availableBalanceAdjustmentQty;
            for (let i = 0; i < positions.length; i++) {
                if (positions[i].instrument.symbol === symbol) {
                    balanceAdjustmentQty = positions[i].quantity * -1;
                    availableBalanceAdjustmentQty = positions[i].availableQuantity * -1;
                }
            }

            if (balanceAdjustmentQty != null) {
                await this.adjustBalance(
                    accountId,
                    symbol,
                    balanceAdjustmentQty.toString()
                );
            }

            if (availableBalanceAdjustmentQty != null) {
                await this.adjustAvalBalance(
                    accountId,
                    symbol,
                    availableBalanceAdjustmentQty.toString()
                );
            }
        } else {
            console.error("Error in balance adjustment. Could not get current positions.")
        }
    }

    public async adjustAvalBalance(accountId: string, symbol: string, amount: string, validateResponse: boolean = false) {
        debugL2('withdraw funds from an account');

        this.err = null;
        const withdrawRequest = {
            requestId: uuidv4(),
            accountId: accountId,
            symbol: symbol,
            amount: amount,
            type: 'AVL_BALANCE'
        }

        return await this.postWithValidate("/position/v1/adjustment", withdrawRequest, validateResponse);
    }

    public async adjustBalance(accountId: string, symbol: string, amount: string, validateResponse: boolean = false) {
        debugL2('withdraw funds from an account');

        this.err = null;
        const withdrawRequest = {
            requestId: uuidv4(),
            accountId: accountId,
            symbol: symbol,
            amount: amount,
            type: 'BALANCE'
        }

        return await this.postWithValidate("/position/v1/adjustment", withdrawRequest, validateResponse);
    }

    public async getBalance(accountId: string, validateResponse: boolean = false) {
        debugL2('get balances from an account [' + accountId + ']');

        this.err = null;
        const params: UrlParams = {
            pathParams: {
                accountId
            }
        }

        return await this.getWithValidate("/position/v1/balance/{accountId}", params, validateResponse);
    }

    public async getWalletBalance(accountId: string, validateResponse: boolean = false) {
        debugL2('get balances from an account');

        this.err = null;
        const params: UrlParams = {
            pathParams: {
                accountId
            }
        }

        return await this.getWithValidate("/position/v1/wallet/balance/{accountId}", params, validateResponse);
    }

    public async sendMassCancel(massCancelRequest: any, validateResponse: boolean = false) {
        debugL2('mass cancelling - ', massCancelRequest);

        return await this.postWithValidate("/order/v1/mass-cancel", { requestId: this.nextId(), ...massCancelRequest }, validateResponse);
    }

    public async queryOrders(query: any, validateResponse: boolean = false) {
        debugL2('querying orders ' + JSON.stringify(query));

        let result = await this.postWithValidate("/order/v1/query/", query, validateResponse);
        return result.payload;
    }

    public async queryTransactionsHistory(query: any, validateResponse: boolean = false) {
        debugL2('querying transaction history ' + JSON.stringify(query));

        let result = await this.postWithValidate("/position/v1/history", query, validateResponse);
        return result.payload;
    }

    public async getAllocationUploadLink(validateResponse: boolean = false) {
        debugL2('getting allocation upload link');

        return await this.getWithValidate("/pt-service/v1/allocation-upload-link", undefined, validateResponse);
    }

    public async postAllocationSummary(data: any, validateResponse: boolean = false) {
        debugL2('posting allocation summary');

        return await this.postWithValidate("/pt-service/v1/alloc-summary", data, validateResponse);
    }

    public async postTradeReportQuery(data: any, validateResponse: boolean = false) {
        debugL2('posting trade report query');
        return await this.postWithValidate("/trade/v1/trade-report-query", data, validateResponse);
    }

    public async postTradeCaptureQuery(data: any, validateResponse: boolean = false) {
        debugL2('posting trade report query');
        return await this.postWithValidate("/trade/v1/trade-capture-query", data, validateResponse);
    }

    public async triggerFileProcess(data: any, validateResponse: boolean = false) {
        debugL2('Trigger the file process');
        return await this.postWithValidate("/system-manager/v1/file-operations", data, validateResponse);
    }

    public async postPrimarySettlement(data: any, validateResponse: boolean = false) {
        debugL2('posting primary settlement');

        return await this.postWithValidate("/pt-service/v1/pts-mgmt", data, validateResponse);
    }

    public async postISIN(data: any, validateResponse: boolean = false) {
        debugL2('posting new ISIN');

        return await this.postWithValidate("/integrations/v1/isin-update", data, validateResponse);
    }

    public async createNewToken(depositRequest: any, validateResponse: boolean = false) {
        debugL2('create a new token');

        this.err = null;

        return await this.postWithValidate("/refdata/v1/instruments/", depositRequest, validateResponse);
    }
    public async makerChecker(request: any, validateResponse: boolean = false) {
        debugL2('maker checker request');
        this.err = null;

        return await this.postWithValidate("/refdata/v1/instruments/", request, validateResponse);
    }
    //TODO: Move DA functions to seperate file
    public async updateToken(tokenRequest: any, instanceId: any, validateResponse: boolean = false) {
        debugL2('update a token');

        this.err = null;
        const params: UrlParams = {
            pathParams: {
                instanceId
            }
        }
        return await this.putWithValidate("/refdata/v1/instruments/{instanceId}", tokenRequest, validateResponse, params);
    }
    public async deleteToken(deleteRequest: any, validateResponse: boolean = false) {
        debugL2('delete a token');

        this.err = null;

        return await this.postWithValidate("/maker-checker/v1/", deleteRequest, validateResponse);
    }
    public async refDataDelete(validateResponse: boolean = false) {
        debugL2('delete ref data');

        this.err = null;

        return await this.postWithValidate("/system-manager/v1/requestRefdataDelete", {}, validateResponse);
    }
    public async deployToken(symbol: any, blockchain: any, validateResponse: boolean = false) {
        debugL2('deploy token');

        this.err = null;
        const deployRequest = {
            symbol: symbol,
            blockChain: blockchain
        }

        return await this.postWithValidate("/contracts/v1/deploy", deployRequest, validateResponse);
    }
    public async freezeToken(symbol: any, status: boolean, blockchain: string | null = null, validateResponse: boolean = false) {
        debugL2('freeze token');

        this.err = null;
        const request = {
            "symbol": symbol,
            "enableFreeze": status
        }

        if (blockchain != null) {
            request['blockChain'] = blockchain;
        }

        return await this.postWithValidate("/contracts/v1/freeze", request, validateResponse);
    }

    public async issueTokens(symbol: any, issueAmount: string, firmId: string | null = null, validateResponse: boolean = false) {
        debugL2('issue tokens');

        this.err = null;
        const issueRequest = {
            "symbol": symbol,
            "issueAmount": issueAmount
        }

        if (firmId != null) {
            issueRequest['firmId'] = firmId;
        }

        return await this.postWithValidate("/contracts/v1/issue", issueRequest, validateResponse);
    }

    public async burnTokens(symbol: any, burnAmount: string, firmId: string | null = null, validateResponse: boolean = false) {
        debugL2('burn tokens');

        this.err = null;
        const burnRequest = {
            "symbol": symbol,
            "burnAmount": burnAmount
        }

        if (firmId != null) {
            burnRequest['firmId'] = firmId;
        }

        return await this.postWithValidate("/contracts/v1/burn", burnRequest, validateResponse);
    }

    public async createTransferRestriction(createTransferRestrictionRequest: any, validateResponse: boolean = false) {
        debugL2('create TransferRestriction');

        this.err = null;

        return await this.postWithValidate("/refdata/v1/transfer-restrictions", createTransferRestrictionRequest, validateResponse);
    }

    public async getTransferRestriction(instanceId: any, validateResponse: boolean = false) {
        debugL2('get TransferRestriction');

        this.err = null;
        const params: UrlParams = {
            pathParams: {
                instanceId
            }
        }

        return await this.getWithValidate("/refdata/v1/transfer-restrictions/{instanceId}", params, validateResponse);
    }

    public async updateTransferRestriction(updateTransferRestrictionPayload: any, instanceId: any, validateResponse: boolean = false) {
        debugL2('update TransferRestriction');

        this.err = null;
        const params: UrlParams = {
            pathParams: {
                instanceId
            }
        }

        return await this.putWithValidate("/refdata/v1/transfer-restrictions/{instanceId}", updateTransferRestrictionPayload, validateResponse, params);
    }
    public async getToken(instanceId: any, validateResponse: boolean = false) {
        debugL2('get token');

        this.err = null;
        const params: UrlParams = {
            pathParams: {
                instanceId
            }
        }
        return await this.getWithValidate("/refdata/v1/instruments/{instanceId}", params, validateResponse);
    }

    public async createAuction(auctionRequest: any, validateResponse: boolean = false) {
        auctionRequest.requestId = this.nextId();
        debugL2('submitting auction creation request ' + JSON.stringify(auctionRequest));

        let result = await this.postWithValidate("/auction/v1/primary-auction", auctionRequest, validateResponse);
        return result;
    }

    public async modifyAuction(auctionRequest: any, validateResponse: boolean = false) {
        auctionRequest.requestId = this.nextId();
        debugL2('submitting auction modify request ' + JSON.stringify(auctionRequest));

        let result = await this.putWithValidate("/auction/v1/primary-auction", auctionRequest, validateResponse);
        return result;
    }

    public async cancelAuction(auctionRequest: any, validateResponse: boolean = false) {
        auctionRequest.requestId = this.nextId();
        debugL2('submitting auction cancellation request ' + JSON.stringify(auctionRequest));

        let result = await this.deleteWithValidate("/auction/v1/primary-auction", auctionRequest, validateResponse);
        return result;
    }

    public async queryAuctions(queryRequest: any, validateResponse: boolean = false) {
        // queryRequest.requestId = this.nextId();
        debugL2('submitting auction query request ' + JSON.stringify(queryRequest));

        let result = await this.postWithValidate("/auction/v1/primary-auction/query", queryRequest, validateResponse);
        return result;
    }

    public async querySubmittedBids(query: any) {
        debugL2('query orders query=' + JSON.stringify(query));

        this.err = null;
        try {
            const response: APIResponse = await this.client.post(getAdminApiUrl('/order/v1/query/'), query);
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));
            return responseBody;
        } catch (err: any) {
            debugL3('Error: ', err);
            debugL1('error: (' + err.status + ')\n' + JSON.stringify(err));
            this.err = err;
            return err.message;
        }
    }

    public async redeemTokensResponse(reference: string, response: string, validateResponse: boolean = false) {
        debugL2('send redemption response');
        const request = {
            requestId: uuidv4(),
            reference,
            response
        };

        return await this.putWithValidate("token-redeem-response", request, validateResponse);
    }

    public async issueTokenSelfCare(assetId: any, request: any, validateResponse: boolean = false) { //TODO:rename function
        debugL2(`issue self care issuer cash tokens with body: ${JSON.stringify(request)}`);

        const params: UrlParams = {
            pathParams: {
                assetId
            }
        }

        return await this.putWithValidate("/corda/v1/asset/{assetId}/issue", request, validateResponse, params);
    }

    public async redeemTokenIssuer(assetId: any, request: any, validateResponse: boolean = false) {
        debugL2(`redeem tokens from another issuer firm with body: ${JSON.stringify(request)}`);
        const params: UrlParams = {
            pathParams: {
                assetId
            }
        }
        return await this.putWithValidate("/corda/v1/asset/{assetId}/redeem", request, validateResponse, params);
    }

    public async redeemAcceptTokenSelfCare(assetId: any, request: any, validateResponse: boolean = false) { //TODO:rename function
        debugL2(`redeem accept tokens with body: ${JSON.stringify(request)}`);

        const params: UrlParams = {
            pathParams: {
                assetId
            }
        }

        return await this.putWithValidate("/corda/v1/asset/{assetId}/redeem/acceptance", request, validateResponse, params);
    }

    public async redeemRejectSCTokenSelfCare(assetId: any, request: any, validateResponse: boolean = false) { //TODO:rename function
        debugL2(`redeem reject tokens with body: ${JSON.stringify(request)}`);

        const params: UrlParams = {
            pathParams: {
                assetId
            }
        }

        return await this.putWithValidate("/corda/v1/asset/{assetId}/redeem/rejection", request, validateResponse, params);
    }

    public async createCorporateAction(request: any, validateResponse: boolean = false) {
        debugL2(`create corporate action with body:: ${JSON.stringify(request)}`);

        return await this.postWithValidate("/ca/v1/corporate-action", request, validateResponse);
    }

    public async cancelCorporateAction(corporateActionId: any, validateResponse: boolean = false) {
        debugL2(`delete corporate action with id:: ${JSON.stringify(corporateActionId)}`);

        const params: UrlParams = {
            pathParams: {
                corporateActionId
            }
        }

        return await this.deleteWithValidate("/ca/v1/corporate-action/{corporateActionId}", {}, validateResponse, params);
    }

    public async manageCorporateAction(request: any, validateResponse: boolean = false) {
        debugL2(`manage corporate action with body:: ${JSON.stringify(request)}`);

        return await this.postWithValidate("/ca/v1/management", request, validateResponse);

    }

    public async queryCorporateAction(request: any = {}, validateResponse: boolean = false) {
        debugL2(`query corporate action with body:: ${JSON.stringify({})}`);

        return await this.postWithValidate("/ca/v1/corporate-action-query", request, validateResponse);

    }

    public async getHor(corporateActionId: any, validateResponse: boolean = false) {
        debugL2('get hor by corporate action Id');

        this.err = null;
        const params: UrlParams = {
            pathParams: {
                corporateActionId
            }
        }

        return await this.getWithValidate("/ca/v1/hor/{corporateActionId}", params, validateResponse);
    }

    public async getEntitlements(request: any, validateResponse: boolean = false) {
        debugL2(`get entitlements with body:: ${JSON.stringify(request)}`);

        return await this.postWithValidate("/ca/v1/entitlement", request, validateResponse);

    }

    public async getCAHistory(corporateActionId: any, validateResponse: boolean = false) {
        debugL2('get corporate action history by corporate action Id');

        this.err = null;
        const params: UrlParams = {
            pathParams: {
                corporateActionId
            }
        }

        return await this.getWithValidate("/ca/v1/corporate-action-history/{corporateActionId}", params, validateResponse);
    }

    public async grantUserPrivilege(role: string, permissionGroup: string, permissionCode: string) {
        let lastRequest = await this.getRole(role);
        for (let i: number = 0; i < lastRequest.payload.permissions.length; i++) {
            if (lastRequest.payload.permissions[i].permissionCode == permissionGroup) {
                if (!lastRequest.payload.permissions[i].grant.includes(permissionCode)) {
                    lastRequest.payload.permissions[i].grant.push(permissionCode);
                    return await this.updateRole(role, lastRequest.payload)
                }
            }
        }
    }

    public async revokeUserPrivilege(role: string, permissionGroup: string, permissionCode: string) {
        let lastRequest = await this.getRole(role);
        for (let i: number = 0; i < lastRequest.payload.permissions.length; i++) {
            if (lastRequest.payload.permissions[i].permissionCode == permissionGroup) {
                if (lastRequest.payload.permissions[i].grant.includes(permissionCode)) {
                    let index = lastRequest.payload.permissions[i].grant.indexOf(permissionCode)
                    lastRequest.payload.permissions[i].grant.splice(index, 1)
                    return await this.updateRole(role, lastRequest.payload)
                }
            }
        }
    }

    public async queryChats(query: any) {
        debugL2('query chats query=' + JSON.stringify(query));

        this.err = null;
        try {
            const response: APIResponse = await this.client.post(getAdminApiUrl('/chat/v1/query'), query);
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));
            return responseBody;
        } catch (err: any) {
            debugL3('Error: ', err);
            debugL1('error: (' + err.status + ')\n' + JSON.stringify(err));
            this.err = err;
            return err.message;
        }
    }

    public async exportDeals(query: any) {
        debugL2('export deals query=' + JSON.stringify(query));

        this.err = null;
        try {
            const response: APIResponse = await this.client.post(getAdminApiUrl('/trade/v1/deal-export'), query);
            const responseBody = await response.json();
            debugL3('response:\n' + JSON.stringify(responseBody));
            return responseBody;
        } catch (err: any) {
            debugL3('Error: ', err);
            debugL1('error: (' + err.status + ')\n' + JSON.stringify(err));
            this.err = err;
            return err.message;
        }
    }

    public async subscribeForGeneralData(options?: any) {


        let request = this.socket.subscribeForGeneralData();
        let response = JSON.parse(JSON.stringify(request));
        response['status'] = 'OK';
        await this.socket.expect(response);

        debugL1("------------- subscription success-------------------------")
        this.socket.clear();
    }

    public async subscribeForDownstream(options?: any) {

        let request = this.socket.subscribeForDownstream();
        console.log("request : ", request);
        let response = JSON.parse(JSON.stringify(request));
        console.log("response : ", response);
        response['status'] = 'OK';
        await this.socket.expect(response);

        debugL1("------------- subscription success-------------------------")
        this.socket.clear();
    }

    public async postSystemTransferQuery(data: any, validateResponse: boolean = false) {
        debugL2('posting system transfer query');
        return await this.postWithValidate("/position/v1/transfer-query", data, validateResponse);
    }

    public async postBlockchainTransferQuery(data: any, validateResponse: boolean = false) {
        debugL2('posting blockchain transfer query');
        return await this.postWithValidate("/contracts/v1/transfer-query", data, validateResponse);
    }

    public async sendMassCancelBulletinBoard(massCancelRequest: any, validateResponse: boolean = false) {
        debugL2('mass cancelling indicative- ', massCancelRequest);
        return await this.postWithValidate("/indication/v1/mass-cancel/", { requestId: this.nextId(), ...massCancelRequest }, validateResponse);
    }

    public async sendFixGatewayControllMessage(action: string, gateway: string, validate?: boolean) {
        const payload = {
            "action": action,
            "interfaceId": gateway
        }

        debugL2('mass cancelling indicative- ', payload);
        return await this.putWithValidate("api/gateway/v1/client-gateway-control", payload, validate);
    }

    public async cancelOrder(order: any, validateResponse: boolean = false) {
        order.requestUserId = this.getUsername();
        order.requestId = this.nextId();
        debugL2('cancelling order ' + JSON.stringify(order));

        return await this.deleteWithValidate("/order/v1", order, validateResponse);
    }

    public async cancelQuote(quoteCancel: any, validateResponse: boolean = false) {
        quoteCancel.requestId = this.nextId();
        quoteCancel.requestUserId = this.getUsername();
        debugL2('cancelling quote' + JSON.stringify(quoteCancel));

        return await this.deleteWithValidate("/indication/v1/", quoteCancel, validateResponse);
    }

    public async cancelTrade(requestBody: any, validateResponse: boolean = false) {
        requestBody.requestId = this.nextId();
        requestBody.cancelAction = 'CANCEL_REQUEST';
        requestBody.reason = 'E2E testing'
        debugL2('submitting cancel trade ' + JSON.stringify(requestBody));

        let result = await this.deleteWithValidate("/trade/v1/trade-report", requestBody, validateResponse);
        return result;
    }

    public async sendWebsocketMessage(message: any) {
        this.socket.send(message);
    }

    public async acceptOrRejectTransactions(data: any, validateResponse: boolean = false) {
        debugL2('Transactions ' + JSON.stringify(data));
        return await this.postWithValidate("/integrations/v1/transaction", data, validateResponse);
    }

    public async projects(data: any, validateResponse: boolean = false) {
        debugL2('projects ' + JSON.stringify(data));
        return await this.postWithValidate("/refdata/v1/projects/", data, validateResponse);
    }

    public async getProject(projectId: string) {
        debugL2('get project projectId=' + projectId);
        return this.get('/refdata/v1/projects/', projectId);
    }

    public async updateProject(projectId: any, request: any, validateResponse: boolean = false) {
        debugL2('update project projectId=' + projectId + ', request=' + JSON.stringify(request));
        const params: UrlParams = {
            pathParams: {
                projectId
            }
        }
        return await this.putWithValidate("/refdata/v1/projects/{projectId}", request, validateResponse, params);
    }

    public async registries(data: any, validateResponse: boolean = false) {
        debugL2('registries ' + JSON.stringify(data));
        return await this.postWithValidate("/refdata/v1/registries/", data, validateResponse);
    }

    public async getRegistries(registryName: string) {
        debugL2('get Registry registryName=' + registryName);
        return this.get('/refdata/v1/registries/', registryName);
    }

    public async updateRegistries(registryName: any, request: any, validateResponse: boolean = false) {
        debugL2('update Registry registryName=' + registryName + ', request=' + JSON.stringify(request));
        const params: UrlParams = {
            pathParams: {
                registryName
            }
        }
        return await this.putWithValidate("/refdata/v1/registries/{registryName}", request, validateResponse, params);
    }

    public async sendGatewayControllMessage(action: string, gateway: string, requestId: string, validate?: boolean) {
        const payload = {
            "requestId": requestId,
            "action": action,
            "interfaceId": gateway
        }
        debugL2('Sending Gateway Control message ', payload);
        return await this.putWithValidate("/gateway/v1/client-gateway-control", payload, validate);

    }

    public async updateMarketData(marketId:string, symbol:string, field:string, value:any, validate?:boolean) {
        const payload = {
            "marketData": field,
            "value": value
        }
        
        debugL2('Updating Market Data:', payload);
        return await this.putWithValidate(`/market-data/v1/stat?marketId=${marketId}&symbol=${symbol}`, payload, validate);
    }

    public async uploadProject(data: any, validateResponse: boolean = false) {
        const payload = {
            "payload": data
        }
        debugL2('upload project ' + JSON.stringify(data));
        return await this.postWithValidate("/integrations/v1/projects", payload, validateResponse);
    }

}