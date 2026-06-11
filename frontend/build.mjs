import { cpSync, createWriteStream, mkdirSync, rmSync } from 'node:fs';
import https from 'node:https';
import path from 'node:path';

const VENDOR_DIR = 'src/assets/vendor';
const VENDORS = [
    ['https://cdn.jsdelivr.net/npm/jquery@3.6.4/dist/jquery.min.js', 'jquery.min.js'],
    ['https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js', 'bootstrap.bundle.min.js'],
    ['https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js', 'chart.min.js'],
    ['https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/js/adminlte.min.js', 'adminlte.min.js']
];

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

rmSync('dist', { recursive: true, force: true });
mkdirSync(VENDOR_DIR, { recursive: true });

for (const [url, name] of VENDORS) {
    const target = path.join(VENDOR_DIR, name);
    await download(url, target);
    console.log('vendor downloaded:', name);
}

mkdirSync('dist', { recursive: true });
cpSync('src', 'dist', { recursive: true });
