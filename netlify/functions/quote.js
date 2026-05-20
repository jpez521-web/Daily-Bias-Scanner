const yahooFinance = require('yahoo-finance2').const yahooFinance = require('yahoo-finance2').default;

exports.handler = async function(event) {
  const symbol = event.queryStringParameters?.symbol;
  if (!symbol) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'No symbol provided' })
    };
  }

  try {
    const result = await yahooFinance.chart(symbol, {
      interval: '1h',
      range: '20d',
      includePrePost: true,
    });

    if (!result || !result.quotes || result.quotes.length < 6) {
      throw new Error('Not enough data');
    }

    const hourlyBars = result.quotes
      .filter(q => q.open != null && q.high != null && q.low != null && q.close != null)
      .map(q => ({
        timestamp: new Date(q.date).getTime(),
        open: q.open, high: q.high, low: q.low, close: q.close,
      }));

    if (hourlyBars.length < 6) throw new Error('Not enough valid bars');

    const sessions = buildSessions(hourlyBars);
    if (sessions.length < 2) throw new Error('Not enough sessions');

    const nowEST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hour = nowEST.getHours() + nowEST.getMinutes() / 60;
    const isActiveSession = hour >= 4 && hour < 20;

    let c1, c2, c3Price, c2Close;
    const len = sessions.length;

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

    const c2_swept_low  = c2.low  < c1.low  && c2.close > c1.low;
    const c2_swept_high = c2.high > c1.high && c2.close < c1.high;

    let signal = 'NEUTRAL';
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
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify({
        symbol,
        price: c3Price ?? c2.close,
        c2_close: c2Close,
        c1_high: c1.high, c1_low: c1.low,
        c2_high: c2.high, c2_low: c2.low,
        signal,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: `Failed: ${err.message}` }),
    };
  }
};

function buildSessions(hourlyBars) {
  const sessions = {};
  for (const bar of hourlyBars) {
    const estDate = new Date(new Date(bar.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const h = estDate.getHours();
    const sessionDay = new Date(estDate);
    if (h < 4) sessionDay.setDate(sessionDay.getDate() - 1);
    const dow = sessionDay.getDay();
    if (dow === 0 || dow === 6) continue;
    const key = `${sessionDay.getFullYear()}-${String(sessionDay.getMonth()+1).padStart(2,'0')}-${String(sessionDay.getDate()).padStart(2,'0')}`;
    if (!sessions[key]) {
      sessions[key] = { key, date: new Date(sessionDay), open: bar.open, high: bar.high, low: bar.low, close: bar.close, count: 1 };
    } else {
      sessions[key].high  = Math.max(sessions[key].high, bar.high);
      sessions[key].low   = Math.min(sessions[key].low, bar.low);
      sessions[key].close = bar.close;
      sessions[key].count++;
    }
  }
  return Object.values(sessions).filter(s => s.count >= 2).sort((a, b) => a.date - b.date);
}


exports.handler = async function(event) {
  const symbol = event.queryStringParameters?.symbol;
  if (!symbol) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'No symbol provided' })
    };
  }

  try {
    const result = await yahooFinance.chart(symbol, {
      interval: '1h',
      range: '20d',
      includePrePost: true,
    });

    if (!result || !result.quotes || result.quotes.length < 6) {
      throw new Error('Not enough data');
    }

    const hourlyBars = result.quotes
      .filter(q => q.open != null && q.high != null && q.low != null && q.close != null)
      .map(q => ({
        timestamp: new Date(q.date).getTime(),
        open: q.open, high: q.high, low: q.low, close: q.close,
      }));

    if (hourlyBars.length < 6) throw new Error('Not enough valid bars');

    const sessions = buildSessions(hourlyBars);
    if (sessions.length < 2) throw new Error('Not enough sessions');

    const nowEST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hour = nowEST.getHours() + nowEST.getMinutes() / 60;
    const isActiveSession = hour >= 4 && hour < 20;

    let c1, c2, c3Price, c2Close;
    const len = sessions.length;

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

    const c2_swept_low  = c2.low  < c1.low  && c2.close > c1.low;
    const c2_swept_high = c2.high > c1.high && c2.close < c1.high;

    let signal = 'NEUTRAL';
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
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify({
        symbol,
        price: c3Price ?? c2.close,
        c2_close: c2Close,
        c1_high: c1.high, c1_low: c1.low,
        c2_high: c2.high, c2_low: c2.low,
        signal,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: `Failed: ${err.message}` }),
    };
  }
};

function buildSessions(hourlyBars) {
  const sessions = {};
  for (const bar of hourlyBars) {
    const estDate = new Date(new Date(bar.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const h = estDate.getHours();
    const sessionDay = new Date(estDate);
    if (h < 4) sessionDay.setDate(sessionDay.getDate() - 1);
    const dow = sessionDay.getDay();
    if (dow === 0 || dow === 6) continue;
    const key = `${sessionDay.getFullYear()}-${String(sessionDay.getMonth()+1).padStart(2,'0')}-${String(sessionDay.getDate()).padStart(2,'0')}`;
    if (!sessions[key]) {
      sessions[key] = { key, date: new Date(sessionDay), open: bar.open, high: bar.high, low: bar.low, close: bar.close, count: 1 };
    } else {
      sessions[key].high  = Math.max(sessions[key].high, bar.high);
      sessions[key].low   = Math.min(sessions[key].low, bar.low);
      sessions[key].close = bar.close;
      sessions[key].count++;
    }
  }
  return Object.values(sessions).filter(s => s.count >= 2).sort((a, b) => a.date - b.date);
}
