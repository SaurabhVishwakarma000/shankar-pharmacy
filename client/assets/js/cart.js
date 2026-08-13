/**
 * cart.js
 * -------------------------------------------------------------------------
 * Client-side shopping cart for the medicine search results, plus a
 * checkout flow that hands the order off to WhatsApp.
 *
 * IMPORTANT - how the WhatsApp handoff actually works:
 * Clicking "Place Order" opens WhatsApp (app or web) with the order
 * message already typed into the chat with the pharmacy's number. The
 * customer still has to tap Send themselves inside WhatsApp - no website
 * can send a WhatsApp message automatically without WhatsApp's paid
 * Business API. Because the customer sends it from their own WhatsApp
 * account, the pharmacy receives the order from the customer's own
 * number, with their name/mobile/address and (if they allowed it) a
 * Google Maps link to their current location.
 *
 * Cart contents persist in localStorage (this is a plain delivered
 * website, not a Claude Artifact, so localStorage is fine here) so the
 * cart survives a page reload.
 * -------------------------------------------------------------------------
 */

(function () {
  "use strict";

  const CART_STORAGE_KEY = "shankar_pharmacy_cart";
  const PHARMACY_WHATSAPP_NUMBER = "918810455046"; // wa.me format: country code + number, no + or spaces

  // --- Cart state (persisted to localStorage) ---
  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      // Storage unavailable (private browsing, quota) - cart just won't
      // persist across reloads; the in-memory state for this page load
      // still works fine.
    }
  }

  let cart = loadCart();
  const listeners = [];

  function notify() {
    saveCart(cart);
    listeners.forEach(function (fn) {
      fn(cart);
    });
  }

  function addItem(medicine, quantity) {
    quantity = Math.max(1, Math.floor(quantity) || 1);
    const existing = cart.find(function (item) {
      return item.id === medicine.id;
    });
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({
        id: medicine.id,
        name: medicine.name,
        price: medicine.price,
        quantity: quantity
      });
    }
    notify();
  }

  function removeItem(id) {
    cart = cart.filter(function (item) {
      return item.id !== id;
    });
    notify();
  }

  function setQuantity(id, quantity) {
    const item = cart.find(function (i) {
      return i.id === id;
    });
    if (!item) return;
    quantity = Math.floor(quantity);
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    item.quantity = quantity;
    notify();
  }

  function clearCart() {
    cart = [];
    notify();
  }

  function getCart() {
    return cart.slice();
  }

  function getTotal() {
    return cart.reduce(function (sum, item) {
      return sum + item.price * item.quantity;
    }, 0);
  }

  function getCount() {
    return cart.reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  // Exposed so medicine-search.js can add items without a circular
  // script-order dependency.
  window.PharmacyCart = { addItem, removeItem, setQuantity, clearCart, getCart, getTotal, getCount, onChange };

  // --- UI wiring (only runs if the cart widgets are present on this page) ---
  document.addEventListener("DOMContentLoaded", function () {
    const floatBtn = document.getElementById("cart-float-btn");
    const floatCount = document.getElementById("cart-float-count");
    if (!floatBtn) return; // cart UI not present on this page

    const cartModalEl = document.getElementById("cart-modal");
    const cartModal = new bootstrap.Modal(cartModalEl);
    const itemsList = document.getElementById("cart-items-list");
    const emptyMessage = document.getElementById("cart-empty-message");
    const totalRow = document.getElementById("cart-total-row");
    const totalAmount = document.getElementById("cart-total-amount");
    const clearBtn = document.getElementById("cart-clear-btn");
    const proceedBtn = document.getElementById("cart-proceed-btn");

    const checkoutModalEl = document.getElementById("checkout-modal");
    const checkoutModal = new bootstrap.Modal(checkoutModalEl);
    const checkoutError = document.getElementById("checkout-form-error");
    const checkoutName = document.getElementById("checkout-name");
    const checkoutMobile = document.getElementById("checkout-mobile");
    const checkoutAddress = document.getElementById("checkout-address");
    const detectLocationBtn = document.getElementById("checkout-detect-location-btn");
    const locationStatus = document.getElementById("checkout-location-status");
    const placeOrderBtn = document.getElementById("checkout-place-order-btn");

    const successModalEl = document.getElementById("order-success-modal");
    const successModal = new bootstrap.Modal(successModalEl);

    let detectedLocation = null; // { lat, lng, mapsLink } once detected

    function renderCartBadge() {
      const count = window.PharmacyCart.getCount();
      if (count > 0) {
        floatCount.textContent = count;
        floatCount.style.display = "flex";
      } else {
        floatCount.style.display = "none";
      }
    }

    function renderCartModal() {
      const items = window.PharmacyCart.getCart();

      if (items.length === 0) {
        itemsList.innerHTML = "";
        emptyMessage.style.display = "block";
        totalRow.style.display = "none";
        proceedBtn.disabled = true;
        return;
      }

      emptyMessage.style.display = "none";
      totalRow.style.display = "flex";
      proceedBtn.disabled = false;
      itemsList.innerHTML = "";

      items.forEach(function (item) {
        const row = document.createElement("div");
        row.className = "cart-item-row";
        row.innerHTML =
          '<div class="cart-item-info">' +
            '<div class="cart-item-name"></div>' +
            '<div class="cart-item-line-total"></div>' +
          "</div>" +
          '<div class="cart-item-qty">' +
            '<button type="button" class="qty-btn qty-minus" aria-label="Decrease quantity">-</button>' +
            '<span class="qty-value"></span>' +
            '<button type="button" class="qty-btn qty-plus" aria-label="Increase quantity">+</button>' +
          "</div>" +
          '<button type="button" class="cart-item-remove" aria-label="Remove item"><i class="bi bi-trash"></i></button>';

        row.querySelector(".cart-item-name").textContent = item.name;
        row.querySelector(".cart-item-line-total").textContent = "\u20B9" + (item.price * item.quantity);
        row.querySelector(".qty-value").textContent = item.quantity;

        row.querySelector(".qty-minus").addEventListener("click", function () {
          window.PharmacyCart.setQuantity(item.id, item.quantity - 1);
        });
        row.querySelector(".qty-plus").addEventListener("click", function () {
          window.PharmacyCart.setQuantity(item.id, item.quantity + 1);
        });
        row.querySelector(".cart-item-remove").addEventListener("click", function () {
          window.PharmacyCart.removeItem(item.id);
        });

        itemsList.appendChild(row);
      });

      totalAmount.textContent = "\u20B9" + window.PharmacyCart.getTotal();
    }

    window.PharmacyCart.onChange(function () {
      renderCartBadge();
      renderCartModal();
    });
    renderCartBadge();
    renderCartModal();

    floatBtn.addEventListener("click", function () {
      cartModal.show();
    });

    clearBtn.addEventListener("click", function () {
      window.PharmacyCart.clearCart();
    });

    proceedBtn.addEventListener("click", function () {
      cartModal.hide();
      checkoutError.style.display = "none";
      checkoutModal.show();
    });

    // --- Detect location ---
    detectLocationBtn.addEventListener("click", function () {
      if (!navigator.geolocation) {
        locationStatus.textContent = "Location detection is not supported on this browser.";
        return;
      }

      detectLocationBtn.disabled = true;
      locationStatus.textContent = "Detecting your location...";

      navigator.geolocation.getCurrentPosition(
        function (position) {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const mapsLink = "https://www.google.com/maps?q=" + lat + "," + lng;
          detectedLocation = { lat, lng, mapsLink };
          locationStatus.textContent = "Location detected - it will be included with your order.";
          detectLocationBtn.disabled = false;
        },
        function () {
          locationStatus.textContent = "Could not detect location. You can still proceed with your typed address.";
          detectLocationBtn.disabled = false;
        }
      );
    });

    // --- Place order (build WhatsApp message) ---
    function formatOrderTime(date) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      if (hours === 0) hours = 12;
      const minuteStr = minutes < 10 ? "0" + minutes : String(minutes);
      return date.getDate() + " " + months[date.getMonth()] + ", " + hours + ":" + minuteStr + " " + ampm;
    }

    function buildOrderMessage(name, mobile, address) {
      const items = window.PharmacyCart.getCart();
      const total = window.PharmacyCart.getTotal();

      const lines = [];
      lines.push("\uD83D\uDED2 NEW ORDER");
      lines.push("\uD83D\uDC64 Name: " + name);
      lines.push("\uD83D\uDCF1 Mobile: " + mobile);
      lines.push("\uD83C\uDFE0 Address: " + address);
      items.forEach(function (item) {
        lines.push("\uD83D\uDC8A " + item.name + " \u00D7 " + item.quantity);
      });
      lines.push("\uD83D\uDCB0 Total: \u20B9" + total);
      if (detectedLocation) {
        lines.push("\uD83D\uDCCD Customer Current Location:");
        lines.push("Google Maps: " + detectedLocation.mapsLink);
      }
      lines.push("\uD83D\uDD50 Order Time: " + formatOrderTime(new Date()));

      return lines.join("\n");
    }

    placeOrderBtn.addEventListener("click", function () {
      checkoutError.style.display = "none";

      const name = checkoutName.value.trim();
      const mobile = checkoutMobile.value.trim();
      const address = checkoutAddress.value.trim();

      if (!name) {
        checkoutError.textContent = "Please enter your name.";
        checkoutError.style.display = "block";
        return;
      }
      if (!/^[0-9+\s-]{7,15}$/.test(mobile)) {
        checkoutError.textContent = "Please enter a valid mobile number.";
        checkoutError.style.display = "block";
        return;
      }
      if (!address) {
        checkoutError.textContent = "Please enter your address.";
        checkoutError.style.display = "block";
        return;
      }
      if (window.PharmacyCart.getCart().length === 0) {
        checkoutError.textContent = "Your cart is empty.";
        checkoutError.style.display = "block";
        return;
      }

      const message = buildOrderMessage(name, mobile, address);
      const waUrl = "https://wa.me/" + PHARMACY_WHATSAPP_NUMBER + "?text=" + encodeURIComponent(message);

      window.open(waUrl, "_blank");

      checkoutModal.hide();
      successModal.show();
      window.PharmacyCart.clearCart();

      // Reset the form for next time.
      checkoutName.value = "";
      checkoutMobile.value = "";
      checkoutAddress.value = "";
      detectedLocation = null;
      locationStatus.textContent = "";
    });
  });
})();
