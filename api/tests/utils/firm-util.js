const { equals } = require('../../framework/verify');

function firmReq(firmId, name, status, type, ref_ver, ref_seq, lei, firmIdx, clearingMember, ccpAccount) {
    let request = {
        firmId: firmId,
        name: name,
        status: status,
        ref_ver: ref_ver,
        ref_seq: ref_seq,
        type: type,
        ccpAccount: ccpAccount,
        clearingMember: clearingMember
    };

    if (firmIdx) {
        request.idx = firmIdx;
    }
    return request;
}

async function updateFirm(firmId, name, status, type, ref_ver, ref_seq, lei, firmIdx, clearingMember, ccpAccount, adminSession) {
    const request = firmReq(firmId, name, status, type, ref_ver, ref_seq, lei, firmIdx, clearingMember, ccpAccount);
    const expectedResponse = {status: 'OK', payload: {firmId: firmId}};
    const actualResponse = await adminSession.updateFirm(firmId, request);
    equals(expectedResponse, actualResponse);
}

module.exports = {
    updateFirm,
    firmReq
};