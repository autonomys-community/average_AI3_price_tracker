## Token Price Tracker (CoinMarketCap)

A single-page application that:
- Fetches OHLCV historical data from CoinMarketCap for a given token symbol and date range
- Plots the daily average price on a line chart
- Displays the overall average price for the selected period

### Prerequisites
- Node.js 18+
- A CoinMarketCap API key (Pro API)

### Setup
1. In the project root, create a `.env` file with:

```
CMC_API_KEY=your-coinmarketcap-api-key-here
PORT=3000
```

2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

4. Open the app at:

```
http://localhost:3000
```

### Usage
- Enter a token `symbol` (e.g., BTC), choose `start` and `end` dates, and select the `currency` (default USD).
- Click Fetch to see the daily average price chart and the overall average for the period.

### Notes
- The backend exposes `/api/ohlcv?symbol=BTC&start=YYYY-MM-DD&end=YYYY-MM-DD&convert=USD` which proxies to CoinMarketCap and normalizes the response:

```json
{
  "symbol": "BTC",
  "name": "Bitcoin",
  "convert": "USD",
  "points": [
    { "date": "2024-01-01T23:59:59.999Z", "open": 0, "high": 0, "low": 0, "close": 0, "average": 0 }
  ]
}
```

- Daily average is computed as `(open + high + low + close) / 4`.
- If you encounter CMC errors, ensure your API key is valid and your selected date range is supported.

### Development
- Static SPA files are in `public/`.
- Server code is in `server.js`.


