'use strict';

require('dotenv').config();
const path = require('path');
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Simple health check
app.get('/health', (req, res) => {
	res.json({ ok: true });
});

// Daily close endpoint using CoinGecko free API with historical range support.
// Returns one UTC end-of-day close per day in the selected [start, end] range.
// Example: /api/daily-close?symbol=BTC&start=2024-01-01&end=2024-01-31&convert=USD
app.get('/api/daily-close', async (req, res) => {
	try {
		const symbol = String(req.query.symbol || 'BTC').toUpperCase();
		const timeStart = String(req.query.start || '').trim();
		const timeEnd = String(req.query.end || '').trim();
		const convert = String(req.query.convert || 'USD').toUpperCase();

		if (!symbol || !timeStart || !timeEnd) {
			return res.status(400).json({ error: 'Query params required: symbol, start, end' });
		}

		// Basic date validation (YYYY-MM-DD)
		const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
		if (!dateRegex.test(timeStart) || !dateRegex.test(timeEnd)) {
			return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format' });
		}

		// Ensure start <= end
		if (new Date(timeStart) > new Date(timeEnd)) {
			return res.status(400).json({ error: 'Start date must be before or equal to End date' });
		}

		const gecko = await fetchCoinGeckoDailyClose(symbol, timeStart, timeEnd, convert);
		return res.json(gecko);
	} catch (err) {
		const status = err.response?.status || 500;
		const message = err.response?.data?.error || err.response?.data?.status?.error_message || err.message || 'Unknown error';
		return res.status(status).json({ error: message });
	}
});

// SPA fallback
app.get('*', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
});

function toUtcYmd(isoOrDate) {
	const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
	const y = d.getUTCFullYear();
	const m = `${d.getUTCMonth() + 1}`.padStart(2, '0');
	const day = `${d.getUTCDate()}`.padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function endOfDayIso(ymd) {
	return `${ymd}T23:59:59.999Z`;
}

/**
 * CoinGecko: find coin id by symbol, fetch market_chart/range,
 * reduce to one UTC end-of-day close per day.
 */
async function fetchCoinGeckoDailyClose(symbol, startYmd, endYmd, convert) {
	const vs = (convert || 'USD').toLowerCase();
	const client = axios.create({
		baseURL: 'https://api.coingecko.com/api/v3',
		timeout: 20000
	});

	const coin = await resolveCoinGeckoCoin(client, symbol);
	if (!coin) {
		throw new Error(`Symbol ${symbol} not found on CoinGecko`);
	}

	const from = Math.floor(Date.parse(startYmd + 'T00:00:00.000Z') / 1000);
	const to = Math.floor(Date.parse(endYmd + 'T23:59:59.999Z') / 1000);
	const r = await client.get(`/coins/${encodeURIComponent(coin.id)}/market_chart/range`, {
		params: { vs_currency: vs, from, to }
	});
	const prices = Array.isArray(r.data?.prices) ? r.data.prices : [];
	// prices: [ [ms, price], ... ]
	const byDay = new Map();
	for (const entry of prices) {
		const [ms, price] = entry;
		const d = toUtcYmd(ms);
		const prev = byDay.get(d);
		if (!prev || ms > prev._ts) {
			byDay.set(d, { date: endOfDayIso(d), price: Number(price), _ts: Number(ms) });
		}
	}
	const points = Array.from(byDay.values())
		.sort((a, b) => a._ts - b._ts)
		.map(x => ({ date: x.date, price: x.price }));
	return {
		symbol: symbol,
		name: coin.name,
		convert: convert.toUpperCase(),
		points
	};
}

async function resolveCoinGeckoCoin(client, symbol) {
	// Use search for better matching
	const q = await client.get('/search', { params: { query: symbol } });
	const coins = Array.isArray(q.data?.coins) ? q.data.coins : [];
	// Prefer exact symbol match, then best match
	const exact = coins.find(c => String(c.symbol || '').toUpperCase() === symbol.toUpperCase());
	return exact || coins[0] || null;
}


