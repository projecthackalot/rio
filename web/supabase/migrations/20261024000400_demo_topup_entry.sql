-- Demo/test projects reuse the same accounts many times; automated purchase
-- tests drain their sandbox wallets. A distinct ledger type keeps the ledger
-- honest about where the (simulated) money came from. Used only by the
-- operator script `npm run seed:demo -- --refresh`.
alter type public.ledger_entry_type add value if not exists 'DEMO_TOPUP';
