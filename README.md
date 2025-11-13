## AI3 Token Price Tracker (CoinGecko)

Single-page app that:
- Fetches historical prices from CoinGecko free API
- Aggregates one UTC end-of-day (EOD) close per day for a selected date range
- Plots those daily closes and displays the arithmetic mean for the period

Data source: CoinGecko (`/coins/{id}/market_chart/range`).

### Prerequisites
- Modern web browser

### Setup
You can open the app as static files:
- Option A: Open `public/index.html` directly in your browser.
- Option B: Serve the `public/` folder with any static server (e.g., `python -m http.server`).

### Usage
- Choose `start` and `end` dates (YYYY-MM-DD) and a `currency` (default USD), then click Fetch.
- The chart shows one point per day (UTC EOD close). The “Selected period average” is the arithmetic mean of those daily closes.

### How the average is calculated
1. Fetch intraday price samples from CoinGecko for the requested range.
2. Group by UTC day and select the last sample per day as the EOD close.
3. Compute arithmetic mean: sum(EOD closes) / number of days.

### Development
- Frontend only: `public/` (`index.html`, `app.js`, `styles.css`)

### Repository
- Code is available at: `https://github.com/autonomys-community/average_AI3_price_tracker`

