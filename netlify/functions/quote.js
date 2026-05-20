exports.handler = async function(event) {
  const symbol = event.queryStringParameters && event.queryStringParameters.symbol;
  if (!symbol) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'No symbol provided' })
    };
  }

  try {
    const https = require('https');
    
    const data = await new Promise((resolve, reject) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1h&range=20d&includePrePost=true`;
      const options = {
        hostname: 'query1.finance.yahoo.com',
        path: `/v8/finance/chart/${symbol}?interval=1h&range=20d&includePrePost=true`,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      };
      
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch(e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.end();
    });

    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result) throw new Error('No data returned');

    const quotes = result.indicators.quote[0];
    const timestamps = result.timestamp;

    const hourlyBars = timestamps.map(function(t, i) {
      return {
        timestamp: t * 1000,
        open: quotes.open[i],
        high: quotes.high[i],
        low: quotes.low[i],
        close: quotes.close[i]
      };
    }).filter(function(b) {
      return b.open != null && b.high != null && b.low != null && b.close != null;
    });

    if (hourlyBars.length < 6) throw new Error('Not enough bars');

    var sessions = buildSessions(hourlyBars);
    if (sessions.length < 2) throw new Error('Not enough sessions');

    var nowEST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    var hour = nowEST.getHours() + nowEST.getMinutes() / 60;
    var isActiveSession = hour >= 4 && hour < 20;

    var c1, c2, c3Price, c2Close;
    var len = sessions.length;

    if (isActiveSession && len >= 3) {
      c1 = sessions[len - 3];
      c2 = sessions[len - 2];
      c3Price = sessions[len - 1].close;
      c2Close = c2.close;
    } else if (len >= 2) {
      c1 = sessions[len - 2];
      c2 = sessions[len - 1];
      c3Price = null;
      c2Close = c2.close;
    } else {
      throw new Error('Not enough sessions');
    }

    var c2_swept_low  = c2.low  < c1.low  && c2.close > c1.low;
    var c2_swept_high = c2.high > c1.high && c2.close < c1.high;

    var signal = 'NEUTRAL';
    if (c3Price !== null) {
      if      (c2_swept_low  && c3Price >= c2Close) signal = 'BULL';
      else if (c2_swept_high && c3Price <= c2Close) signal = 'BEAR';
    } else {
      if (c2_swept_low)  signal = 'WATCH_BULL';
      if (c2_swept_high) signal = 'WATCH_BEAR';
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify({
        symbol: symbol,
        price: c3Price !== null ? c3Price : c2.close,
        c2_close: c2Close,
        c1_high: c1.high,
        c1_low: c1.low,
        c2_high: c2.high,
        c2_low: c2.low,
        signal: signal
      })
    };

  } catch(err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed: ' + err.message })
    };
  }
};

function buildSessions(hourlyBars) {
  var sessions = {};
  for (var i = 0; i < hourlyBars.length; i++) {
    var bar = hourlyBars[i];
    var estDate = new Date(new Date(bar.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York' }));
    var h = estDate.getHours();
    var sessionDay = new Date(estDate);
    if (h < 4) sessionDay.setDate(sessionDay.getDate() - 1);
    var dow = sessionDay.getDay();
    if (dow === 0 || dow === 6) continue;
    var key = sessionDay.getFullYear() + '-' + String(sessionDay.getMonth()+1).padStart(2,'0') + '-' + String(sessionDay.getDate()).padStart(2,'0');
    if (!sessions[key]) {
      sessions[key] = { key: key, date: new Date(sessionDay), open: bar.open, high: bar.high, low: bar.low, close: bar.close, count: 1 };
    } else {
      sessions[key].high  = Math.max(sessions[key].high, bar.high);
      sessions[key].low   = Math.min(sessions[key].low, bar.low);
      sessions[key].close = bar.close;
      sessions[key].count++;
    }
  }
  return Object.values(sessions).filter(function(s) { return s.count >= 2; }).sort(function(a, b) { return a.date - b.date; });
}
