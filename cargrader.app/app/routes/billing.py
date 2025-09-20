# cargrader.app/app/routes/billing.py
from flask import Blueprint, render_template, request, redirect, url_for, session, current_app, jsonify
from app.utils.auth import requires_login
from app.utils.access import grant_or_extend_pass, has_active_pass_for_session
import os, stripe

billing_bp = Blueprint("billing", __name__)

# Stripe config
def _stripe():
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
    return stripe

PRICE_10 = os.getenv("STRIPE_PRICE_10")  # e.g. price_xxx for 10-day
PRICE_30 = os.getenv("STRIPE_PRICE_30")  # e.g. price_yyy for 30-day

PLAN_MAP = {
    "10": {"price": PRICE_10, "days": 10},
    "30": {"price": PRICE_30, "days": 30},
}

@billing_bp.get("/store")
@requires_login
def store():
    """Simple storefront that shows the two pass options."""
    # Optional: fetch amounts from Stripe so you can show $ prices.
    s = _stripe()
    def _price_info(pid):
        if not pid: 
            return None
        try:
            p = s.Price.retrieve(pid)
            return {
                "id": p.id,
                "unit_amount": p.unit_amount,   # cents
                "currency": p.currency.upper(),
            }
        except Exception:
            return None

    info10 = _price_info(PRICE_10)
    info30 = _price_info(PRICE_30)

    return render_template("store.html",
                           p10=info10,
                           p30=info30,
                           has_pass=has_active_pass_for_session())

@billing_bp.post("/billing/checkout")
@requires_login
def checkout():
    """Create a Stripe Checkout Session for a chosen plan."""
    plan = request.form.get("plan")  # "10" or "30"
    if plan not in PLAN_MAP or not PLAN_MAP[plan]["price"]:
        return "Unknown plan.", 400

    user = session.get("user") or {}
    user_sub = user.get("sub")
    user_email = user.get("email")

    base = current_app.config.get("BASE_URL", "").rstrip("/")
    success_url = f"{base}/account?paid=1&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url  = f"{base}/store"

    s = _stripe()
    try:
        cs = s.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[{"price": PLAN_MAP[plan]["price"], "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=user_email,
            client_reference_id=user_sub,   # tie the checkout to the Auth0 user
            metadata={"user_sub": user_sub, "days": str(PLAN_MAP[plan]["days"])},
            allow_promotion_codes=True,
        )
        return redirect(cs.url, code=303)
    except Exception as e:
        current_app.logger.exception("Stripe checkout create failed")
        return f"Stripe checkout error: {e}", 500

@billing_bp.post("/webhook/stripe")
def stripe_webhook():
    """Stripe webhook to activate/extend passes."""
    payload = request.data
    sig = request.headers.get("Stripe-Signature")
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    s = _stripe()

    try:
        event = s.Webhook.construct_event(payload, sig, endpoint_secret)
    except Exception as e:
        current_app.logger.exception("Invalid Stripe webhook signature")
        return "Invalid signature", 400

    if event["type"] == "checkout.session.completed":
        sess = event["data"]["object"]
        user_sub = (sess.get("metadata") or {}).get("user_sub") or sess.get("client_reference_id")
        days = int((sess.get("metadata") or {}).get("days") or 0)
        stripe_session_id = sess.get("id")
        stripe_customer_id = sess.get("customer")

        if user_sub and days > 0:
            try:
                grant_or_extend_pass(user_sub, days, stripe_session_id, stripe_customer_id)
            except Exception:
                current_app.logger.exception("Failed to grant/extend pass in DB")

    return jsonify(ok=True)

@billing_bp.get("/account")
@requires_login
def account():
    # Fallback fulfillment: if we arrive with a Stripe session_id, verify & grant.
    sess_id = request.args.get("session_id")
    if sess_id:
        s = _stripe()
        try:
            cs = s.checkout.Session.retrieve(sess_id)
            # 'complete' means Checkout finished; payment_status can be 'paid' or 'no_payment_required' for 100% off
            if getattr(cs, "status", None) == "complete" and getattr(cs, "payment_status", None) in ("paid", "no_payment_required"):
                md = (cs.metadata or {})
                user_sub = md.get("user_sub") or cs.client_reference_id
                days = int(md.get("days") or 0)
                if user_sub and days > 0:
                    # UNIQUE(stripe_session_id) makes this idempotent if the webhook already granted it.
                    grant_or_extend_pass(user_sub, days, cs.id, cs.customer)
        except Exception:
            current_app.logger.exception("Account fulfillment grant failed")

    return render_template("account.html", has_pass=has_active_pass_for_session())
