# Later evidence batches (brief section 11, scenario 5)

Applied after the main fixtures with `npm run import -- --later`. They show the D4 identity rules on real platform
state, and they change no hero number, because PO-A5 is outside every cost total (it has no invoice).

| File | Row | Expected result |
|---|---|---|
| `payments-replay.csv` | `PAY-A1`, identical to the main batch | `REPLAYED`: no new record, no total changes |
| `payments-replay.csv` | `PAY-A5B`, a new payment ID with the same amount as `PAY-A5` | `ACCEPTED`: 2 payments, never collapsed by amount. PO-A5 becomes `UNSUPPORTED` (the v1 core supports 1 payment for each purchase) and still shows `MISSING_INVOICE` |
| `deliveries-correction.csv` | `DEL-A5` with moisture 127 instead of 126 | `VERSIONED`: the correction supersedes the first receipt, and is not counted as a second delivery |
