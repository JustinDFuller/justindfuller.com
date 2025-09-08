#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs').promises;

class WebCrawler {
  constructor(startUrl) {
    this.startUrl = startUrl;
    this.baseUrl = new URL(startUrl);
    this.visited = new Set();
    this.allUrls = new Map(); // URL -> status code
    this.queue = [startUrl];
  }

  async crawl() {
    console.log(`Starting crawl from ${this.startUrl}`);
    
    while (this.queue.length > 0) {
      const url = this.queue.shift();
      
      if (this.visited.has(url)) {
        continue;
      }
      
      this.visited.add(url);
      
      try {
        const urlObj = new URL(url);
        
        // Only crawl pages from the same origin
        if (urlObj.origin === this.baseUrl.origin) {
          console.log(`Crawling: ${url}`);
          await this.crawlPage(url);
        } else {
          console.log(`External URL (not crawling): ${url}`);
        }
      } catch (error) {
        console.error(`Error processing ${url}:`, error.message);
      }
    }
    
    // Now check status codes for all collected URLs
    console.log('\nChecking status codes for all URLs...');
    await this.checkAllStatuses();
    
    return this.allUrls;
  }

  async crawlPage(url) {
    try {
      const html = await this.fetchPage(url);
      if (!html) return;
      
      const urls = this.extractUrls(html, url);
      
      for (const foundUrl of urls) {
        if (!this.allUrls.has(foundUrl)) {
          this.allUrls.set(foundUrl, null); // Will check status later
          
          // Only add to queue if it's from the same origin and not visited
          try {
            const foundUrlObj = new URL(foundUrl);
            if (foundUrlObj.origin === this.baseUrl.origin && !this.visited.has(foundUrl)) {
              this.queue.push(foundUrl);
            }
          } catch (e) {
            // Invalid URL, skip
          }
        }
      }
    } catch (error) {
      console.error(`Error crawling ${url}:`, error.message);
    }
  }

  extractUrls(html, baseUrl) {
    const urls = new Set();
    
    // Regular expressions to find different types of URLs
    const patterns = [
      // href attributes
      /href=["']([^"']+)["']/gi,
      // src attributes (images, scripts, iframes, etc.)
      /src=["']([^"']+)["']/gi,
      // srcset attributes (responsive images)
      /srcset=["']([^"']+)["']/gi,
      // action attributes (forms)
      /action=["']([^"']+)["']/gi,
      // data attributes that might contain URLs
      /data-[a-z-]*(?:url|src|href)=["']([^"']+)["']/gi,
      // CSS url() functions
      /url\(["']?([^"')]+)["']?\)/gi,
      // Link tags
      /<link[^>]+href=["']([^"']+)["']/gi,
      // Meta refresh
      /content=["']\d+;url=([^"']+)["']/gi,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const extracted = match[1];
        
        // Handle srcset (can contain multiple URLs)
        if (pattern.source.includes('srcset')) {
          const srcsetUrls = extracted.split(',').map(item => {
            const parts = item.trim().split(/\s+/);
            return parts[0];
          });
          srcsetUrls.forEach(url => this.processUrl(url, baseUrl, urls));
        } else {
          this.processUrl(extracted, baseUrl, urls);
        }
      }
    }
    
    return Array.from(urls);
  }

  processUrl(url, baseUrl, urls) {
    if (!url || url.startsWith('#') || url.startsWith('javascript:') || 
        url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      return;
    }
    
    try {
      // Convert relative URLs to absolute
      const absoluteUrl = new URL(url, baseUrl).href;
      
      // Remove fragment identifiers for deduplication
      const urlWithoutFragment = absoluteUrl.split('#')[0];
      
      if (urlWithoutFragment) {
        urls.add(urlWithoutFragment);
      }
    } catch (e) {
      // Invalid URL, skip
    }
  }

  fetchPage(url) {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WebCrawler/1.0)'
        },
        timeout: 10000
      };
      
      const req = client.get(url, options, (res) => {
        // Only fetch HTML content
        const contentType = res.headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
          resolve(null);
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  async checkAllStatuses() {
    const total = this.allUrls.size;
    let checked = 0;
    
    for (const [url] of this.allUrls) {
      checked++;
      console.log(`Checking status [${checked}/${total}]: ${url}`);
      const status = await this.checkStatus(url);
      this.allUrls.set(url, status);
    }
  }

  checkStatus(url) {
    return new Promise((resolve) => {
      try {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; WebCrawler/1.0)'
          },
          timeout: 10000
        };
        
        const req = client.request(url, options, (res) => {
          resolve(res.statusCode);
        });
        
        req.on('error', (err) => {
          // Try GET if HEAD fails
          const getReq = client.get(url, options, (res) => {
            // Consume response to free up connection
            res.on('data', () => {});
            res.on('end', () => {});
            resolve(res.statusCode);
          });
          
          getReq.on('error', () => resolve(0)); // 0 indicates connection error
          getReq.on('timeout', () => {
            getReq.destroy();
            resolve(0);
          });
        });
        
        req.on('timeout', () => {
          req.destroy();
          resolve(0);
        });
        
        req.end();
      } catch (e) {
        resolve(0); // Invalid URL
      }
    });
  }

  async saveResults(filename) {
    const results = Array.from(this.allUrls.entries())
      .map(([url, status]) => ({ url, status }))
      .sort((a, b) => {
        // Sort by status code first (errors first), then by URL
        if (a.status !== b.status) {
          if (a.status === 0) return -1;
          if (b.status === 0) return 1;
          if (a.status >= 400 && b.status < 400) return -1;
          if (b.status >= 400 && a.status < 400) return 1;
        }
        return a.url.localeCompare(b.url);
      });
    
    await fs.writeFile(filename, JSON.stringify(results, null, 2));
    
    // Print summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total URLs found: ${results.length}`);
    
    const errors = results.filter(r => r.status === 0);
    const notFound = results.filter(r => r.status === 404);
    const serverErrors = results.filter(r => r.status >= 500);
    const redirects = results.filter(r => r.status >= 300 && r.status < 400);
    const success = results.filter(r => r.status >= 200 && r.status < 300);
    
    console.log(`✓ Success (2xx): ${success.length}`);
    console.log(`→ Redirects (3xx): ${redirects.length}`);
    console.log(`✗ Not Found (404): ${notFound.length}`);
    console.log(`✗ Server Errors (5xx): ${serverErrors.length}`);
    console.log(`✗ Connection Errors: ${errors.length}`);
    
    if (notFound.length > 0) {
      console.log('\n404 URLs:');
      notFound.forEach(r => console.log(`  - ${r.url}`));
    }
    
    if (serverErrors.length > 0) {
      console.log('\nServer Error URLs:');
      serverErrors.forEach(r => console.log(`  - ${r.url} (${r.status})`));
    }
    
    if (errors.length > 0) {
      console.log('\nConnection Error URLs:');
      errors.forEach(r => console.log(`  - ${r.url}`));
    }
  }
}

// Main execution
async function main() {
  const startUrl = 'http://localhost:9000';
  const crawler = new WebCrawler(startUrl);
  
  try {
    await crawler.crawl();
    await crawler.saveResults('ALL_LINKS.json');
    console.log('\n✓ Results saved to ALL_LINKS.json');
  } catch (error) {
    console.error('Crawl failed:', error);
    process.exit(1);
  }
}

main();