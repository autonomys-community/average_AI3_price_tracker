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

	// Initialize default dates (last 30 days)
	(function initDates() {
		const today = new Date();
		const end = formatDate(today);
		const startDate = new Date(today);
		startDate.setDate(today.getDate() - 30);
		const start = formatDate(startDate);
		startInput.value = start;
		endInput.value = end;
	})();

	// Lock symbol to AI3 in UI and logic
	(function lockSymbol() {
		const fixed = 'AI3';
		symbolInput.value = fixed;
		symbolInput.readOnly = true;
		symbolInput.setAttribute('aria-readonly', 'true');
	})();

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		// Force symbol to AI3 regardless of UI
		const symbol = 'AI3';
		symbolInput.value = symbol;
		const start = startInput.value;
		const end = endInput.value;
		const convert = convertSelect.value;

		if (!symbol || !start || !end) {
			showStatus('Please provide symbol, start, and end dates.', 'error');
			return;
		}

		if (new Date(start) > new Date(end)) {
			showStatus('Start date must be before or equal to End date.', 'error');
			return;
		}

		setLoading(true);
		showStatus('');
		try {
			const url = `/api/daily-close?symbol=${encodeURIComponent(symbol)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&convert=${encodeURIComponent(convert)}`;
			const resp = await fetch(url);
			if (!resp.ok) {
				const err = await safeJson(resp);
				throw new Error(err?.error || `Request failed with ${resp.status}`);
			}
			const data = await resp.json();
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
	});

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
})();


