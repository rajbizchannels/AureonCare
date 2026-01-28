/**
 * AUREONCARE MULTI-TENANT BILLING SERVICE
 *
 * Handles:
 * - Subscription management
 * - Invoice generation
 * - Usage tracking
 * - Payment processing (integration ready)
 * - Plan upgrades/downgrades
 */

const crypto = require('crypto');

/**
 * Subscription status types
 */
const SubscriptionStatus = {
    TRIAL: 'trial',
    ACTIVE: 'active',
    PAST_DUE: 'past_due',
    CANCELED: 'canceled',
    EXPIRED: 'expired',
    SUSPENDED: 'suspended'
};

/**
 * Invoice status types
 */
const InvoiceStatus = {
    DRAFT: 'draft',
    SENT: 'sent',
    PAID: 'paid',
    OVERDUE: 'overdue',
    VOID: 'void',
    REFUNDED: 'refunded'
};

/**
 * Billing Service Class
 */
class BillingService {
    constructor(pool) {
        this.pool = pool;
    }

    // =========================================================================
    // SUBSCRIPTION PLANS
    // =========================================================================

    /**
     * Get all available subscription plans
     */
    async getPlans(includeInactive = false) {
        const result = await this.pool.query(`
            SELECT * FROM tenant_subscription_plans
            WHERE ($1 = true OR is_active = true)
            AND is_public = true
            ORDER BY tier ASC, price_monthly ASC
        `, [includeInactive]);

        return result.rows;
    }

    /**
     * Get a plan by ID or code
     */
    async getPlan(idOrCode) {
        const result = await this.pool.query(`
            SELECT * FROM tenant_subscription_plans
            WHERE id::text = $1 OR code = $1
        `, [idOrCode]);

        return result.rows[0] || null;
    }

    /**
     * Create a new plan (admin only)
     */
    async createPlan(planData) {
        const {
            code, name, displayName, description,
            priceMonthly, priceYearly, pricePerUserMonthly, pricePerPatientMonthly,
            setupFee, includedUsers, maxUsers, includedPatients, maxPatients,
            includedProviders, maxProviders, includedStorageGb, maxStorageGb,
            apiCallsPerMonth, features, tier, isPublic, trialDays
        } = planData;

        const result = await this.pool.query(`
            INSERT INTO tenant_subscription_plans (
                code, name, display_name, description,
                price_monthly, price_yearly, price_per_user_monthly, price_per_patient_monthly,
                setup_fee, included_users, max_users, included_patients, max_patients,
                included_providers, max_providers, included_storage_gb, max_storage_gb,
                api_calls_per_month, features, tier, is_public, trial_days
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            RETURNING *
        `, [
            code, name, displayName, description,
            priceMonthly, priceYearly, pricePerUserMonthly, pricePerPatientMonthly,
            setupFee, includedUsers, maxUsers, includedPatients, maxPatients,
            includedProviders, maxProviders, includedStorageGb, maxStorageGb,
            apiCallsPerMonth, JSON.stringify(features), tier, isPublic, trialDays
        ]);

        return result.rows[0];
    }

    // =========================================================================
    // SUBSCRIPTIONS
    // =========================================================================

    /**
     * Get tenant subscription
     */
    async getSubscription(tenantId) {
        const result = await this.pool.query(`
            SELECT
                ts.*,
                tsp.code as plan_code,
                tsp.name as plan_name,
                tsp.display_name as plan_display_name,
                tsp.features as plan_features,
                tsp.max_users as plan_max_users,
                tsp.max_patients as plan_max_patients,
                tsp.max_providers as plan_max_providers,
                tsp.max_storage_gb as plan_max_storage_gb
            FROM tenant_subscriptions ts
            JOIN tenant_subscription_plans tsp ON ts.plan_id = tsp.id
            WHERE ts.tenant_id = $1
        `, [tenantId]);

        return result.rows[0] || null;
    }

    /**
     * Create a new subscription (for new tenants)
     */
    async createSubscription(tenantId, planCode, billingCycle = 'monthly', startTrial = true) {
        const plan = await this.getPlan(planCode);
        if (!plan) {
            throw new Error(`Plan not found: ${planCode}`);
        }

        const basePrice = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
        const trialEndDate = startTrial && plan.trial_days > 0
            ? new Date(Date.now() + plan.trial_days * 24 * 60 * 60 * 1000)
            : null;

        const result = await this.pool.query(`
            INSERT INTO tenant_subscriptions (
                tenant_id, plan_id, status, billing_cycle,
                start_date, trial_start_date, trial_end_date,
                base_price, per_user_price, per_patient_price,
                next_billing_date
            ) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            tenantId,
            plan.id,
            startTrial && plan.trial_days > 0 ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
            billingCycle,
            startTrial ? new Date() : null,
            trialEndDate,
            basePrice,
            plan.price_per_user_monthly,
            plan.price_per_patient_monthly,
            trialEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ]);

        // Update tenant limits based on plan
        await this.pool.query(`
            UPDATE tenants
            SET max_users = $2, max_patients = $3, max_providers = $4, max_storage_gb = $5, features = $6
            WHERE id = $1
        `, [tenantId, plan.max_users, plan.max_patients, plan.max_providers, plan.max_storage_gb, JSON.stringify(plan.features)]);

        return result.rows[0];
    }

    /**
     * Upgrade or downgrade subscription
     */
    async changePlan(tenantId, newPlanCode, immediate = true) {
        const currentSub = await this.getSubscription(tenantId);
        if (!currentSub) {
            throw new Error('No active subscription found');
        }

        const newPlan = await this.getPlan(newPlanCode);
        if (!newPlan) {
            throw new Error(`Plan not found: ${newPlanCode}`);
        }

        const newBasePrice = currentSub.billing_cycle === 'yearly'
            ? newPlan.price_yearly
            : newPlan.price_monthly;

        // Calculate prorated amount if upgrading
        let proratedCredit = 0;
        if (immediate && newPlan.tier > currentSub.plan_tier) {
            const daysRemaining = Math.ceil(
                (new Date(currentSub.next_billing_date) - new Date()) / (24 * 60 * 60 * 1000)
            );
            const dailyRate = currentSub.base_price / 30;
            proratedCredit = dailyRate * daysRemaining;
        }

        // Update subscription
        await this.pool.query(`
            UPDATE tenant_subscriptions
            SET plan_id = $2, base_price = $3, per_user_price = $4, per_patient_price = $5,
                updated_at = NOW()
            WHERE tenant_id = $1
        `, [
            tenantId,
            newPlan.id,
            newBasePrice,
            newPlan.price_per_user_monthly,
            newPlan.price_per_patient_monthly
        ]);

        // Update tenant limits
        await this.pool.query(`
            UPDATE tenants
            SET max_users = $2, max_patients = $3, max_providers = $4, max_storage_gb = $5, features = $6
            WHERE id = $1
        `, [tenantId, newPlan.max_users, newPlan.max_patients, newPlan.max_providers, newPlan.max_storage_gb, JSON.stringify(newPlan.features)]);

        // Generate prorated invoice if applicable
        if (proratedCredit > 0) {
            await this.generateInvoice(tenantId, {
                description: `Plan upgrade: ${currentSub.plan_name} to ${newPlan.name}`,
                items: [{
                    description: `Credit for remaining ${currentSub.plan_name} period`,
                    amount: -proratedCredit
                }, {
                    description: `${newPlan.name} (prorated)`,
                    amount: newBasePrice - proratedCredit
                }]
            });
        }

        return this.getSubscription(tenantId);
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(tenantId, reason, immediate = false) {
        const result = await this.pool.query(`
            UPDATE tenant_subscriptions
            SET
                status = $2,
                canceled_at = NOW(),
                cancellation_reason = $3,
                end_date = $4
            WHERE tenant_id = $1
            RETURNING *
        `, [
            tenantId,
            immediate ? SubscriptionStatus.CANCELED : SubscriptionStatus.ACTIVE,
            reason,
            immediate ? new Date() : null
        ]);

        if (immediate) {
            // Suspend tenant access
            await this.pool.query(`
                UPDATE tenants SET status = 'suspended' WHERE id = $1
            `, [tenantId]);
        }

        return result.rows[0];
    }

    /**
     * Reactivate canceled subscription
     */
    async reactivateSubscription(tenantId) {
        const result = await this.pool.query(`
            UPDATE tenant_subscriptions
            SET
                status = 'active',
                canceled_at = NULL,
                cancellation_reason = NULL,
                end_date = NULL
            WHERE tenant_id = $1
            RETURNING *
        `, [tenantId]);

        await this.pool.query(`
            UPDATE tenants SET status = 'active' WHERE id = $1
        `, [tenantId]);

        return result.rows[0];
    }

    // =========================================================================
    // INVOICES
    // =========================================================================

    /**
     * Generate an invoice
     */
    async generateInvoice(tenantId, options = {}) {
        const subscription = await this.getSubscription(tenantId);
        if (!subscription) {
            throw new Error('No subscription found');
        }

        const {
            description = 'Monthly subscription',
            items = [],
            periodStart = new Date(),
            periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            taxRate = 0
        } = options;

        // Generate invoice number
        const invoiceNumber = await this.generateInvoiceNumber(tenantId);

        // Calculate totals
        let subtotal = subscription.base_price;

        // Add usage-based charges
        if (subscription.current_users > subscription.plan_included_users) {
            const extraUsers = subscription.current_users - subscription.plan_included_users;
            items.push({
                description: `Additional users (${extraUsers})`,
                quantity: extraUsers,
                unitPrice: subscription.per_user_price,
                amount: extraUsers * subscription.per_user_price
            });
            subtotal += extraUsers * subscription.per_user_price;
        }

        // Add any custom items
        for (const item of items) {
            if (item.amount) {
                subtotal += item.amount;
            }
        }

        const taxAmount = subtotal * (taxRate / 100);
        const totalAmount = subtotal + taxAmount;

        // Create line items JSON
        const lineItems = [
            {
                description: `${subscription.plan_display_name} - ${subscription.billing_cycle}`,
                quantity: 1,
                unitPrice: subscription.base_price,
                amount: subscription.base_price
            },
            ...items
        ];

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        const result = await this.pool.query(`
            INSERT INTO tenant_invoices (
                tenant_id, subscription_id, invoice_number, status,
                invoice_date, due_date, period_start, period_end,
                subtotal, tax_rate, tax_amount, total_amount, amount_due,
                line_items, notes
            ) VALUES ($1, $2, $3, 'sent', CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12)
            RETURNING *
        `, [
            tenantId,
            subscription.id,
            invoiceNumber,
            dueDate,
            periodStart,
            periodEnd,
            subtotal,
            taxRate,
            taxAmount,
            totalAmount,
            JSON.stringify(lineItems),
            description
        ]);

        return result.rows[0];
    }

    /**
     * Generate unique invoice number
     */
    async generateInvoiceNumber(tenantId) {
        const tenantResult = await this.pool.query(
            'SELECT tenant_code FROM tenants WHERE id = $1',
            [tenantId]
        );
        const tenantCode = tenantResult.rows[0]?.tenant_code || 'UNKNOWN';
        const year = new Date().getFullYear();

        const countResult = await this.pool.query(`
            SELECT COUNT(*) FROM tenant_invoices
            WHERE tenant_id = $1
            AND EXTRACT(YEAR FROM invoice_date) = $2
        `, [tenantId, year]);

        const sequence = parseInt(countResult.rows[0].count) + 1;

        return `INV-${tenantCode.toUpperCase()}-${year}-${String(sequence).padStart(5, '0')}`;
    }

    /**
     * Get invoices for a tenant
     */
    async getInvoices(tenantId, options = {}) {
        const { status, limit = 20, offset = 0 } = options;

        let query = `
            SELECT * FROM tenant_invoices
            WHERE tenant_id = $1
        `;
        const params = [tenantId];

        if (status) {
            query += ` AND status = $${params.length + 1}`;
            params.push(status);
        }

        query += ` ORDER BY invoice_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await this.pool.query(query, params);
        return result.rows;
    }

    /**
     * Get invoice by ID
     */
    async getInvoice(invoiceId) {
        const result = await this.pool.query(
            'SELECT * FROM tenant_invoices WHERE id = $1',
            [invoiceId]
        );
        return result.rows[0] || null;
    }

    /**
     * Record payment for an invoice
     */
    async recordPayment(invoiceId, paymentData) {
        const { amount, paymentMethod, paymentReference } = paymentData;

        const invoice = await this.getInvoice(invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }

        const newAmountPaid = parseFloat(invoice.amount_paid) + parseFloat(amount);
        const newAmountDue = parseFloat(invoice.total_amount) - newAmountPaid;

        const result = await this.pool.query(`
            UPDATE tenant_invoices
            SET
                amount_paid = $2,
                amount_due = $3,
                status = $4,
                paid_date = $5,
                payment_method = $6,
                payment_reference = $7
            WHERE id = $1
            RETURNING *
        `, [
            invoiceId,
            newAmountPaid,
            newAmountDue,
            newAmountDue <= 0 ? InvoiceStatus.PAID : invoice.status,
            newAmountDue <= 0 ? new Date() : null,
            paymentMethod,
            paymentReference
        ]);

        // Update subscription status if was past due
        if (newAmountDue <= 0) {
            await this.pool.query(`
                UPDATE tenant_subscriptions
                SET status = 'active', last_billing_date = CURRENT_DATE
                WHERE tenant_id = $1 AND status = 'past_due'
            `, [invoice.tenant_id]);
        }

        return result.rows[0];
    }

    // =========================================================================
    // USAGE TRACKING
    // =========================================================================

    /**
     * Update usage metrics for a tenant
     */
    async updateUsage(tenantId) {
        // Count active users
        const usersResult = await this.pool.query(`
            SELECT COUNT(*) FROM users u
            JOIN tenant_users tu ON tu.user_id = u.id
            WHERE tu.tenant_id = $1 AND u.status = 'active'
        `, [tenantId]);

        // Count patients
        const patientsResult = await this.pool.query(`
            SELECT COUNT(*) FROM patients WHERE tenant_id = $1 AND status = 'active'
        `, [tenantId]);

        // Count providers
        const providersResult = await this.pool.query(`
            SELECT COUNT(*) FROM providers WHERE tenant_id = $1 AND status = 'active'
        `, [tenantId]);

        // Calculate storage (example - would need actual implementation)
        const storageUsed = 0; // Placeholder

        const usageMonth = new Date().toISOString().slice(0, 7);

        await this.pool.query(`
            INSERT INTO tenant_usage (
                tenant_id, usage_date, usage_month,
                active_users, active_patients, active_providers,
                storage_used_bytes
            ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
            ON CONFLICT (tenant_id, usage_date)
            DO UPDATE SET
                active_users = EXCLUDED.active_users,
                active_patients = EXCLUDED.active_patients,
                active_providers = EXCLUDED.active_providers,
                storage_used_bytes = EXCLUDED.storage_used_bytes,
                updated_at = NOW()
        `, [
            tenantId,
            usageMonth,
            usersResult.rows[0].count,
            patientsResult.rows[0].count,
            providersResult.rows[0].count,
            storageUsed
        ]);

        // Update subscription current counts
        await this.pool.query(`
            UPDATE tenant_subscriptions
            SET
                current_users = $2,
                current_patients = $3,
                current_providers = $4,
                current_storage_gb = $5
            WHERE tenant_id = $1
        `, [
            tenantId,
            usersResult.rows[0].count,
            patientsResult.rows[0].count,
            providersResult.rows[0].count,
            storageUsed / (1024 * 1024 * 1024)
        ]);
    }

    /**
     * Get usage history for a tenant
     */
    async getUsageHistory(tenantId, options = {}) {
        const { startDate, endDate, groupBy = 'day' } = options;

        let query;
        const params = [tenantId];

        if (groupBy === 'month') {
            query = `
                SELECT
                    usage_month,
                    MAX(active_users) as max_users,
                    MAX(active_patients) as max_patients,
                    MAX(active_providers) as max_providers,
                    SUM(api_calls) as total_api_calls,
                    SUM(appointments_created) as total_appointments,
                    SUM(claims_submitted) as total_claims
                FROM tenant_usage
                WHERE tenant_id = $1
            `;
        } else {
            query = `
                SELECT *
                FROM tenant_usage
                WHERE tenant_id = $1
            `;
        }

        if (startDate) {
            params.push(startDate);
            query += ` AND usage_date >= $${params.length}`;
        }

        if (endDate) {
            params.push(endDate);
            query += ` AND usage_date <= $${params.length}`;
        }

        if (groupBy === 'month') {
            query += ` GROUP BY usage_month ORDER BY usage_month DESC`;
        } else {
            query += ` ORDER BY usage_date DESC`;
        }

        const result = await this.pool.query(query, params);
        return result.rows;
    }

    /**
     * Track API call
     */
    async trackApiCall(tenantId, endpoint) {
        const usageMonth = new Date().toISOString().slice(0, 7);

        await this.pool.query(`
            INSERT INTO tenant_usage (tenant_id, usage_date, usage_month, api_calls, api_calls_by_endpoint)
            VALUES ($1, CURRENT_DATE, $2, 1, $3)
            ON CONFLICT (tenant_id, usage_date)
            DO UPDATE SET
                api_calls = tenant_usage.api_calls + 1,
                api_calls_by_endpoint = tenant_usage.api_calls_by_endpoint || $3
        `, [tenantId, usageMonth, JSON.stringify({ [endpoint]: 1 })]);
    }

    // =========================================================================
    // PAYMENT METHODS
    // =========================================================================

    /**
     * Add payment method
     */
    async addPaymentMethod(tenantId, methodData) {
        const {
            type, provider, providerPaymentMethodId,
            cardBrand, cardLastFour, cardExpMonth, cardExpYear,
            bankName, bankLastFour, accountType,
            billingName, billingAddress,
            isDefault = false
        } = methodData;

        // If setting as default, unset other defaults
        if (isDefault) {
            await this.pool.query(`
                UPDATE tenant_payment_methods
                SET is_default = false
                WHERE tenant_id = $1
            `, [tenantId]);
        }

        const result = await this.pool.query(`
            INSERT INTO tenant_payment_methods (
                tenant_id, type, provider, provider_payment_method_id,
                card_brand, card_last_four, card_exp_month, card_exp_year,
                bank_name, bank_last_four, account_type,
                billing_name, billing_address, is_default
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `, [
            tenantId, type, provider, providerPaymentMethodId,
            cardBrand, cardLastFour, cardExpMonth, cardExpYear,
            bankName, bankLastFour, accountType,
            billingName, JSON.stringify(billingAddress), isDefault
        ]);

        return result.rows[0];
    }

    /**
     * Get payment methods for a tenant
     */
    async getPaymentMethods(tenantId) {
        const result = await this.pool.query(`
            SELECT * FROM tenant_payment_methods
            WHERE tenant_id = $1 AND status = 'active'
            ORDER BY is_default DESC, created_at DESC
        `, [tenantId]);

        return result.rows;
    }

    /**
     * Delete payment method
     */
    async deletePaymentMethod(tenantId, paymentMethodId) {
        await this.pool.query(`
            UPDATE tenant_payment_methods
            SET status = 'deleted'
            WHERE id = $1 AND tenant_id = $2
        `, [paymentMethodId, tenantId]);
    }

    // =========================================================================
    // BILLING CYCLE PROCESSING
    // =========================================================================

    /**
     * Process billing for all tenants due
     */
    async processBillingCycle() {
        // Get all subscriptions due for billing
        const dueSubscriptions = await this.pool.query(`
            SELECT ts.*, t.tenant_code, t.name as tenant_name, t.primary_email
            FROM tenant_subscriptions ts
            JOIN tenants t ON ts.tenant_id = t.id
            WHERE ts.status IN ('active', 'trial')
            AND ts.next_billing_date <= CURRENT_DATE
            AND t.status = 'active'
        `);

        const results = {
            processed: 0,
            failed: 0,
            errors: []
        };

        for (const sub of dueSubscriptions.rows) {
            try {
                // Check if trial ended
                if (sub.status === SubscriptionStatus.TRIAL) {
                    if (new Date(sub.trial_end_date) <= new Date()) {
                        await this.pool.query(`
                            UPDATE tenant_subscriptions
                            SET status = 'active'
                            WHERE id = $1
                        `, [sub.id]);
                    } else {
                        // Still in trial, skip billing
                        continue;
                    }
                }

                // Generate invoice
                await this.generateInvoice(sub.tenant_id);

                // Update next billing date
                const nextBillingDate = new Date();
                nextBillingDate.setMonth(
                    nextBillingDate.getMonth() + (sub.billing_cycle === 'yearly' ? 12 : 1)
                );

                await this.pool.query(`
                    UPDATE tenant_subscriptions
                    SET next_billing_date = $2, last_billing_date = CURRENT_DATE
                    WHERE id = $1
                `, [sub.id, nextBillingDate]);

                // Update usage
                await this.updateUsage(sub.tenant_id);

                results.processed++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    tenantId: sub.tenant_id,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Check and handle overdue invoices
     */
    async processOverdueInvoices() {
        // Mark invoices as overdue
        await this.pool.query(`
            UPDATE tenant_invoices
            SET status = 'overdue'
            WHERE status = 'sent'
            AND due_date < CURRENT_DATE
        `);

        // Get tenants with overdue invoices
        const overdueResult = await this.pool.query(`
            SELECT DISTINCT tenant_id
            FROM tenant_invoices
            WHERE status = 'overdue'
            AND due_date < CURRENT_DATE - INTERVAL '7 days'
        `);

        // Mark subscriptions as past due
        for (const row of overdueResult.rows) {
            await this.pool.query(`
                UPDATE tenant_subscriptions
                SET status = 'past_due'
                WHERE tenant_id = $1 AND status = 'active'
            `, [row.tenant_id]);
        }

        return overdueResult.rows.length;
    }
}

/**
 * Create billing service instance
 */
function createBillingService(pool) {
    return new BillingService(pool);
}

module.exports = {
    BillingService,
    createBillingService,
    SubscriptionStatus,
    InvoiceStatus
};
