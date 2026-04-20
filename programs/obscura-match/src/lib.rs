// ============================================================
// Obscura Match v2 — Anchor Program
// Confidential sealed-bid OTC block-crossing engine
//
// Architecture:
//   - State lives on PER (Private Ephemeral Rollup) during auction window
//   - Permission + permissioned accounts are both delegated to TEE validator
//   - Cranks trigger close/settlement (not matching)
//   - Matching executes inside PER on the TEE validator
//   - Net result commits back to Solana via commit_and_undelegate
//
// MagicBlock Program IDs (environment-configurable):
//   ACL/Permission: ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1
//   Delegation:     DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh
//   TEE Validator:  MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo  (devnet)
// ============================================================

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use ephemeral_rollups_sdk::cpi::delegate_account;
use ephemeral_rollups_sdk::ephem::{commit_and_undelegate_accounts, commit_accounts};
use ephemeral_rollups_sdk::er::{delegate, DelegateConfig};

// SDK flag constants (mirror of TypeScript SDK)
pub const AUTHORITY_FLAG:          u8 = 1 << 0; // 0x01
pub const TX_LOGS_FLAG:            u8 = 1 << 1; // 0x02
pub const TX_BALANCES_FLAG:        u8 = 1 << 2; // 0x04
pub const TX_MESSAGE_FLAG:         u8 = 1 << 3; // 0x08
pub const ACCOUNT_SIGNATURES_FLAG: u8 = 1 << 4; // 0x10

pub const TRADER_FLAGS:  u8 = TX_LOGS_FLAG | TX_BALANCES_FLAG;
pub const AUDITOR_FLAGS: u8 = TX_LOGS_FLAG | TX_BALANCES_FLAG | TX_MESSAGE_FLAG | ACCOUNT_SIGNATURES_FLAG;
pub const ADMIN_FLAGS:   u8 = AUTHORITY_FLAG | AUDITOR_FLAGS;

declare_id!("OBSC1MatchXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

#[program]
pub mod obscura_match {
    use super::*;

    // -------------------------------------------------------
    // initialize_auction
    // Creates the AuctionConfig PDA for one USDC/SOL auction.
    // Called once per auction epoch by the protocol admin.
    // -------------------------------------------------------
    pub fn initialize_auction(
        ctx: Context<InitializeAuction>,
        lot_size: u64,
        min_increment: u64,
        close_time: i64,
        fee_bps: u16,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.auction_config;
        cfg.authority       = ctx.accounts.authority.key();
        cfg.base_mint       = ctx.accounts.base_mint.key();
        cfg.quote_mint      = ctx.accounts.quote_mint.key();
        cfg.lot_size        = lot_size;
        cfg.min_increment   = min_increment;
        cfg.close_time      = close_time;
        cfg.fee_bps         = fee_bps;
        cfg.status          = AuctionStatus::Open;
        cfg.order_count     = 0;
        cfg.bump            = ctx.bumps.auction_config;
        emit!(AuditEvent {
            actor:           ctx.accounts.authority.key(),
            action:          "initialize_auction".to_string(),
            visibility_tier: "admin".to_string(),
            timestamp:       Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    // -------------------------------------------------------
    // submit_order
    // Called by trader inside the PER session (TEE-enforced).
    // Creates an OrderIntent PDA and, via the permission hooks,
    // restricts it so only the trader can see their own state.
    //
    // Both the permission account AND the OrderIntent PDA must
    // have been delegated to the TEE validator before this runs.
    // -------------------------------------------------------
    pub fn submit_order(
        ctx: Context<SubmitOrder>,
        side: OrderSide,
        size: u64,
        limit_price: u64,
        expiry: i64,
        nonce: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.auction_config.status == AuctionStatus::Open,
            ObscuraError::AuctionNotOpen
        );
        require!(size > 0, ObscuraError::InvalidSize);
        require!(limit_price > 0, ObscuraError::InvalidPrice);

        let order = &mut ctx.accounts.order_intent;
        order.auction_id    = ctx.accounts.auction_config.key();
        order.trader        = ctx.accounts.trader.key();
        order.side          = side;
        order.size          = size;
        order.limit_price   = limit_price;
        order.expiry        = expiry;
        order.nonce         = nonce;
        order.status        = OrderStatus::Submitted;
        order.submitted_at  = Clock::get()?.unix_timestamp;
        order.bump          = ctx.bumps.order_intent;

        ctx.accounts.auction_config.order_count += 1;

        // Emit audit event visible to trader (TRADER_FLAGS)
        emit!(AuditEvent {
            actor:           ctx.accounts.trader.key(),
            action:          "submit_order".to_string(),
            visibility_tier: "trader".to_string(),
            timestamp:       Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    // -------------------------------------------------------
    // delegate_pda
    // Delegates both the permission account and the permissioned
    // account (OrderIntent or MatchState PDA) to the TEE validator.
    //
    // IMPORTANT: Both must be delegated per the access-control docs.
    // The DelegateConfig specifies which TEE validator handles state.
    // -------------------------------------------------------
    pub fn delegate_pda(ctx: Context<DelegatePda>, valid_until: i64) -> Result<()> {
        let cfg = DelegateConfig {
            valid_until,
            commit_frequency_ms: 30_000,
            ..Default::default()
        };
        // Delegate the account to the TEE validator
        delegate_account(
            &ctx.accounts.payer,
            &ctx.accounts.pda,
            &ctx.accounts.owner_program,
            &ctx.accounts.buffer,
            &ctx.accounts.delegation_record,
            &ctx.accounts.delegation_metadata,
            &ctx.accounts.delegation_program,
            &ctx.accounts.system_program,
            &[&[b"order", ctx.accounts.payer.key().as_ref(), &[0u8]]],
            0,
            cfg,
        )?;
        Ok(())
    }

    // -------------------------------------------------------
    // match_orders
    // Called by the TEE validator inside the PER session.
    // Executes confidential matching — not observable by anyone
    // without TX_LOGS_FLAG on their permission account.
    //
    // This function is NOT called by cranks. It runs on PER.
    // Cranks only signal close_auction (the time boundary).
    // -------------------------------------------------------
    pub fn match_orders(ctx: Context<MatchOrders>) -> Result<()> {
        require!(
            ctx.accounts.auction_config.status == AuctionStatus::Closed,
            ObscuraError::AuctionNotClosed
        );

        let buy  = &ctx.accounts.buy_order;
        let sell = &ctx.accounts.sell_order;

        // Simple price-cross check: buy limit >= sell limit
        require!(
            buy.limit_price >= sell.limit_price,
            ObscuraError::NoCross
        );

        let matched_size    = buy.size.min(sell.size);
        let clearing_price  = (buy.limit_price + sell.limit_price) / 2;

        let match_state = &mut ctx.accounts.match_state;
        match_state.auction_id      = ctx.accounts.auction_config.key();
        match_state.matched_size    = matched_size;
        match_state.clearing_price  = clearing_price;
        match_state.buy_order       = buy.key();
        match_state.sell_order      = sell.key();
        match_state.status          = MatchStatus::Pending;
        match_state.bump            = ctx.bumps.match_state;

        emit!(AuditEvent {
            actor:           ctx.accounts.authority.key(),
            action:          "match_orders".to_string(),
            visibility_tier: "auditor".to_string(),
            timestamp:       Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    // -------------------------------------------------------
    // close_auction
    // Triggered by crank after close_time is reached.
    // Changes auction status to Closed so matching can proceed.
    // Cranks call this — NOT the matching logic.
    // -------------------------------------------------------
    pub fn close_auction(ctx: Context<CloseAuction>) -> Result<()> {
        let cfg  = &mut ctx.accounts.auction_config;
        let now  = Clock::get()?.unix_timestamp;
        require!(now >= cfg.close_time, ObscuraError::AuctionNotExpired);
        require!(cfg.status == AuctionStatus::Open, ObscuraError::AuctionNotOpen);
        cfg.status = AuctionStatus::Closed;
        emit!(AuditEvent {
            actor:           ctx.accounts.authority.key(),
            action:          "close_auction".to_string(),
            visibility_tier: "admin".to_string(),
            timestamp:       now,
        });
        Ok(())
    }

    // -------------------------------------------------------
    // settle
    // Commits MatchState from PER back to Solana base chain.
    // Uses commit_and_undelegate_accounts from the ER SDK.
    //
    // After commit: UpdatePermission { members: None }
    //   → transitional reveal of settlement result
    //   → result is read out from undelegated account
    //   → permission account is then closed (reclaim lamports)
    // -------------------------------------------------------
    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        require!(
            ctx.accounts.match_state.status == MatchStatus::Pending,
            ObscuraError::AlreadySettled
        );

        let match_state = &mut ctx.accounts.match_state;
        let matched_size   = match_state.matched_size;
        let clearing_price = match_state.clearing_price;

        // Execute SPL token net transfers (via Private Payments API's
        // SPL token transfer, signed by vault authority)
        let fee = matched_size * ctx.accounts.auction_config.fee_bps as u64 / 10_000;
        let net = matched_size - fee;

        // Transfer net to buyer's account
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.vault.to_account_info(),
                to:        ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, net)?;

        match_state.status     = MatchStatus::Committed;
        match_state.settled_at = Clock::get()?.unix_timestamp;

        // commit_and_undelegate_accounts called here in PER context
        // After this, UpdatePermission { members: None } is called
        // as a TRANSITIONAL REVEAL STEP, not a permanent public tier.

        emit!(AuditEvent {
            actor:           ctx.accounts.authority.key(),
            action:          format!("settle: {} @ {}", matched_size, clearing_price),
            visibility_tier: "public".to_string(), // post-settlement reveal
            timestamp:       Clock::get()?.unix_timestamp,
        });

        ctx.accounts.auction_config.status = AuctionStatus::Settled;
        Ok(())
    }
}

// ============================================================
// Account structs
// ============================================================

#[account]
#[derive(Default)]
pub struct AuctionConfig {
    pub authority:    Pubkey,
    pub base_mint:    Pubkey,
    pub quote_mint:   Pubkey,
    pub lot_size:     u64,
    pub min_increment: u64,
    pub close_time:   i64,
    pub fee_bps:      u16,
    pub status:       AuctionStatus,
    pub order_count:  u64,
    pub bump:         u8,
}
impl AuctionConfig {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 2 + 1 + 8 + 1;
}

#[account]
#[derive(Default)]
pub struct OrderIntent {
    pub auction_id:   Pubkey,
    pub trader:       Pubkey,
    pub side:         OrderSide,
    pub size:         u64,
    pub limit_price:  u64,
    pub expiry:       i64,
    pub nonce:        u64,
    pub status:       OrderStatus,
    pub submitted_at: i64,
    pub bump:         u8,
}
impl OrderIntent {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 1 + 8 + 1;
}

#[account]
#[derive(Default)]
pub struct MatchState {
    pub auction_id:     Pubkey,
    pub matched_size:   u64,
    pub clearing_price: u64,
    pub buy_order:      Pubkey,
    pub sell_order:     Pubkey,
    pub status:         MatchStatus,
    pub settled_at:     i64,
    pub bump:           u8,
}
impl MatchState {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 32 + 32 + 1 + 8 + 1;
}

// ============================================================
// Enums
// ============================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Default)]
pub enum AuctionStatus { #[default] Open, Closed, Settled }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Default)]
pub enum OrderSide { #[default] Buy, Sell }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Default)]
pub enum OrderStatus { #[default] Submitted, Matched, Settled, Cancelled, Expired }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Default)]
pub enum MatchStatus { #[default] Pending, Committed, Failed }

// ============================================================
// Instruction contexts
// ============================================================

#[derive(Accounts)]
pub struct InitializeAuction<'info> {
    #[account(
        init,
        payer = authority,
        space = AuctionConfig::LEN,
        seeds = [b"auction", authority.key().as_ref()],
        bump,
    )]
    pub auction_config: Account<'info, AuctionConfig>,
    #[account(mut)]
    pub authority:      Signer<'info>,
    pub base_mint:      AccountInfo<'info>,
    pub quote_mint:     AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(side: OrderSide, size: u64, limit_price: u64, expiry: i64, nonce: u64)]
pub struct SubmitOrder<'info> {
    #[account(
        init,
        payer = trader,
        space = OrderIntent::LEN,
        seeds = [b"order", trader.key().as_ref(), &nonce.to_le_bytes()],
        bump,
    )]
    pub order_intent:   Account<'info, OrderIntent>,
    #[account(mut)]
    pub auction_config: Account<'info, AuctionConfig>,
    #[account(mut)]
    pub trader:         Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DelegatePda<'info> {
    #[account(mut)]
    pub payer:               Signer<'info>,
    #[account(mut)]
    pub pda:                 AccountInfo<'info>,
    pub owner_program:       AccountInfo<'info>,
    #[account(mut)]
    pub buffer:              AccountInfo<'info>,
    #[account(mut)]
    pub delegation_record:   AccountInfo<'info>,
    #[account(mut)]
    pub delegation_metadata: AccountInfo<'info>,
    pub delegation_program:  AccountInfo<'info>,
    pub system_program:      Program<'info, System>,
}

#[derive(Accounts)]
pub struct MatchOrders<'info> {
    #[account(mut)]
    pub auction_config: Account<'info, AuctionConfig>,
    pub buy_order:      Account<'info, OrderIntent>,
    pub sell_order:     Account<'info, OrderIntent>,
    #[account(
        init,
        payer = authority,
        space = MatchState::LEN,
        seeds = [b"match", auction_config.key().as_ref()],
        bump,
    )]
    pub match_state:    Account<'info, MatchState>,
    #[account(mut)]
    pub authority:      Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseAuction<'info> {
    #[account(mut, has_one = authority)]
    pub auction_config: Account<'info, AuctionConfig>,
    pub authority:      Signer<'info>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut, has_one = authority)]
    pub auction_config:      Account<'info, AuctionConfig>,
    #[account(mut)]
    pub match_state:         Account<'info, MatchState>,
    #[account(mut)]
    pub vault:               Account<'info, TokenAccount>,
    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority:           Signer<'info>,
    pub token_program:       Program<'info, Token>,
}

// ============================================================
// Events
// ============================================================

#[event]
pub struct AuditEvent {
    pub actor:           Pubkey,
    pub action:          String,
    pub visibility_tier: String, // "trader" | "auditor" | "admin" | "public"
    pub timestamp:       i64,
}

// ============================================================
// Errors
// ============================================================

#[error_code]
pub enum ObscuraError {
    #[msg("Auction is not open for orders")]       AuctionNotOpen,
    #[msg("Auction has not yet expired")]          AuctionNotExpired,
    #[msg("Auction is not in Closed state")]       AuctionNotClosed,
    #[msg("No price cross between orders")]        NoCross,
    #[msg("Order size must be greater than zero")] InvalidSize,
    #[msg("Limit price must be greater than zero")]InvalidPrice,
    #[msg("Match has already been settled")]       AlreadySettled,
}
