'use strict';

const axios = require('axios');

exports.handler = async (event) => {
	try {
		const params = event.queryStringParameters || {};
		const symbol = String(params.symbol || 'AI3').toUpperCase();
		const start = String(params.start || '').trim();
		const end = String(params.end || '').trim();
		const convert = String(params.convert || 'USD').toUpperCase();

		if (!symbol || !start || !end) {
			return respond(400, { error: 'Query params required: symbol, start, end' });
		}

		const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
		if (!dateRegex.test(start) || !dateRegex.test(end)) {
			return respond(400, { error: 'Dates must be in YYYY-MM-DD format' });
		}
		if (new Date(start) > new Date(end)) {
			return respond(400, { error: 'Start date must be before or equal to End date' });
		}

		const result = await fetchCoinGeckoDailyClose(symbol, start, end, convert);
		return respond(200, result);
	} catch (err) {
		const message = err.response?.data?.error || err.message || 'Unknown error';
		return respond(err.response?.status || 500, { error: message });
	}
};

function respond(statusCode, body) {
	return {
		statusCode,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*'
		},
		body: JSON.stringify(body)
	};
}

async function fetchCoinGeckoDailyClose(symbol, startYmd, endYmd, convert) {
	const vs = (convert || 'USD').toLowerCase();
	const client = axios.create({
		baseURL: 'https://api.coingecko.com/api/v3',
		timeout: 20000
	});

	const coin = await resolveCoinGeckoCoin(client, symbol);
	if (!coin) {
		const err = new Error(`Symbol ${symbol} not found on CoinGecko`);
		err.statusCode = 404;
		throw err;
	}

	const from = Math.floor(Date.parse(startYmd + 'T00:00:00.000Z') / 1000);
	const to = Math.floor(Date.parse(endYmd + 'T23:59:59.999Z') / 1000);
	const r = await client.get(`/coins/${encodeURIComponent(coin.id)}/market_chart/range`, {
		params: { vs_currency: vs, from, to }
	});
	const prices = Array.isArray(r.data?.prices) ? r.data.prices : [];
	const byDay = new Map();
	for (const entry of prices) {
		const ms = Number(entry?.[0]);
		const price = Number(entry?.[1]);
		if (!Number.isFinite(ms) || !Number.isFinite(price)) continue;
		const ymd = toUtcYmd(ms);
		const prev = byDay.get(ymd);
		if (!prev || ms > prev._ts) {
			byDay.set(ymd, { date: endOfDayIso(ymd), price, _ts: ms });
		}
	}
	const points = Array.from(byDay.values())
		.sort((a, b) => a._ts - b._ts)
		.map(x => ({ date: x.date, price: x.price }));
	return {
		symbol,
		name: coin.name,
		convert: convert.toUpperCase(),
		points
	};
}

async function resolveCoinGeckoCoin(client, symbol) {
	const q = await client.get('/search', { params: { query: symbol } });
	const coins = Array.isArray(q.data?.coins) ? q.data.coins : [];
	const exact = coins.find(c => String(c.symbol || '').toUpperCase() === symbol.toUpperCase());
	return exact || coins[0] || null;
}

function toUtcYmd(isoOrMs) {
	const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
	const y = d.getUTCFullYear();
	const m = `${d.getUTCMonth() + 1}`.padStart(2, '0');
	const day = `${d.getUTCDate()}`.padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function endOfDayIso(ymd) {
	return `${ymd}T23:59:59.999Z`;
}


