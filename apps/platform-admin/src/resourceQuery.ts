export type AdminResource = "stores" | "users" | "orders" | "payments" | "deployments";

export function buildResourceQuery({ resource, search, filter, page, paymentSource }: {
  resource: AdminResource;
  search: string;
  filter: string;
  page: number;
  paymentSource: "store" | "membership";
}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (filter) params.set(resource === "users" ? "role" : "status", filter);
  if (page > 1) params.set("page", String(page));
  if (resource === "payments" && paymentSource === "membership") params.set("ledger", "membership");
  return params;
}
