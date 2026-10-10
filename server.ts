import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import nodemailer from "nodemailer";
// Using native fetch available in Node 18+

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Contact API to receive quick messages directly and dispatch via SMTP
  app.post("/api/contact", async (req, res) => {
    const { name, email, message } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing required fields: name, email, or message" });
    }

    let mailSent = false;
    let mailError = null;

    try {
      console.log(`[CONTACT] Message received from ${name} (${email}): ${message}`);
      
      // 1. Persist the message locally in messages.json for consistency
      const filePath = path.join(process.cwd(), "messages.json");
      let messages = [];
      
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, "utf8");
          messages = JSON.parse(content);
        } catch (readErr) {
          console.error("[CONTACT] Failed to parse messages.json", readErr);
        }
      }

      messages.push({
        id: Date.now().toString(),
        name,
        email,
        message,
        timestamp: new Date().toISOString()
      });

      fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), "utf8");
      
      // 2. Dispatch the email using Nodemailer SMTP if credentials are configured
      const host = process.env.SMTP_HOST;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const port = process.env.SMTP_PORT;
      const recipient = process.env.CONTACT_RECIPIENT_EMAIL || "chat.ilayaraja@gmail.com";

      if (host && user && pass) {
        try {
          const transporter = nodemailer.createTransport({
            host: host,
            port: Number(port) || 587,
            secure: Number(port) === 465,
            auth: {
              user: user,
              pass: pass
            }
          });

          const mailOptions = {
            from: `"${name}" <${user}>`, // Standard custom SMTP sender using authenticated SMTP account
            replyTo: email,
            to: recipient,
            subject: `New Portfolio Message from ${name}`,
            text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #2563eb; margin-top: 0; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">New Message from Portfolio</h2>
                <p>You have received a new contact submission from your project portfolio.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <tr style="background-color: #f9fafb;">
                    <td style="padding: 10px; font-weight: bold; width: 120px; border-bottom: 1px solid #f1f5f9;">Sender Name:</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">${name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">Sender Email:</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${email}">${email}</a></td>
                  </tr>
                  <tr style="background-color: #f9fafb;">
                    <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">Timestamp:</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">${new Date().toLocaleString()}</td>
                  </tr>
                </table>
                <div style="background-color: #fafafa; padding: 15px; border-left: 4px solid #2563eb; margin-top: 20px; border-radius: 0 4px 4px 0;">
                  <strong>Message:</strong>
                  <p style="white-space: pre-wrap; line-height: 1.5; margin: 8px 0 0 0;">${message}</p>
                </div>
              </div>
            `
          };

          await transporter.sendMail(mailOptions);
          mailSent = true;
          console.log(`[CONTACT] Real Email successfully dispatched to ${recipient}`);
        } catch (mailErr: any) {
          console.error("[CONTACT] Failed to send email via SMTP:", mailErr);
          mailError = mailErr.message || mailErr;
        }
      } else {
        console.log(`[CONTACT] SMTP not configured. Utilizing direct server-side delivery to ${recipient}`);
        try {
          const response = await fetch(`https://formsubmit.co/ajax/${recipient}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              name,
              email,
              message,
              _subject: `New Portfolio Message from ${name}`
            })
          });

          if (response.ok) {
            const data: any = await response.json();
            if (data.success === "true" || data.success === true) {
              mailSent = true;
              console.log("[CONTACT] Real Email sent via FormSubmit directly to " + recipient);
            } else {
              mailError = data.message || "FormSubmit rejected submission";
              console.error("[CONTACT] FormSubmit error response:", data);
            }
          } else {
            const errMsg = await response.text();
            mailError = `FormSubmit API returned HTTP status ${response.status}`;
            console.error("[CONTACT] FormSubmit HTTP failure:", response.status, errMsg);
          }
        } catch (fsErr: any) {
          mailError = fsErr.message || String(fsErr);
          console.error("[CONTACT] Direct FormSubmit dispatch exception:", fsErr);
        }
      }

      res.json({ 
        success: true, 
        message: mailSent ? "Message received and email dispatched!" : "Message received and persisted, but could not dispatch email.",
        mailSent,
        mailError,
        smtpConfigured: !!(host && user && pass)
      });
    } catch (err: any) {
      console.error("[CONTACT] Failed in processing endpoint:", err);
      res.status(500).json({ error: "Failed to process message", details: err.message });
    }
  });

  // API to retrieve messages persisted in messages.json
  app.get("/api/messages", async (req, res) => {
    try {
      const filePath = path.join(process.cwd(), "messages.json");
      let messages = [];
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8");
        try {
          messages = JSON.parse(content);
        } catch (jsonErr) {
          console.error("[CONTACT] JSON corrupted in messages.json", jsonErr);
        }
      }
      res.json(messages);
    } catch (err: any) {
      console.error("[CONTACT] Failed to read messages:", err);
      res.status(500).json({ error: "Failed to retrieve messages" });
    }
  });

  // Proxy for Google Drive Folders to list files from public folders
  app.get("/api/drive-folder", async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing folder id" });
    
    try {
      console.log(`[DRIVE] Scraping folder: ${id}`);
      const urls = [
        `https://drive.google.com/embeddedfolderview?id=${id}`,
        `https://drive.google.com/drive/folders/${id}`,
        `https://drive.google.com/drive/mobile/folders/${id}`
      ];
      
      let html = '';
      for (const url of urls) {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://drive.google.com/',
              'Cache-Control': 'no-cache'
            }
          });
          if (response.ok) {
            html = await response.text();
            // Look for indications that we have actual content
            if (html.includes('drive-viewer') || html.includes('flip-entry') || html.includes(id as string)) break;
          }
        } catch (e) {
          console.error(`[DRIVE] Fetch failed for ${url}`, e);
        }
      }

      if (!html) throw new Error("Could not fetch folder HTML from any source");

      const files: { id: string; name: string }[] = [];
      
      // Strategy 0: Parse modern embeddedfolderview split by flip-entry (extremely reliable for exact filenames)
      const parts = html.split('class="flip-entry"');
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const idMatch = part.match(/id="entry-([-_\w]{28,45})"/);
        const titleMatch = part.match(/<div class="flip-entry-title">([^<]+)<\/div>/);
        if (idMatch && titleMatch) {
          const fileId = idMatch[1];
          const fileName = titleMatch[1].trim();
          files.push({ id: fileId, name: fileName });
        }
      }
      
      // Strategy 1: Look for JSON-like metadata (most reliable for filenames)
      const jsonMatches = html.matchAll(/\["([-_\w]{28,45})","([^"]{1,100})"/g);
      for (const match of jsonMatches) {
        const fileId = match[1];
        const name = match[2];
        if (fileId !== id && fileId.length >= 28 && !name.includes('\\u') && !name.startsWith('http')) {
           const cleanName = name.replace(/\\x27/g, "'").replace(/\\x22/g, '"').trim();
           if (cleanName.length > 0 && !files.find(f => f.id === fileId)) {
             files.push({ id: fileId, name: cleanName });
           }
        }
      }

      // Strategy 1.5: Look for modern drive-viewer or data-JSON blocks
      const dataMatches = html.matchAll(/data-id="([-_\w]{28,45})"[^>]*?data-name="([^"]+)"/g);
      for (const match of dataMatches) {
        if (match[1] !== id && !files.find(f => f.id === match[1])) {
          files.push({ id: match[1], name: match[2].trim() });
        }
      }

      // Strategy 2: Extract from HTML elements with data-id or similar attributes
      const attrMatches = html.matchAll(/(?:data-id|id|data-drive-id|data-target)="([-_\w]{28,45})"[^>]*?(?:aria-label|title|alt)="([^"]+)"/g);
      for (const match of attrMatches) {
        const fileId = match[1];
        const name = match[2]?.trim();
        if (fileId !== id && fileId.length >= 28 && name && !files.find(f => f.id === fileId)) {
          files.push({ id: fileId, name });
        }
      }
      
      // Strategy 3: Specific patterns for modern Drive folder view
      const fileLinkMatches = html.matchAll(/\/file\/d\/([-_\w]{28,45})\/view/g);
      for (const match of fileLinkMatches) {
        const fileId = match[1];
        if (fileId !== id && !files.find(f => f.id === fileId)) {
          files.push({ id: fileId, name: `Image ${fileId.substring(0, 4)}` });
        }
      }

      // Strategy 3.5: Grid item titles often appear in JS arrays/variables
      const jsArrayMatches = html.matchAll(/,"([-_\w]{33})",\["([^"]+)"\]/g);
      for (const match of jsArrayMatches) {
        if (match[1] !== id && !files.find(f => f.id === match[1])) {
          files.push({ id: match[1], name: match[2].trim() });
        }
      }

      // Strategy 3.8: Specific logic for "aria-label" on role="gridcell"
      const gridMatches = html.matchAll(/role="gridcell"[^>]*?aria-label="([^"]+)"[^>]*?data-id="([-_\w]{28,45})"/g);
      for (const match of gridMatches) {
        if (match[2] !== id && !files.find(f => f.id === match[2])) {
          files.push({ id: match[2], name: match[1].trim() });
        }
      }

      // Strategy 4: Fallback - Aggressive ID extraction (Only runs if no files have been matched by cleaner strategies)
      if (files.length === 0) {
        const allIds = html.match(/[a-zA-Z0-9_-]{33}/g) || [];
        const uniqueIds = [...new Set(allIds)].filter(fid => 
          fid !== id && 
          !fid.includes('AF_') && 
          !fid.includes('init') && 
          !fid.startsWith('font-') &&
          !fid.includes('css') &&
          !fid.startsWith('AIzaSy') && // Skip API Keys
          !/^[0-9]{33}$/.test(fid) && 
          !files.find(f => f.id === fid)
        );
        
        uniqueIds.forEach(fid => {
          files.push({ id: fid, name: `File ${fid.substring(0, 4)}` });
        });
      }

      // Dedup results based on ID and prioritize those with better names if available
      const uniqueFilesMap = new Map();
      files.forEach(f => {
        const existing = uniqueFilesMap.get(f.id);
        if (!existing || (existing.name.startsWith('File ') && !f.name.startsWith('File '))) {
          uniqueFilesMap.set(f.id, f);
        }
      });
      
      const results = Array.from(uniqueFilesMap.values());
      console.log(`[DRIVE] Scraping complete for ${id}. Found ${results.length} files.`);
      res.json(results);
    } catch (error: any) {
      console.error("[DRIVE] Folder Proxy Error:", error);
      res.status(500).json({ error: "Failed to list drive folder files", details: error.message });
    }
  });

  // API to proxy Drive images for maximum reliability
  app.get("/api/drive-proxy/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

      // Try multiple fetch strategies in order
      const strategies = [
        // 1. Google User Content (lh3) - usually direct and fast
        `https://lh3.googleusercontent.com/d/${id}`,
        // 1.5. Alternate user content link
        `https://lh3.googleusercontent.com/u/0/d/${id}`,
        // 2. Direct uc export link
        `https://drive.google.com/uc?export=view&id=${id}`,
        // 2.5. Alternative export view
        `https://drive.google.com/uc?id=${id}&export=view`,
        // 3. Thumbnail (large size)
        `https://drive.google.com/thumbnail?id=${id}&sz=w1600`,
        // 3.5. Mobile thumbnail
        `https://drive.google.com/thumbnail?id=${id}&sz=w800`,
        // 4. Download link
        `https://drive.google.com/uc?id=${id}&export=download`
      ];

      for (const url of strategies) {
        try {
          const response = await fetch(url, { 
            headers: { 
              "User-Agent": userAgent,
              "Referer": "https://drive.google.com/"
            },
            redirect: 'follow'
          });
          
          if (response.ok) {
            const contentType = response.headers.get("content-type");
            // For thumbnails, content type might be generic but still an image
            if (contentType && (contentType.startsWith('image/') || url.includes('thumbnail'))) {
              res.setHeader("Content-Type", contentType.startsWith('image/') ? contentType : 'image/jpeg');
              res.setHeader("Cache-Control", "public, max-age=604800, immutable"); // Week long cache
              const buffer = await response.arrayBuffer();
              return res.send(Buffer.from(buffer));
            }
          }
        } catch (e) {
          console.warn(`[DRIVE] Strategy failed for ${url}`);
        }
      }

      res.status(404).json({ error: "Image not found or not accessible" });
    } catch (error) {
      console.error("[DRIVE] Proxy error:", error);
      res.status(500).json({ error: "Failed to proxy image" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
