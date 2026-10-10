import fetch from 'node-fetch';

async function check() {
  const SHEET_ID = '1CmYZxd1PsuDVEv5OkXMEDYp9Cntrd6jC';
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Hero`;
  const res = await fetch(sheetUrl);
  const text = await res.text();
  console.log('SHEET HERO TEXT:\n', text);

  const folderUrl = 'https://drive.google.com/embeddedfolderview?id=1r8i1gMKoOrB32I-gBg9NPguRPEkUG2qr';
  const folderRes = await fetch(folderUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    }
  });
  const folderHtml = await folderRes.text();
  console.log('FOLDER HTML LENGTH:', folderHtml.length);

  const matches = [...folderHtml.matchAll(/class="flip-entry"[\s\S]*?id="entry-([-_a-zA-Z0-9]{25,50})"[\s\S]*?class="flip-entry-title">([^<]+)</g)];
  console.log('FLIP ENTRY MATCHES:', matches.map(m => ({ id: m[1], name: m[2] })));

  const jsonMatches = [...folderHtml.matchAll(/\["([-_a-zA-Z0-9]{25,50})","([^"]{1,100})"/g)];
  console.log('JSON MATCHES:', jsonMatches.map(m => ({ id: m[1], name: m[2] })));
}

check();
