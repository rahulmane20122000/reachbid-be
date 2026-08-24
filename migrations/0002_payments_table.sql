-- Migration: 0002_payments_table.sql
-- Adds a payment_logs table to track Razorpay payment records in Cloudflare D1

CREATE TABLE IF NOT EXISTS payment_logs (
    id TEXT PRIMARY KEY,                          -- Internal unique ID (e.g. pay_log_xyz)
    company_id TEXT,                              -- Company associated with the payment (nullable for new listings)
    company_name TEXT NOT NULL,                   -- Company name at time of payment
    razorpay_order_id TEXT NOT NULL,              -- Razorpay Order ID (order_XXXX)
    razorpay_payment_id TEXT,                     -- Razorpay Payment ID on success (pay_XXXX), NULL if pending
    amount INTEGER NOT NULL,                      -- Amount in paise (e.g. 13000 = ₹130)
    currency TEXT NOT NULL DEFAULT 'INR',         -- Payment currency
    status TEXT NOT NULL DEFAULT 'pending',       -- pending | success | failed | cancelled
    payment_type TEXT NOT NULL DEFAULT 'outbid',  -- outbid | new_listing
    error_description TEXT,                       -- Error message if payment failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_status ON payment_logs(status);
CREATE INDEX IF NOT EXISTS idx_payment_logs_company_id ON payment_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_razorpay_order_id ON payment_logs(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON payment_logs(created_at);
