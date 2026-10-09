// src/main.js
// バンドル先頭にバージョンログ（ビルド時に process.env.BUILD_VERSION を置換できます）
console.log('bundle version:', (typeof process !== 'undefined' && process.env && process.env.BUILD_VERSION) ? process.env.BUILD_VERSION : 'dev');

// エントリとして既存のアプリ本体を読み込む
import './app.js';
