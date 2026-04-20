# Obscura Match v2

> **Confidential sealed-bid OTC block-crossing engine** — Privacy Track, Colosseum Hackathon
>
> Powered by MagicBlock Private Ephemeral Rollup on Intel TDX

---

## What It Does

Obscura Match is an institutional-grade OTC crossing engine for **one SPL pair (USDC/SOL)**. Traders submit sealed bids into a TEE-backed Private Ephemeral Rollup. Orders are matched confidentially, with the net result committing back to Solana at settlement.

**Zero pre-trade signaling. Zero MEV. Fully auditable.**

---

## MagicBlock Primitives Used

| Primitive | Usage |
|---|---|
| **PER — Private Ephemeral Rollup (Intel TDX)** | All order state lives in PER during auction window |
| **Private Payments API — `/deposit`** | Funds enter the PER from trader's Solana wallet |
| **Private Payments API — `/transfer`** | Net settlement after matching |
| **Private Payments API — `/withdraw`** | Remaining funds exit PER to Solana |
| **Private Payments API — `/private-balance`** | Live balance display in Trader Terminal |
| **Private Payments API — `/is-mint-initialized`** | Pre-deposit readiness check |
| **Access Control (ACL program)** | Permission accounts with 5 SDK flags |
| **Permission flags** | `AUTHORITY`, `TX_LOGS`, `TX_BALANCES`, `TX_MESSAGE`, `ACCOUNT_SIGNATURES` |
| **Delegation hooks** | Both permission + permissioned accounts delegated to TEE validator |
| **Commit & Undelegate** | Settlement finalization back to Solana |
| **Cranks** | Scheduled auction close + settlement trigger (not matching) |

---

## Architecture

```
Trader Wallet
    │
    ├── TEE Auth  →  verifyTeeRpcIntegrity() → getAuthToken() → ?token=…
    │
    ├── Deposit   →  POST /v1/spl/deposit  →  PER vault
    │
    ├── Submit Order
    │       └── CreatePermission (ACL program)  [TRADER_FLAGS]
    │           DelegatePermission + PDA  →  TEE validator
    │           SubmitOrder instruction  →  PER session
    │
    ├── [Crank fires at close_time]
    │       └── close_auction()  →  AuctionStatus::Closed
    │
    ├── match_orders()  →  runs INSIDE PER on TEE validator
    │       └── Confidential matching, clearing price computed
    │
    ├── settle()
    │       └── commit_and_undelegate_accounts (MatchState → Solana)
    │           UpdatePermission { members: None }  ← transitional reveal
    │           SPL transfer (net) → buyer/seller
    │           ClosePermission  (reclaim lamports)
    │
    └── Withdraw  →  POST /v1/spl/withdraw  →  Solana wallet
```

---

## Key Addresses (Devnet — env-configurable)

| Constant | Address |
|---|---|
| ACL / Permission Program | `ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1` |
| Delegation Program | `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh` |
| TEE Validator (devnet) | `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo` |
| TEE RPC (devnet) | `https://devnet-tee.magicblock.app` |
| Private Payments API | `https://payments.magicblock.app/v1/spl` |

All addresses are loaded from `VITE_*` environment variables. Never hardcoded.

---

## Compliance Design

- **Private ≠ Anonymous**: Traders see only their own accounts; authorized auditors get full log/balance/message/signature visibility via permission flags.
- **`members: None`** is used exactly once per order lifecycle — as a transitional reveal step after `commit_and_undelegate`, not as a permanent public access tier.
- **Account-level permissions only**: no per-field selective reveal beyond what the 5 SDK flags explicitly govern.
- **On-chain settlement**: all net transfers clear on Solana base chain — no off-chain bridges.

---

## Running Locally

```bash
cd app
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Environment

Copy `.env.development` to `.env.local` to override any values:

```env
VITE_TEE_URL=https://devnet-tee.magicblock.app
VITE_TEE_VALIDATOR=MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo
VITE_CLUSTER=devnet
VITE_PAYMENTS_API=https://payments.magicblock.app/v1/spl
VITE_PERMISSION_PROGRAM=ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1
VITE_DELEGATION_PROGRAM=DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh
```

---

## Testing Suite

Obscura Match is shipped with a comprehensive automated testing suite encompassing **209 individual tests** ensuring production-ready stability, regression resistance, and exact adherence to MagicBlock primitives.

### Frameworks Used
- **Vitest**: Unit tests, Store integration, Crank logic.
- **MSW (Mock Service Worker)**: API integration intercepting all Private Payment responses to test deposit/withdraw/transfer layouts.
- **Happy-DOM**: Component testing resolving React primitives (GlassCard, Timers) outside of graphical domains.
- **Playwright**: End-to-End assertions covering all 5 views securely asserting component states inside Headless Chromium.

### Running Tests

```bash
cd app

# Run all unit, integration, and component tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run End-to-End browser tests (requires Playwright browsers)
npx playwright install chromium
npm run test:e2e
```

---

## App Pages

| Page | Path | Purpose |
|---|---|---|
| **Overview** | `/` | Product hero, live stats, 5-step how-it-works, compliance trust |
| **Trader Terminal** | `/terminal` | Deposit, sealed order submission, withdrawal, TX timeline |
| **Auction Room** | `/auction` | Live countdown, crank scheduler, sealed order count, MEV explainer, settlement reveal |
| **Compliance** | `/compliance` | Permission matrix, audit log, role matrix, settlement trace |
| **Admin / Ops** | `/admin` | Crank jobs, system health, auction config, architecture reference |

---

## Program Instructions

| Instruction | Who calls it | Where |
|---|---|---|
| `initialize_auction` | Admin | Solana |
| `submit_order` | Trader | PER (TEE session) |
| `delegate_pda` | Trader/Admin | Solana (pre-PER) |
| `match_orders` | TEE validator | PER (confidential) |
| `close_auction` | **Crank** only | Solana |
| `settle` | Admin | PER → Solana commit |

---

## Tech Stack

- **Frontend**: Vite + React + TypeScript, Vanilla CSS glassmorphism
- **Wallet**: `@solana/wallet-adapter-react` (Phantom, Solflare)
- **State**: Zustand
- **MagicBlock SDK**: `@magicblock-labs/ephemeral-rollups-sdk`
- **On-chain**: Anchor 0.30, `ephemeral-rollups-sdk` v0.4.11

---

*Built for the Privacy Track — Colosseum Hackathon (Powered by MagicBlock, ST MY & SNS)*
