import type { Customer } from "../api/client";
import type { CheckoutContact } from "./types";

/**
 * Checkout identity and delivery details already known by the customer account.
 * Country is intentionally excluded because the current checkout contract does
 * not collect it; it remains available in the customer's saved profile.
 */
export function contactFromCustomer(customer: Customer): CheckoutContact {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    city: customer.city,
    address: customer.address,
  };
}

/**
 * Hydrate only blank checkout fields. This lets a profile arriving after the
 * customer opened checkout fill the form without replacing anything they have
 * already typed for this delivery.
 */
export function fillMissingContact(
  current: CheckoutContact,
  customer: Customer,
): CheckoutContact {
  const saved = contactFromCustomer(customer);
  return {
    firstName: current.firstName.trim() ? current.firstName : saved.firstName,
    lastName: current.lastName.trim() ? current.lastName : saved.lastName,
    email: current.email.trim() ? current.email : saved.email,
    phone: current.phone.trim() ? current.phone : saved.phone,
    city: current.city.trim() ? current.city : saved.city,
    address: current.address.trim() ? current.address : saved.address,
  };
}
