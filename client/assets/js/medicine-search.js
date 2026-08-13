/**
 * medicine-search.js
 * -------------------------------------------------------------------------
 * Customer-facing medicine search. Calls the public medicines API
 * (GET /api/medicines?search=...) instead of a static in-page array.
 * No page reloads. Search is case-insensitive and matches partial names
 * (handled server-side).
 *
 * Each result card shows the medicine's name, description, photo (if the
 * pharmacy uploaded one), and availability - price is intentionally not
 * shown on the card (it appears in the cart once added). Available
 * medicines can be added to the cart with a quantity, wired to
 * window.PharmacyCart from cart.js (which must load before this script).
 *
 * API_BASE_URL comes from api-config.js (window.API_BASE_URL), which must
 * load before this script. No credentials or secrets are ever placed in
 * frontend code.
 * -------------------------------------------------------------------------
 */

(function () {
  "use strict";

  const API_BASE_URL = window.API_BASE_URL;
  const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("medicine-search-form");
    const input = document.getElementById("medicine-search-input");
    const clearBtn = document.getElementById("medicine-search-clear");
    const resultsEl = document.getElementById("medicine-search-results");
    const messageEl = document.getElementById("medicine-search-message");

    if (!form || !input || !resultsEl || !messageEl) {
      // Search UI not present on this page - nothing to do.
      return;
    }

    // Guards against an older, slower request overwriting a newer result
    // if the user searches again before the first response arrives.
    let requestToken = 0;

    function showMessage(text) {
      messageEl.textContent = text;
      messageEl.style.display = "block";
      resultsEl.innerHTML = "";
      resultsEl.style.display = "none";
    }

    function resolveImageUrl(imageUrl) {
      if (!imageUrl) return "";
      return API_ORIGIN + imageUrl;
    }

    function renderResults(matches) {
      messageEl.style.display = "none";
      resultsEl.style.display = "flex";
      resultsEl.innerHTML = "";

      matches.forEach(function (medicine) {
        const col = document.createElement("div");
        col.className = "col-md-6 col-lg-4";

        const statusClass = medicine.available ? "med-status-available" : "med-status-unavailable";
        const statusText = medicine.available ? "Available" : "Not Available";

        col.innerHTML =
          '<div class="medicine-card">' +
            '<div class="medicine-card-image"></div>' +
            '<div class="medicine-card-body">' +
              '<h4 class="medicine-name"></h4>' +
              '<p class="medicine-description"></p>' +
              '<span class="medicine-status ' + statusClass + '">' +
                '<i class="bi bi-circle-fill"></i> <span class="status-text"></span>' +
              "</span>" +
              '<div class="medicine-cart-controls"></div>' +
            "</div>" +
          "</div>";

        col.querySelector(".medicine-name").textContent = medicine.name;
        col.querySelector(".status-text").textContent = statusText;

        const descEl = col.querySelector(".medicine-description");
        if (medicine.description) {
          descEl.textContent = medicine.description;
        } else {
          descEl.style.display = "none";
        }

        const imageEl = col.querySelector(".medicine-card-image");
        if (medicine.imageUrl) {
          const img = document.createElement("img");
          img.src = resolveImageUrl(medicine.imageUrl);
          img.alt = medicine.name;
          imageEl.appendChild(img);
        } else {
          imageEl.style.display = "none";
        }

        const cartControls = col.querySelector(".medicine-cart-controls");
        if (medicine.available && window.PharmacyCart) {
          buildCartControls(cartControls, medicine);
        }

        resultsEl.appendChild(col);
      });
    }

    function buildCartControls(container, medicine) {
      const inCartAlready = window.PharmacyCart.getCart().some(function (item) {
        return item.id === medicine._id;
      });

      container.innerHTML =
        '<label class="cart-add-toggle">' +
          '<input type="checkbox" class="cart-add-checkbox">' +
          " Add to Cart" +
        "</label>" +
        '<div class="cart-qty-stepper" style="display:none;">' +
          '<button type="button" class="qty-btn qty-minus" aria-label="Decrease quantity">-</button>' +
          '<span class="qty-value">1</span>' +
          '<button type="button" class="qty-btn qty-plus" aria-label="Increase quantity">+</button>' +
        "</div>";

      const checkbox = container.querySelector(".cart-add-checkbox");
      const stepper = container.querySelector(".cart-qty-stepper");
      const qtyValueEl = container.querySelector(".qty-value");
      let quantity = 1;

      const medicineForCart = { id: medicine._id, name: medicine.name, price: medicine.price };

      checkbox.checked = inCartAlready;
      stepper.style.display = inCartAlready ? "flex" : "none";

      checkbox.addEventListener("change", function () {
        if (checkbox.checked) {
          quantity = 1;
          qtyValueEl.textContent = quantity;
          stepper.style.display = "flex";
          window.PharmacyCart.addItem(medicineForCart, quantity);
        } else {
          stepper.style.display = "none";
          window.PharmacyCart.removeItem(medicine._id);
        }
      });

      container.querySelector(".qty-minus").addEventListener("click", function () {
        if (quantity <= 1) return;
        quantity -= 1;
        qtyValueEl.textContent = quantity;
        window.PharmacyCart.setQuantity(medicine._id, quantity);
      });

      container.querySelector(".qty-plus").addEventListener("click", function () {
        quantity += 1;
        qtyValueEl.textContent = quantity;
        window.PharmacyCart.setQuantity(medicine._id, quantity);
      });
    }

    async function runSearch() {
      const query = input.value.trim();

      if (query === "") {
        showMessage("Please enter a medicine name to search.");
        return;
      }

      const currentToken = ++requestToken;
      showMessage("Searching...");

      try {
        const url = API_BASE_URL + "/medicines?search=" + encodeURIComponent(query);
        const response = await fetch(url);

        // A slower, older request resolving after a newer one - ignore it.
        if (currentToken !== requestToken) {
          return;
        }

        if (response.status === 503) {
          showMessage("Search is temporarily unavailable. Please call the pharmacy directly.");
          return;
        }

        if (!response.ok) {
          showMessage("Something went wrong while searching. Please try again.");
          return;
        }

        const data = await response.json();
        const matches = data.medicines || [];

        if (matches.length === 0) {
          showMessage("No medicine found matching your search.");
          return;
        }

        renderResults(matches);
      } catch (err) {
        if (currentToken !== requestToken) {
          return;
        }
        showMessage("Could not reach the search service. Please check your connection and try again.");
      }
    }

    function clearSearch() {
      requestToken++; // invalidate any in-flight search
      input.value = "";
      showMessage("Please enter a medicine name to search.");
      input.focus();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      runSearch();
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        clearSearch();
      });
    }

    // Initial default state.
    showMessage("Please enter a medicine name to search.");
  });
})();
