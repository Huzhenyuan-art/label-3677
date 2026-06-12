import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import crypto from 'node:crypto';
import https from 'node:https';
import path from 'node:path';

const VENDOR_DIR = 'src/assets/vendor';
const DIST_VENDOR_DIR = 'dist/assets/vendor';

const VENDORS = [
    {
        url: 'https://cdn.jsdelivr.net/npm/jquery@3.6.4/dist/jquery.min.js',
        file: 'jquery.min.js',
        integrity: 'sha256-oP6HI9z1XaZNBrJURtCoUT5SUnxFr8s3BzRl+cbzUq8='
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js',
        file: 'bootstrap.bundle.min.js',
        integrity: 'sha256-CyDLUtsGp7AMAiM6pBFezxK7VOdWMT/4orV1OR7GY4='
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js',
        file: 'chart.min.js',
        integrity: 'sha256-7Nj5PdligjzGrD5sygRQvQ00Y5H8YtWv0wj6zN9D/9Q='
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/js/adminlte.min.js',
        file: 'adminlte.min.js',
        integrity: 'sha256-bP8mN5W6WaR3hsS5mRJ0oHj7xNSk66Jj8M6r0P3t1Eo='
    }
];

const VENDOR_MANIFEST = 'vendor-manifest.json';

function download(url, dest) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return download(res.headers.location, dest).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                reject(new Error('Download failed: ' + url + ' status=' + res.statusCode));
                return;
            }

            const file = createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
            file.on('error', reject);
        }).on('error', reject);
    });
}

function computeSRI(filePath) {
    const buf = readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(buf).digest('base64');
    return 'sha256-' + hash;
}

rmSync('dist', { recursive: true, force: true });
mkdirSync(VENDOR_DIR, { recursive: true });

const manifest = [];

for (const vendor of VENDORS) {
    const target = path.join(VENDOR_DIR, vendor.file);

    if (existsSync(target)) {
        const existingSRI = computeSRI(target);
        if (existingSRI === vendor.integrity) {
            console.log('vendor cached (integrity ok):', vendor.file);
            manifest.push({ file: vendor.file, version: vendor.url.match(/@([^/]+)/)?.[1] || 'unknown', integrity: vendor.integrity });
            continue;
        } else {
            console.log('vendor integrity mismatch, re-downloading:', vendor.file);
        }
    }

    await download(vendor.url, target);
    const actualSRI = computeSRI(target);

    if (vendor.integrity && actualSRI !== vendor.integrity) {
        console.warn('WARNING: Integrity mismatch for', vendor.file);
        console.warn('  Expected:', vendor.integrity);
        console.warn('  Actual:  ', actualSRI);
        console.warn('  If this is an intentional update, update the integrity in build.mjs');
    }

    console.log('vendor downloaded:', vendor.file, 'SRI:', actualSRI);
    manifest.push({ file: vendor.file, version: vendor.url.match(/@([^/]+)/)?.[1] || 'unknown', integrity: actualSRI });
}

writeFileSync(VENDOR_MANIFEST, JSON.stringify(manifest, null, 2));
console.log('vendor manifest written to', VENDOR_MANIFEST);

mkdirSync('dist', { recursive: true });
cpSync('src', 'dist', { recursive: true });
