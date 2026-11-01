CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"areas" text NOT NULL
);

CREATE TABLE "drivers" (
	"id" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"active" integer DEFAULT 1 NOT NULL
);

CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"actor" text NOT NULL,
	"text" text NOT NULL,
	"created" text NOT NULL
);

CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient" text NOT NULL,
	"order_id" text NOT NULL,
	"text" text NOT NULL,
	"seen" integer DEFAULT 0 NOT NULL,
	"created" text NOT NULL
);

CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"customer" text NOT NULL,
	"store" text NOT NULL,
	"merchant" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"area" text NOT NULL,
	"address" text NOT NULL,
	"notes" text NOT NULL,
	"items" text NOT NULL,
	"subtotal" integer NOT NULL,
	"delivery" integer NOT NULL,
	"service" integer NOT NULL,
	"total" integer NOT NULL,
	"status" text NOT NULL,
	"courier" text,
	"driver" text,
	"pin" text NOT NULL,
	"pin_attempts" integer DEFAULT 0 NOT NULL,
	"created" text NOT NULL,
	"updated" text NOT NULL,
	"request_key" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL
);

CREATE UNIQUE INDEX "orders_request_key_unique" ON "orders" ("request_key");
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"store" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"available" integer DEFAULT 1 NOT NULL
);

CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"role" text NOT NULL,
	"approved" integer DEFAULT 0 NOT NULL,
	"created" text NOT NULL
);

CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);

CREATE TABLE "stores" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"address" text NOT NULL,
	"area" text NOT NULL,
	"image" text NOT NULL,
	"open" integer DEFAULT 0 NOT NULL,
	"prep" integer DEFAULT 25 NOT NULL,
	"created" text NOT NULL
);

CREATE UNIQUE INDEX "stores_owner_unique" ON "stores" ("owner");

CREATE TABLE "support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"reply" text DEFAULT '' NOT NULL,
	"created" text NOT NULL
);


-- Row-level security denies direct anon/authenticated access. The server-only database connection enforces per-request authorization.
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.companies FROM anon, authenticated;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.drivers FROM anon, authenticated;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.events FROM anon, authenticated;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notifications FROM anon, authenticated;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.orders FROM anon, authenticated;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.products FROM anon, authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.settings FROM anon, authenticated;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stores FROM anon, authenticated;

CREATE INDEX orders_customer_created_idx ON orders(customer,created);
CREATE INDEX orders_merchant_created_idx ON orders(merchant,created);
CREATE INDEX orders_courier_created_idx ON orders(courier,created);
CREATE INDEX products_store_idx ON products(store);
CREATE INDEX events_order_idx ON events(order_id,created);
CREATE INDEX notifications_recipient_idx ON notifications(recipient,created);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_tickets FROM anon, authenticated;
