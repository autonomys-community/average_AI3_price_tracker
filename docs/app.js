(() => {
	const form = document.getElementById('query-form');
	const symbolInput = document.getElementById('symbol');
	const startInput = document.getElementById('start');
	const endInput = document.getElementById('end');
	const convertSelect = document.getElementById('convert');
	const statusEl = document.getElementById('status');
	const overallAverageEl = document.getElementById('overallAverage');
	const pointCountEl = document.getElementById('pointCount');
	const chartCanvas = document.getElementById('priceChart');

	let chart;

	function initDates() {
		const today = new Date();
		const end = formatDate(today);
		const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
		const start = formatDate(startDate);
		startInput.value = start;
		endInput.value = end;
	}

	(async function init() {
		initDates();
		await fetchAndRender();
	})();

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		await fetchAndRender();
	});

	async function fetchAndRender() {
		const symbol = symbolInput.value.trim();
		const start = startInput.value;
		const end = endInput.value;
		const convert = convertSelect.value;

		if (!symbol || !start || !end) {
			showStatus('Please provide start, and end dates.', 'error');
			return;
		}
		if (new Date(start) > new Date(end)) {
			showStatus('Start date must be before or equal to End date.', 'error');
			return;
		}

		setLoading(true);
		showStatus('');
		try {
			const data = await fetchDailyCloseFromCoinGecko(symbol, start, end, convert);
			renderChart(data, convert);
			renderSummary(data, convert);
			if ((data.points || []).length === 0) {
				showStatus('No data returned for given inputs. Try different dates or symbol.', 'warn');
			}
		} catch (err) {
			console.error(err);
			showStatus(err.message || 'Unexpected error occurred', 'error');
		} finally {
			setLoading(false);
		}
	}

	function renderChart(payload, convert) {
		const labels = (payload.points || []).map(p => toLocalDate(p.date));
		const values = (payload.points || []).map(p => p.price);

		if (chart) {
			chart.destroy();
		}
		chart = new Chart(chartCanvas, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: `${payload.symbol || ''} end-of-day close (${convert})`,
						data: values,
						borderColor: '#4f46e5',
						backgroundColor: 'rgba(79, 70, 229, 0.15)',
						pointRadius: 2,
						borderWidth: 2,
						tension: 0.2,
						fill: true
					}
				]
			},
			options: {
				maintainAspectRatio: false,
				scales: {
					x: {
						title: { display: true, text: 'Date' },
						grid: { display: false }
					},
					y: {
						title: { display: true, text: `Price (${convert})` },
						grid: { color: 'rgba(0,0,0,0.08)' },
						ticks: {
							callback: (v) => formatNumber(v)
						}
					}
				},
				plugins: {
					legend: { display: true },
					tooltip: {
						callbacks: {
							label: (ctx) => ` ${formatNumber(ctx.parsed.y)} ${convert}`
						}
					}
				}
			}
		});
	}

	function renderSummary(payload, convert) {
		const points = payload.points || [];
		pointCountEl.textContent = String(points.length);
		if (points.length === 0) {
			overallAverageEl.textContent = '—';
			return;
		}
		const valid = points.map(p => Number(p.price)).filter(Number.isFinite);
		const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
		overallAverageEl.textContent = `${formatNumber(avg)} ${convert}`;
	}

	function setLoading(loading) {
		const btn = document.getElementById('submit-btn');
		btn.disabled = loading;
		btn.textContent = loading ? 'Loading…' : 'Fetch';
	}

	function showStatus(message, type = '') {
		if (!message) {
			statusEl.hidden = true;
			statusEl.textContent = '';
			statusEl.className = 'status';
			return;
		}
		statusEl.hidden = false;
		statusEl.textContent = message;
		statusEl.className = `status ${type}`;
	}

	function formatDate(d) {
		const year = d.getFullYear();
		const month = `${d.getMonth() + 1}`.padStart(2, '0');
		const day = `${d.getDate()}`.padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function toLocalDate(iso) {
		try {
			const d = new Date(iso);
			const y = d.getFullYear();
			const m = `${d.getMonth() + 1}`.padStart(2, '0');
			const day = `${d.getDate()}`.padStart(2, '0');
			return `${y}-${m}-${day}`;
		} catch {
			return iso;
		}
	}

	function formatNumber(n) {
		try {
			return Number(n).toLocaleString(undefined, { maximumFractionDigits: 6 });
		} catch {
			return String(n);
		}
	}

	async function safeJson(resp) {
		try {
			return await resp.json();
		} catch {
			return null;
		}
	}

	async function fetchDailyCloseFromCoinGecko(symbol, startYmd, endYmd, convert) {
		const vs = String(convert || 'USD').toLowerCase();
		const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`;
		const searchResp = await fetch(searchUrl);
		if (!searchResp.ok) throw new Error(`CoinGecko search failed: ${searchResp.status}`);
		const search = await searchResp.json();
		const coins = Array.isArray(search?.coins) ? search.coins : [];
		const exact = coins.find(c => String(c.symbol || '').toUpperCase() === symbol.toUpperCase());
		const coin = exact || coins[0];
		if (!coin) throw new Error(`Symbol ${symbol} not found on CoinGecko`);

		const from = Math.floor(Date.parse(`${startYmd}T00:00:00.000Z`) / 1000);
		const to = Math.floor(Date.parse(`${endYmd}T23:59:59.999Z`) / 1000);
		const rangeUrl = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coin.id)}/market_chart/range?vs_currency=${encodeURIComponent(vs)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
		const rangeResp = await fetch(rangeUrl);
		if (!rangeResp.ok) {
			const err = await safeJson(rangeResp);
			throw new Error(err?.error || `CoinGecko range failed: ${rangeResp.status}`);
		}
		const range = await rangeResp.json();
		const prices = Array.isArray(range?.prices) ? range.prices : [];

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

		return { symbol, name: coin.name, convert: convert.toUpperCase(), points };
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
})();

