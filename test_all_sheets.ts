import fetch from 'node-fetch';

const SHEET_ID = '1CmYZxd1PsuDVEv5OkXMEDYp9Cntrd6jC';

async function test() {
  try {
    const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
    const html = await response.text();
    console.log("Analyzing spreadsheet tabs...");
    
    // Look for sheet names in the JSON/javascript configuration in the spreadsheet HTML
    // Usually names appear in "sheetName" or arrays: {"name":"Sheet1"}
    const regex = /"name"\s*:\s*"([^"]+)"/g;
    const matches = html.matchAll(regex);
    const sheetNames = new Set<string>();
    for (const match of matches) {
      if (match[1] && !match[1].startsWith('User ') && !match[1].startsWith('System ')) {
        sheetNames.add(match[1]);
      }
    }
    console.log("Found sheet tab names via primary regex:", [...sheetNames]);
    
    // Check if we can find them via 'gviz' JSON directly
    const categories = ['Certifications', 'AI Workshop', 'Honors & Awards', 'Gallery', 'Mentorship', 'Hero'];
    for (const cat of categories) {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(cat)}`);
      if (res.ok) {
        const text = await res.text();
        const firstRowIndex = text.indexOf('"c"');
        const hasSpecificLabel = text.toLowerCase().includes(cat.toLowerCase());
        console.log(`- Request for sheet "${cat}": has specific label in text? ${hasSpecificLabel}. Text length: ${text.length}`);
      }
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

test();
