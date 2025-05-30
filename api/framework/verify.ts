import { expect } from '@playwright/test';
const debugL3 = require('debug')('fw-L3-verify');

function _equals(expected: any, actual: any) {
    if (expected == null) {
        expect(actual).toBeNull();
        return;
    }

    if (typeof expected === 'boolean') {
        expect(actual).toBe(expected);
        return;
    }

    if (typeof expected === 'number') {
        expect(actual).toBe(expected);
        return;
    }

    if (typeof expected === 'string') {
        if (expected === '${id}') {
            expect(actual).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
        } else if (expected === '${timestamp}') {
            expect(actual).toMatch(/^\d+$/);
        } else if (expected === '${uuid}') {
            expect(actual).toMatch(/^\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b$/);
        } else if (expected === '${address}') {
            expect(actual).toMatch(/^[A-Za-z0-9]{34,}$/);
        } else if (expected.startsWith('${or:')) {
            const values = expected.substring(5, expected.length - 1).split(':');
            expect(values).toContain(actual);
        } else if (expected.startsWith('${float:')) {
            const values = expected.substring(8, expected.length - 1).split(':');
            const target = parseFloat(values[0]);
            const tolerance = parseFloat(values[1]);
            const actualNum = typeof actual === 'number' ? actual : parseFloat(actual);
            expect(actualNum).toBeCloseTo(target, tolerance);
        } else {
            expect(actual).toBe(expected);
        }

        return;
    }

    for (let key in expected) {
        if (expected[key] != null && Array.isArray(expected[key])) {
            for (let i = 0; i < expected[key].length; i++) {
                _equals(expected[key][i], actual[key][i]);
            }
        } else if (expected[key] != null && typeof expected[key] === 'object') {
            _equals(expected[key], actual[key]);
        } else {
            _equals(expected[key], actual[key]);
        }
    }
}

export function equals(expected: any, actual: any) {
    debugL3('equals: EXPECTED=' + JSON.stringify(expected));
    debugL3('equals:   ACTUAL=' + JSON.stringify(actual));
    try {
        _equals(expected, actual);
        return true;
    } catch (err) {
        throw new Error('caught error in _equals(): ' + err);
    }
}

export function contains(expected: any[], actual: any[]) {
    debugL3('contains: EXPECTED=' + JSON.stringify(expected));
    debugL3('contains:   ACTUAL=' + JSON.stringify(actual));

    for (let i = 0; i < expected.length; i++) {
        debugL3('------>contains: CHECKING [' + i + ']th of EXPECTED=' + JSON.stringify(expected[i]));
        let match = false;

        for (let j = 0; j < actual.length; j++) {
            debugL3('----------->WITH [' + j + ']th of ACTUAL ' + JSON.stringify(actual[j]));
            if (compare(expected[i], actual[j])) {
                debugL3('-------------- MATCHED ----------------');
                match = true;
                break;
            }
        }
        expect(match).toBe(true);
    }
}

export function doesNotContain(expected: any[], actual: any[]) {
    debugL3('doesNotContain: NOT_EXPECTED=' + JSON.stringify(expected));
    debugL3('doesNotContain:   ACTUAL=' + JSON.stringify(actual));

    for (let i = 0; i < expected.length; i++) {
        debugL3('------>doesNotContain: CHECKING [' + i + ']th of EXPECTED=' + JSON.stringify(expected[i]));
        let match = false;

        for (let j = 0; j < actual.length; j++) {
            debugL3('----------->WITH [' + j + ']th of ACTUAL ' + JSON.stringify(actual[j]));
            if (compare(expected[i], actual[j])) {
                debugL3('-------------- MATCHED ----------------');
                match = true;
                break;
            }
        }
        expect(match).toBe(false);
    }
}

export function compare(expected: any, actual: any): boolean {
    debugL3('compare: EXPECTED=' + JSON.stringify(expected));
    debugL3('compare:   ACTUAL=' + JSON.stringify(actual));

    try {
        return _compare(expected, actual);
    } catch (err) {
        debugL3('caught error in _compare()', err);
        return false;
    }
}

function _compare(expected: any, actual: any, log: boolean = false): boolean {
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
        if (expected === '${id}') {
            return /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(actual);
        } else if (expected === '${timestamp}') {
            return /^\d+$/.test(actual.toString());
        } else if (expected === '${uuid}') {
            return /^\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b$/.test(actual);
        } else if (expected.startsWith('${or:')) {
            const values = expected.substring(5, expected.length - 1).split(',');
            return values.includes(actual);
        } else if (expected === '${string}') {
            return typeof actual === 'string';
        }
        return actual == expected;
    }

    for (let key in expected) {
        if (!actual) {
            return false;
        }

        if (expected[key] != null && Array.isArray(expected[key])) {
            if (!actual[key]) {
                return false;
            }

            for (let i = 0; i < expected[key].length; i++) {
                if (!_compare(expected[key][i], actual[key][i], true)) {
                    return false;
                }
            }
        } else if (expected[key] != null && typeof expected[key] === 'object') {
            if (!_compare(expected[key], actual[key], true)) {
                return false;
            }
        } else {
            if (!_compare(expected[key], actual[key], true)) {
                return false;
            }
        }
    }

    return true;
}
