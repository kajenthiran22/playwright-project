const chai = require('chai');
const debugL3 = require('debug')('fw-L3-verify');

function _equals(expected: any, actual: any) {
    if (expected == null) {
        chai.expect(actual).to.be.null;
        return;
    }

    if (typeof expected === 'boolean') {
        chai.expect(actual).to.equal(expected);
        return;
    }

    if (typeof expected === 'number') {
        chai.expect(actual).to.equal(expected);
        return;
    }

    if (typeof expected === 'string') {
        if (expected == '${id}') {
            chai.expect(actual).to.match(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
        }
        else if (expected == '${timestamp}') {
            chai.expect(actual).to.match(/^\d+$/);
        }
        else if (expected == '${uuid}') {
            chai.expect(actual).to.match(/^\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b$/);
        }
        else if (expected == '${address}') {
            chai.expect(actual).to.match(/^[A-Za-z0-9]{34,}$/);
        }
        else if (expected.startsWith('${or:')) {
            const values = expected.substr(5, expected.length - 6).split(':');
            chai.expect(values).to.include(actual);
        }
        else if (expected.startsWith('${float:')) {
            const values = expected.substr(8, expected.length - 9).split(':');
            chai.expect(typeof actual === 'number' ? actual : parseFloat(actual))
                .to.be.closeTo(parseFloat(values[0]), parseFloat(values[1]));
        }
        else {
            chai.expect(actual).to.equal(expected);
        }

        return;
    }

    for (let key in expected) {
        if ((expected[key] != null) && (Array.isArray(expected[key]))) {
            for (let i = 0; i < expected[key].length; i++) {
                _equals(expected[key][i], actual[key][i]);    
            }
        }
        else if ((expected[key] != null) && (typeof expected[key] == 'object')) {
            _equals(expected[key], actual[key]);
        }
        else {
            _equals(expected[key], actual[key]);
        }
    }
}

export function equals(expected: any, actual: any) {
    debugL3('equals: EXPECTED=' + JSON.stringify(expected))
    debugL3('equals:   ACTUAL=' + JSON.stringify(actual));
    try{
        _equals(expected, actual);
        return true;
    }
    catch(err){
        chai.expect.fail('caught error in _equals()'+err)
        return false;
    }
}

export function contains(expected: any, actual: any) {
    debugL3('contains: EXPECTED=' + JSON.stringify(expected))
    debugL3('contains:   ACTUAL=' + JSON.stringify(actual));

    for (let i = 0; i < expected.length; i++) {
        debugL3('------>contains: CHECKING ['+ i + '] th of EXPECTED=' + JSON.stringify(expected[i]) );
        let match = false;

        for (let j = 0; j < actual.length; j++) {
            debugL3('----------->WITH '+'[' + j + ']th of ACTUAL ' + JSON.stringify(actual[j]));
            if (compare(expected[i], actual[j])) {
                debugL3('-------------- MATCHED ----------------');
                match = true;
                break;
            }
        }
        chai.expect(match).to.be.equal(true);
    }
}

export function doesNotContain(expected: any, actual: any) {
    debugL3('doesNotContain: NOT_EXPECTED=' + JSON.stringify(expected))
    debugL3('doesNotContain:   ACTUAL=' + JSON.stringify(actual));

    for (let i = 0; i < expected.length; i++) {
        debugL3('------>doesNotContain: CHECKING ['+ i + '] th of EXPECTED=' + JSON.stringify(expected[i]) );
        let match = false;

        for (let j = 0; j < actual.length; j++) {
            debugL3('----------->WITH '+'[' + j + ']th of ACTUAL ' + JSON.stringify(actual[j]));
            if (compare(expected[i], actual[j])) {
                debugL3('-------------- MATCHED ----------------');
                match = true;
                break;
            }
        }
        chai.expect(match).to.be.equal(false);
    }
}

export function compare(expected: any, actual: any): boolean {
    debugL3('compare: EXPECTED=' + JSON.stringify(expected))
    debugL3('compare:   ACTUAL=' + JSON.stringify(actual));

     try{
        return _compare(expected, actual)
    }
    catch(err){
        debugL3('caught error in _compare()', err)
        return false
    }
}

function _compare(expected: any, actual: any, log:boolean=false): boolean {
    if (log == true ){
    //    debugL3('<<<<<<<<<<<>>>>>>>>>>>>>>>--- compare-int --: EXPECTED=' + JSON.stringify(expected))
    //    debugL3('<<<<<<<<<<<>>>>>>>>>>>>>>>--- compare-int --:   ACTUAL=' + JSON.stringify(actual));
    }
    if (expected == null) {
        return actual == null;
    }

    if (typeof expected === 'boolean') {
        return actual == expected;
    }

    if (typeof expected === 'number') {
        return actual == expected;
    }

    if (typeof expected === 'string') {
        if (expected == '${id}') {
            return actual.match(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
        }
        else if (expected == '${timestamp}') {
            return actual.toString().match(/^\d+$/);
        }
        else if (expected == '${uuid}') {
            return actual.match(/^\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b$/);
        }
        else if (expected.startsWith('${or:')) {
            const values = expected.substr(5, expected.length - 6).split(',');
            for (let i = 0; i < values.length; i++) {
                if (values[i] == actual) {
                    return true;
                }
            }

            return false;
        }
        else if(expected == '${string}') {
            return typeof actual == 'string';
        }

        return actual == expected;
    }

    for (let key in expected) {
        // when nested object is null or undefined
        if (!actual) {
            return false;
        }

        if ((expected[key] != null) && (Array.isArray(expected[key]))) {
            if (!actual[key]) {
                return false;
            }
            
            for (let i = 0; i < expected[key].length; i++) {
                if (!_compare(expected[key][i], actual[key][i], true)) {
                    return false;
                }
            }
        }
        else if ((expected[key] != null) && (typeof expected[key] == 'object')) {
            if (!_compare(expected[key], actual[key], true)) {
                return false;
            }
        }
        else {
            if (!_compare(expected[key], actual[key], true)) {
                return false;
            }
        }
    }

    return true;
}
