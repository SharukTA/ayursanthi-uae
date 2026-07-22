-- Removes the Razorpay integration. Razorpay does not operate in the UAE, so the
-- storefront now takes Cash on Delivery only: the order is created immediately at
-- checkout and the cash is collected by the courier.
--
-- PendingCheckout existed purely to hold a priced snapshot between "Razorpay order
-- created" and "payment verified" (by the browser or the webhook). With no gateway
-- round-trip there is no in-between state, so the table goes away.

-- DropTable
DROP TABLE "PendingCheckout";
