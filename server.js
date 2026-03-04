#!/usr/bin/env node
/**
 * Plan Switcher - Standalone Proxy Server
 * 
 * A standalone proxy server that automatically switches between API keys
 * when rate limited. Perfect for AI coding tools like Claude Code, Cursor, etc.
 * 
 * @author Plan Switcher Team
 * @version 1.0.0
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const url = require('url');

// ============================================
// Configuration
// ============================================

const PORT = process.env.PORT || 8765;
const HOST = process.env.HOST || '127.0.0.1';

// Data directory: use current working directory for compiled executables
// In pkg snapshot, __dirname is read-only, so we use process.cwd() or executable path

// Determine data directory based on environment
function getDataDir() {
  // Check if running as pkg executable (has pkg property)
  const isPkg = process.pkg;
  
  if (isPkg) {
    // Use the directory where the executable is located
    const exeDir = path.dirname(process.execPath);
    return path.join(exeDir, 'data');
  } else {
    // Development mode: use __dirname
    return path.join(__dirname, 'data');
  }
}

const DATA_DIR = getDataDir();
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const PLANS_FILE = path.join(DATA_DIR, 'plans.json');

// Default configuration
const DEFAULT_CONFIG = {
  rateLimitBackoffBase: 60,        // Base backoff time in seconds
  rateLimitBackoffMultiplier: 5,   // Exponential backoff multiplier
  rateLimitBackoffMax: 3600,       // Maximum backoff time (1 hour)
  billingBackoffBase: 18000,       // 5 hours for billing errors
  billingBackoffMax: 86400,        // 24 hours max for billing
  healthCheckEnabled: true,
  healthCheckInterval: 300,        // 5 minutes
  maxConsecutiveErrors: 5,
};

// ============================================
// State Management
// ============================================

let plans = {};
let config = { ...DEFAULT_CONFIG };
let currentPlanId = null;
let totalRequests = 0;
let totalSwitches = 0;
let startTime = Date.now();
let healthCheckTimer = null;

// Load data from files
function loadData() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Load config
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      config = { ...DEFAULT_CONFIG, ...savedConfig };
    } catch (e) {
      console.error('Failed to load config:', e.message);
    }
  }

  // Load plans
  if (fs.existsSync(PLANS_FILE)) {
    try {
      const savedPlans = JSON.parse(fs.readFileSync(PLANS_FILE, 'utf8'));
      plans = savedPlans;
      // Initialize runtime state for each plan
      Object.keys(plans).forEach(id => {
        plans[id].status = plans[id].status || 'active';
        plans[id].totalRequests = plans[id].totalRequests || 0;
        plans[id].successRequests = plans[id].successRequests || 0;
        plans[id].consecutiveErrors = plans[id].consecutiveErrors || 0;
        plans[id].lastError = plans[id].lastError || null;
        plans[id].cooldownUntil = plans[id].cooldownUntil || null;
        plans[id].disabledUntil = plans[id].disabledUntil || null;
        plans[id].disabledReason = plans[id].disabledReason || null;
        plans[id].model = plans[id].model || null;  // Model name override
      });
      selectNextPlan();
    } catch (e) {
      console.error('Failed to load plans:', e.message);
    }
  }
}

// Save data to files
function saveData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  fs.writeFileSync(PLANS_FILE, JSON.stringify(plans, null, 2));
}

// ============================================
// Plan Selection Logic
// ============================================

function getAvailablePlans() {
  const now = Date.now();
  return Object.entries(plans)
    .filter(([id, plan]) => {
      if (plan.status === 'disabled') {
        // Check if disabled period is over
        if (plan.disabledUntil && now >= new Date(plan.disabledUntil).getTime()) {
          plan.status = 'active';
          plan.disabledUntil = null;
          plan.disabledReason = null;
          return true;
        }
        return false;
      }
      if (plan.status === 'cooldown') {
        // Check if cooldown period is over
        if (plan.cooldownUntil && now >= new Date(plan.cooldownUntil).getTime()) {
          plan.status = 'active';
          plan.cooldownUntil = null;
          return true;
        }
        return false;
      }
      return plan.status === 'active';
    })
    .sort((a, b) => {
      // Sort by priority (lower is better), then by weight (for load balancing)
      if (a[1].priority !== b[1].priority) {
        return a[1].priority - b[1].priority;
      }
      // Simple weight-based random selection could be added here
      return 0;
    });
}

function selectNextPlan(excludeIds = []) {
  const available = getAvailablePlans().filter(([id]) => !excludeIds.includes(id));
  if (available.length === 0) {
    currentPlanId = null;
    return null;
  }
  currentPlanId = available[0][0];
  return plans[currentPlanId];
}

// ============================================
// Backoff Calculation
// ============================================

function calculateBackoff(plan, errorType) {
  const baseConfig = errorType === 'rate_limit' 
    ? { base: config.rateLimitBackoffBase, max: config.rateLimitBackoffMax, mult: config.rateLimitBackoffMultiplier }
    : { base: config.billingBackoffBase, max: config.billingBackoffMax, mult: 1 };

  const attempt = plan.consecutiveErrors || 1;
  let backoff = baseConfig.base * Math.pow(baseConfig.mult, attempt - 1);
  backoff = Math.min(backoff, baseConfig.max);
  
  return backoff * 1000; // Convert to milliseconds
}

function setPlanCooldown(plan, errorType, errorMessage) {
  const backoffMs = calculateBackoff(plan, errorType);
  const cooldownUntil = new Date(Date.now() + backoffMs);
  
  plan.status = 'cooldown';
  plan.cooldownUntil = cooldownUntil.toISOString();
  plan.lastError = errorMessage;
  plan.consecutiveErrors = (plan.consecutiveErrors || 0) + 1;

  console.log(`Plan ${plan.id} entering cooldown until ${cooldownUntil.toISOString()} due to ${errorType}`);
  saveData();
}

function disablePlan(plan, reason, durationMs = 86400000) {
  plan.status = 'disabled';
  plan.disabledUntil = new Date(Date.now() + durationMs).toISOString();
  plan.disabledReason = reason;
  plan.lastError = reason;
  
  console.log(`Plan ${plan.id} disabled until ${plan.disabledUntil}: ${reason}`);
  saveData();
}

// ============================================
// Error Detection
// ============================================

function analyzeError(statusCode, responseBody) {
  const bodyStr = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
  
  // Rate limit detection
  if (statusCode === 429) {
    return { type: 'rate_limit', shouldSwitch: true };
  }
  
  // Billing/insufficient quota detection
  if (statusCode === 402 || 
      bodyStr.includes('insufficient_quota') ||
      bodyStr.includes('billing') ||
      bodyStr.includes('exceeded') ||
      bodyStr.includes('limit_exceeded') ||
      bodyStr.includes('rate_limit_exceeded')) {
    return { type: 'billing', shouldSwitch: true };
  }
  
  // Authentication errors - don't switch, likely config issue
  if (statusCode === 401 || statusCode === 403) {
    return { type: 'auth', shouldSwitch: false };
  }
  
  // Server errors - might be temporary
  if (statusCode >= 500) {
    return { type: 'server_error', shouldSwitch: true };
  }
  
  // Unknown error - switch with caution
  if (statusCode >= 400) {
    return { type: 'unknown', shouldSwitch: true };
  }
  
  return { type: null, shouldSwitch: false };
}

// ============================================
// Proxy Request Handler
// ============================================

async function proxyRequest(req, res) {
  totalRequests++;
  
  const attemptedPlans = [];
  let lastError = null;
  
  while (attemptedPlans.length < Object.keys(plans).length) {
    const plan = selectNextPlan(attemptedPlans);
    
    if (!plan) {
      break;
    }
    
    attemptedPlans.push(plan.id);
    
    try {
      const result = await forwardRequest(req, plan);
      
      // Success
      plan.totalRequests++;
      plan.successRequests++;
      plan.consecutiveErrors = 0;
      saveData();
      
      // Add response headers
      res.setHeader('X-Failover-Plan', plan.id);
      res.setHeader('X-Failover-Attempts', attemptedPlans.length);
      
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
      return;
      
    } catch (error) {
      lastError = error;
      
      const errorInfo = analyzeError(error.statusCode, error.body);
      
      if (errorInfo.shouldSwitch) {
        if (errorInfo.type === 'rate_limit') {
          setPlanCooldown(plan, 'rate_limit', error.message || 'Rate limited');
        } else if (errorInfo.type === 'billing') {
          setPlanCooldown(plan, 'billing', error.message || 'Billing error');
        } else {
          plan.consecutiveErrors++;
          plan.totalRequests++;
          plan.lastError = error.message;
          saveData();
        }
        
        totalSwitches++;
        
        // Select next plan
        selectNextPlan(attemptedPlans);
      } else {
        // Auth error - don't retry with same plan, but don't switch either
        plan.totalRequests++;
        plan.lastError = error.message;
        saveData();
        
        res.writeHead(error.statusCode || 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }
  }
  
  // All plans failed
  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'All plans are currently unavailable',
    attemptedPlans,
    lastError: lastError?.message || 'Unknown error'
  }));
}

function forwardRequest(req, plan) {
  return new Promise((resolve, reject) => {
    const targetUrl = plan.baseUrl || getDefaultBaseUrl(plan.provider);
    const parsedUrl = new URL(targetUrl);
    
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
      const bodyBuffer = Buffer.concat(body);
      
      // Parse and modify request body
      let bodyStr = bodyBuffer.toString();
      
      // If plan has a model specified, replace the model in the request body
      if (plan.model && bodyStr) {
        try {
          const bodyJson = JSON.parse(bodyStr);
          if (bodyJson.model) {
            bodyJson.model = plan.model;
            bodyStr = JSON.stringify(bodyJson);
          }
        } catch (e) {
          // If not valid JSON, leave as-is
        }
      }
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: req.url.replace('/proxy', ''),
        method: req.method,
        headers: {
          ...req.headers,
          'host': parsedUrl.hostname,
          'authorization': `Bearer ${plan.apiKey}`,
        }
      };
      
      // Remove content-length header as body might change
      delete options.headers['content-length'];
      
      const httpModule = parsedUrl.protocol === 'https:' ? https : http;
      const proxyReq = httpModule.request(options, (proxyRes) => {
        let responseBody = [];
        proxyRes.on('data', chunk => responseBody.push(chunk));
        proxyRes.on('end', () => {
          const responseBuffer = Buffer.concat(responseBody);
          
          if (proxyRes.statusCode >= 400) {
            reject({
              statusCode: proxyRes.statusCode,
              message: responseBuffer.toString(),
              body: responseBuffer.toString()
            });
          } else {
            resolve({
              statusCode: proxyRes.statusCode,
              headers: proxyRes.headers,
              body: responseBuffer
            });
          }
        });
      });
      
      proxyReq.on('error', (e) => {
        reject({ statusCode: 500, message: e.message });
      });
      
      if (bodyStr) {
        proxyReq.write(bodyStr);
      }
      proxyReq.end();
    });
  });
}

function getDefaultBaseUrl(provider) {
  const urls = {
    // International Providers
    anthropic: 'https://api.anthropic.com/v1',
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    google: 'https://generativelanguage.googleapis.com/v1',
    mistral: 'https://api.mistral.ai/v1',
    
    // Chinese Providers - Standard API
    deepseek: 'https://api.deepseek.com/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    moonshot: 'https://api.moonshot.cn/v1',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    baidu: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop',
    minimax: 'https://api.minimax.chat/v1',
    doubao: 'https://ark.cn-beijing.volces.com/api/v3',
    yi: 'https://api.lingyiwanwu.com/v1',
    siliconflow: 'https://api.siliconflow.cn/v1',
    
    // Coding Plan Specific Endpoints (Optimized for AI Coding Tools)
    // 智谱AI GLM Coding Plan - Anthropic 兼容端点
    zhipu_coding: 'https://open.bigmodel.cn/api/anthropic',
    // 阿里云百炼 Coding Plan - OpenAI 兼容端点 (API Key格式: sk-sp-xxxxx)
    qwen_coding: 'https://coding.dashscope.aliyuncs.com/v1',
    // Kimi Coding Plan - Anthropic 兼容端点
    kimi_coding: 'https://api.moonshot.cn/anthropic',
    // MiniMax Coding Plan - 国内版 (Anthropic兼容)
    minimax_coding: 'https://api.minimax.chat/anthropic',
    // MiniMax Coding Plan - 国际版 (Anthropic兼容)
    minimax_coding_intl: 'https://api.minimax.io/anthropic',
    // 火山引擎方舟 Coding Plan - Anthropic 兼容端点
    doubao_coding: 'https://ark.cn-beijing.volces.com/api/coding',
    // 火山引擎方舟 Coding Plan - OpenAI 兼容端点
    doubao_coding_openai: 'https://ark.cn-beijing.volces.com/api/coding/v3',
    
    // Anthropic-compatible endpoints (for Claude Code, Cursor, etc.)
    zhipu_anthropic: 'https://open.bigmodel.cn/api/anthropic',
  };
  return urls[provider] || 'https://api.example.com/v1';
}

// ============================================
// Health Check
// ============================================

function startHealthCheck() {
  if (!config.healthCheckEnabled) return;
  
  healthCheckTimer = setInterval(() => {
    Object.entries(plans).forEach(([id, plan]) => {
      if (plan.status === 'cooldown') {
        const now = Date.now();
        const cooldownEnd = plan.cooldownUntil ? new Date(plan.cooldownUntil).getTime() : 0;
        
        if (now >= cooldownEnd) {
          plan.status = 'active';
          plan.cooldownUntil = null;
          console.log(`Plan ${id} recovered from cooldown`);
          saveData();
        }
      }
    });
    
    // Re-select plan if current one is unavailable
    if (currentPlanId && plans[currentPlanId]?.status !== 'active') {
      selectNextPlan();
    }
  }, config.healthCheckInterval * 1000);
}

// ============================================
// Admin API
// ============================================

function handleAdminApi(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Status API
  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        plans,
        config,
        currentPlanId,
        totalRequests,
        totalSwitches,
        uptime: Math.floor((Date.now() - startTime) / 1000)
      }
    }));
    return;
  }
  
  // Add Plan API
  if (pathname === '/api/plans' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const plan = JSON.parse(body);
        if (!plan.id || !plan.apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Plan ID and API Key are required' }));
          return;
        }
        
        plans[plan.id] = {
          id: plan.id,
          name: plan.name || plan.id,
          provider: plan.provider || 'anthropic',
          apiKey: plan.apiKey,
          baseUrl: plan.baseUrl || null,
          model: plan.model || null,  // Optional: override model name in requests
          priority: plan.priority || 0,
          weight: plan.weight || 100,
          status: 'active',
          totalRequests: 0,
          successRequests: 0,
          consecutiveErrors: 0,
          lastError: null,
          cooldownUntil: null,
          disabledUntil: null,
          disabledReason: null,
        };
        
        if (!currentPlanId) {
          selectNextPlan();
        }
        
        saveData();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Plan ${plan.id} added` }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }
  
  // Delete Plan API
  if (pathname === '/api/plans' && req.method === 'DELETE') {
    const planId = parsedUrl.query.id;
    if (!planId || !plans[planId]) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Plan not found' }));
      return;
    }
    
    delete plans[planId];
    if (currentPlanId === planId) {
      selectNextPlan();
    }
    saveData();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: `Plan ${planId} deleted` }));
    return;
  }
  
  // Reset API
  if (pathname === '/api/reset' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        if (data.resetAll) {
          Object.keys(plans).forEach(id => {
            plans[id].status = 'active';
            plans[id].consecutiveErrors = 0;
            plans[id].lastError = null;
            plans[id].cooldownUntil = null;
            plans[id].disabledUntil = null;
            plans[id].disabledReason = null;
          });
          selectNextPlan();
          saveData();
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'All plans reset' }));
        } else if (data.planId) {
          const plan = plans[data.planId];
          if (plan) {
            plan.status = 'active';
            plan.consecutiveErrors = 0;
            plan.lastError = null;
            plan.cooldownUntil = null;
            plan.disabledUntil = null;
            plan.disabledReason = null;
            saveData();
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: `Plan ${data.planId} reset` }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Plan not found' }));
          }
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'planId or resetAll required' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }
  
  // Config API
  if (pathname === '/api/config' && req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const newConfig = JSON.parse(body);
        config = { ...DEFAULT_CONFIG, ...newConfig };
        saveData();
        
        // Restart health check if interval changed
        if (healthCheckTimer) {
          clearInterval(healthCheckTimer);
        }
        startHealthCheck();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Config updated' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }
  
  // 404 for unknown API routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Not found' }));
}

// ============================================
// Static File Server
// ============================================

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);
  
  const extname = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };
  
  const contentType = contentTypes[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

// ============================================
// Open Browser Helper
// ============================================

function openBrowser(url) {
  const platform = process.platform;
  let command;
  
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    // Linux and others
    command = `xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || x-www-browser "${url}" 2>/dev/null || firefox "${url}" 2>/dev/null || google-chrome "${url}" 2>/dev/null || chromium "${url}" 2>/dev/null || chromium-browser "${url}" 2>/dev/null`;
  }
  
  exec(command, (error) => {
    if (error) {
      console.log(`\n提示: 请手动打开浏览器访问: ${url}`);
    } else {
      console.log(`\n已自动打开浏览器: ${url}`);
    }
  });
}

// ============================================
// Main Server
// ============================================

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // Admin API routes
  if (parsedUrl.pathname.startsWith('/api/')) {
    handleAdminApi(req, res);
    return;
  }
  
  // Proxy routes
  if (parsedUrl.pathname.startsWith('/proxy/')) {
    proxyRequest(req, res);
    return;
  }
  
  // Static files (admin UI)
  serveStatic(req, res);
});

// Initialize
loadData();
startHealthCheck();

// Start server
server.listen(PORT, HOST, () => {
  const adminUrl = `http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`;
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                                                              ║');
  console.log('║               🔄  Plan Switcher v1.0.0                       ║');
  console.log('║         Coding Plan Auto-Switch Proxy Server                 ║');
  console.log('║                                                              ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║                                                              ║');
  console.log(`║  🌐 Admin UI:  ${adminUrl.padEnd(46)}║`);
  console.log(`║  🔌 Proxy:     ${`${adminUrl}/proxy/v1`.padEnd(46)}║`);
  console.log('║                                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Auto-open browser (can be disabled with --no-browser flag)
  const args = process.argv.slice(2);
  if (!args.includes('--no-browser') && !args.includes('-n')) {
    openBrowser(adminUrl);
  } else {
    console.log(`提示: 请打开浏览器访问管理界面: ${adminUrl}`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
  }
  saveData();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
  }
  saveData();
  process.exit(0);
});
