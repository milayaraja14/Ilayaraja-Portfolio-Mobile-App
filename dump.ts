import fetch from 'node-fetch';

async function dumpFolders() {
  const folders: Record<string, string> = {
    'Certifications': '1G8uh69qbkM9uG3JRcRs3TKEe_QQlyVMY',
    'AI Workshop': '1qk5yYuQL2NA15WM8EyI0_s3qwFjVl3qU',
    'Gallery': '19OdxAqsvZxj-YKnzsW3IpYHdbZl-F5QL',
    'Honors & Awards': '1cTAp3aZSXMrKLJCl-HF2f2UV4x5lToVh',
    'Mentorship': '1zUFd3UdHz80yZuDQptk-XVI_7vwuyvv0',
    'Profile Images': '1r8i1gMKoOrB32I-gBg9NPguRPEkUG2qr'
  };

  const result: Record<string, any> = {};

  for (const [name, id] of Object.entries(folders)) {
    const url = 'https://drive.google.com/embeddedfolderview?id=' + id;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const files = [];
    const parts = html.split('class="flip-entry"');
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const idMatch = part.match(/id="entry-([-_\w]{28,45})"/);
      const titleMatch = part.match(/<div class="flip-entry-title">([^<]+)<\/div>/);
      if (idMatch && titleMatch) {
        files.push({ id: idMatch[1], name: titleMatch[1].trim() });
      }
    }
    result[id] = files;
    result[name] = files;
  }
  console.log(JSON.stringify(result, null, 2));
}
dumpFolders();
