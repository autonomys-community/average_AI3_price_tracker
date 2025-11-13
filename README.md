## AI3 Token Price Tracker (CoinGecko)

Single-page app that:
- Fetches historical prices from CoinGecko free API
- Aggregates one UTC end-of-day (EOD) close per day for a selected date range
- Plots those daily closes and displays the arithmetic mean for the period

Data source: CoinGecko (`/coins/{id}/market_chart/range`).

### Prerequisites
- Node.js 18+

### Setup
1) Install dependencies:

```bash
npm install
```

2) Start the server:

```bash
npm start
```

3) Open the app:

```
http://localhost:3000
```

### Usage
- Symbol is fixed to `AI3` in the UI.
- Choose `start` and `end` dates (YYYY-MM-DD) and a `currency` (default USD), then click Fetch.
- The chart shows one point per day (UTC EOD close). The “Selected period average” is the arithmetic mean of those daily closes.

### API
Backend endpoint:

```
GET /api/daily-close?symbol=AI3&start=YYYY-MM-DD&end=YYYY-MM-DD&convert=USD
```

Sample response:

```json
{
  "symbol": "AI3",
  "name": "Autonomys AI3",
  "convert": "USD",
  "points": [
    { "date": "2025-10-01T23:59:59.999Z", "price": 1.23 },
    { "date": "2025-10-02T23:59:59.999Z", "price": 1.27 }
  ]
}
```

### How the average is calculated
1. Fetch intraday price samples from CoinGecko for the requested range.
2. Group by UTC day and select the last sample per day as the EOD close.
3. Compute arithmetic mean: sum(EOD closes) / number of days.

### Development
- Frontend: `public/` (`index.html`, `app.js`, `styles.css`)
- Backend: `server.js`

### Repository
- Code is available at: `https://github.com/autonomys-community/average_AI3_price_tracker`

