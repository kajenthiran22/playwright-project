const concat = require('concat-stream');
const https = require('https')
const vm = require("vm");
const fs = require('fs').promises;
import { Readable } from "stream";
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

let EnvRegion = process.env.EnvRegion?? "local";
let envName = process.env.EnvName?? "local";
let accountId = process.env.AccountId?? "local";
let bucketName = `p8-${envName}-file-manager-storage-backup-${EnvRegion}-${accountId}`;

const s3 = new S3Client({
    region: EnvRegion
})

export async function fileDownloadFromS3(filePath: string): Promise<string> {
    const params = { Bucket: bucketName, Key: filePath };

    try {
        // Check if the object exists
        await s3.send(new HeadObjectCommand(params));

        console.log(`${filePath}: File exists, proceeding with download.`);

        // If exists, proceed with download
        const data = await s3.send(new GetObjectCommand(params));
        const bodyString = await streamToString(data.Body as Readable);
        
        console.log(`${filePath}: Successfully downloaded.`);
        return bodyString;
    } catch (error: any) {
        if (error.name === "NotFound") {
            throw new Error(`File not found: ${filePath}`);
        }
        throw new Error(`Error downloading file: ${error.message}`);
    }
}

export async function getFileNameList(filePath: string, fileExtension: string): Promise<string[]> {
    const params = { Bucket: bucketName, Prefix: filePath };

    try {
        const listResponse = await s3.send(new ListObjectsV2Command(params));

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            console.log(`${bucketName}: No files found on the bucket at filepath: ${bucketName}.`);
            return [];
        }
        const filteredFilesNames = listResponse.Contents
            .map(file => file.Key as string)
            .filter(key => !fileExtension || key.endsWith(fileExtension))
            .map(key => key.substring(key.lastIndexOf('/') + 1));

        return filteredFilesNames;
    } catch (error: any) {
        if (error.name === "NotFound") {
            throw new Error(`File not found: ${filePath}`);
        }
        throw new Error(`Error downloading file: ${error.message}`);
    }
}


export async function streamToString (stream: Readable): Promise<string> {
  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8"); // Convert to UTF-8 string
};

export enum ResponseStatus {
    OK="OK",
    REJECT="REJECT",
    FAILED="FAILED"
}

export function loadScript(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        };

        https.get(url, options, async (result, err) => {
            if (err) {
                reject(err);
            }
            result.pipe(
                concat({ encoding: 'string' }, source => {
                    let context = vm.createContext();
                    const script = new vm.Script(source);
                    script.runInNewContext(context);
                    resolve(context.awsConf)
                }));
        });
    });
}

export function expand(input: any[], key: string, values: any[]): any[] {
    let result: any[] = [];
    for (let i = 0; i < input.length; i++) {
        for (let j = 0; j < values.length; j++) {
            let object = JSON.parse(JSON.stringify(input[i]));
            object[key] = values[j];
            result.push(object);
        }
    }

    return result;
}

export function variants(schema: any): any[] {
    let result = [{}];
    for (let key in schema) {
        result = expand(result, key, schema[key]);
    }

    return result;
}

export function summarize(data: any[]): any[] {
    let summary: any[] = [];
    for (let key in data[0]) {
        if (key.startsWith('_')) {
            continue
        }
        let min = 0;
        let max = 0;
        let total = 0;
        for (let i = 0; i < data.length; i++) {
            if (i == 0) {
                min = data[i][key];
                max = data[i][key];
            }
            if (data[i][key] < min) {
                min = data[i][key];
            }
            if (data[i][key] > max) {
                max = data[i][key];
            }
            total += data[i][key];
        }

        summary.push({
            measure: key,
            min: min,
            max: max,
            average: Number((total / data.length).toFixed(0))
        });
    }

    return summary;
}

export async function csv(filename: string, data: any[]) {
    let handle = await fs.open(filename, 'w');

    let title = '';
    for (let key in data[0]) {
        title += (title == '' ? '' : ', ') + key;
    }

    await handle.write(title + '\n');

    for (let i = 0; i < data.length; i++) {
        let row = '';
        for (let key in data[0]) {
            row += (row == '' ? '' : ', ') + data[i][key];
        }

        await handle.write(row + '\n');
    }

    await handle.close();
}

export function partition(key: string) {
    const limit = 8;

    let sum = 0;
    for (let i = 0; i < key.length; i++) {
        sum += key.charCodeAt(i);
    }

    return sum % limit;
}

export async function sleep(millisec: number) {
    await new Promise(result => setTimeout(result, millisec));
}

export function formatValueForUrl(input: string) : string {
    return input.replace("/", "%2F").replace(" ", "%20");
}

export function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export function getRandomIndex(end: number) {
    return Math.floor(Math.random() * end);
}

export function getRandomNumber(start: number, end: number, step: number) {
    return Math.floor(Math.random() * ((end - start) / step)) * step + start;
}

export function getNumberByOrder(start: number, end: number, step: number, order: number) {
    let number = 0;
    if (order == 0) {
        number = start + step;
        if (number > end) {
            number = end;
        }
    } else if (order == 1) {
        number = end - step;
        if (number < start) {
            number = start;
        }
    } 

    return number;
}


export function toDecimal(num: string) {
    let preciseNum = 0;
    if (Number(num) && typeof num != 'boolean') {
        preciseNum = parseFloat(num);
    }
    return preciseNum.toFixed(2).toString();
}

export function getFormattedDate(date = new Date()) {
    //yyyy/mm/dd
    let y = date.getFullYear().toString();
    let m = (date.getMonth() + 1).toString();
    let d = date.getDate().toString();
    (d.length == 1) && (d = '0' + d);
    (m.length == 1) && (m = '0' + m);
    return (y +'/' + m + '/' + d);
}

export async function retry(func: any, attempts: number = 10, delay: number = 3000) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        if (await func()) {
            return true;
        }

        await new Promise(resolve => setTimeout(resolve, delay));
    }
           
    return false;
}
