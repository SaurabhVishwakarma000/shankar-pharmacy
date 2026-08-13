/**
 * admin-dashboard.js
 * -------------------------------------------------------------------------
 * Medicine management for the admin dashboard: view all, search, add,
 * edit, delete (including an optional photo upload). Talks only to
 * /api/admin/medicines (session cookie sent automatically via
 * credentials: "include" - no token handled in JS). The session/redirect
 * guard and logout button live in admin-auth.js; this file only runs the
 * CRUD table/modals, and only initializes if the dashboard's medicine
 * table is present on the page.
 * -------------------------------------------------------------------------
 */

(function () {
  "use strict";

  const API_BASE_URL = window.API_BASE_URL;
  // The API server's origin (without "/api"), used to resolve image paths
  // like "/uploads/medicines/xyz.jpg" returned by the backend into full URLs.
  const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

  document.addEventListener("DOMContentLoaded", function () {
    const tbody = document.getElementById("admin-medicines-tbody");
    if (!tbody) return; // not on the dashboard page

    const tableWrapper = document.getElementById("admin-table-wrapper");
    const messageEl = document.getElementById("admin-medicines-message");
    const searchForm = document.getElementById("admin-search-form");
    const searchInput = document.getElementById("admin-search-input");
    const searchClearBtn = document.getElementById("admin-search-clear");

    const statTotal = document.getElementById("stat-total");
    const statAvailable = document.getElementById("stat-available");
    const statOut = document.getElementById("stat-out");

    const addBtn = document.getElementById("admin-add-medicine-btn");
    const formModalEl = document.getElementById("medicine-form-modal");
    const formModal = new bootstrap.Modal(formModalEl);
    const formTitle = document.getElementById("medicine-form-title");
    const formError = document.getElementById("medicine-form-error");
    const formIdInput = document.getElementById("medicine-form-id");
    const formNameInput = document.getElementById("medicine-form-name");
    const formPriceInput = document.getElementById("medicine-form-price");
    const formStockInput = document.getElementById("medicine-form-stock");
    const formCategoryInput = document.getElementById("medicine-form-category");
    const formDescriptionInput = document.getElementById("medicine-form-description");
    const formImageInput = document.getElementById("medicine-form-image");
    const formImagePreview = document.getElementById("medicine-form-image-preview");
    const formSaveBtn = document.getElementById("medicine-form-save");

    const deleteModalEl = document.getElementById("medicine-delete-modal");
    const deleteModal = new bootstrap.Modal(deleteModalEl);
    const deleteNameEl = document.getElementById("medicine-delete-name");
    const deleteConfirmBtn = document.getElementById("medicine-delete-confirm");
    let pendingDeleteId = null;

    let currentMedicines = [];

    function resolveImageUrl(imageUrl) {
      if (!imageUrl) return "";
      return API_ORIGIN + imageUrl;
    }

    function redirectToLogin() {
      window.location.href = "login.html";
    }

    async function apiFetch(path, options) {
      options = options || {};
      const isFormData = options.body instanceof FormData;
      const headers = isFormData ? {} : { "Content-Type": "application/json" };

      const response = await fetch(API_BASE_URL + path, {
        credentials: "include",
        headers: { ...headers, ...(options.headers || {}) },
        ...options
      });

      if (response.status === 401) {
        redirectToLogin();
        throw new Error("Not authenticated");
      }

      return response;
    }

    function renderStats(medicines) {
      const total = medicines.length;
      const available = medicines.filter((m) => m.available).length;
      statTotal.textContent = total;
      statAvailable.textContent = available;
      statOut.textContent = total - available;
    }

    function renderTable(medicines) {
      if (medicines.length === 0) {
        tableWrapper.style.display = "none";
        messageEl.style.display = "block";
        messageEl.textContent = "No medicines found.";
        return;
      }

      messageEl.style.display = "none";
      tableWrapper.style.display = "block";
      tbody.innerHTML = "";

      medicines.forEach(function (med) {
        const tr = document.createElement("tr");

        const statusClass = med.available ? "badge-available" : "badge-out";
        const statusText = med.available ? "Available" : "Out of Stock";

        tr.innerHTML =
          '<td class="med-image-cell"></td>' +
          "<td class=\"med-name\"></td>" +
          "<td class=\"med-category\"></td>" +
          "<td class=\"med-price\"></td>" +
          "<td class=\"med-stock\"></td>" +
          '<td><span class="admin-badge ' + statusClass + '">' + statusText + "</span></td>" +
          '<td class="admin-row-actions">' +
          '<button type="button" class="edit-btn">Edit</button>' +
          '<button type="button" class="delete-btn">Delete</button>' +
          "</td>";

        const imageCell = tr.querySelector(".med-image-cell");
        if (med.imageUrl) {
          const img = document.createElement("img");
          img.src = resolveImageUrl(med.imageUrl);
          img.alt = med.name;
          img.className = "admin-table-thumb";
          imageCell.appendChild(img);
        } else {
          imageCell.innerHTML = '<span class="admin-table-thumb-placeholder"><i class="bi bi-capsule"></i></span>';
        }

        tr.querySelector(".med-name").textContent = med.name;
        tr.querySelector(".med-category").textContent = med.category || "-";
        tr.querySelector(".med-price").textContent = "\u20B9" + med.price;
        tr.querySelector(".med-stock").textContent = med.stock;

        tr.querySelector(".edit-btn").addEventListener("click", function () {
          openEditForm(med);
        });
        tr.querySelector(".delete-btn").addEventListener("click", function () {
          openDeleteConfirm(med);
        });

        tbody.appendChild(tr);
      });
    }

    async function loadMedicines(search) {
      const query = search ? "?search=" + encodeURIComponent(search) : "";
      const response = await apiFetch("/admin/medicines" + query);

      if (!response.ok) {
        messageEl.style.display = "block";
        messageEl.textContent = "Could not load medicines. Please try again.";
        tableWrapper.style.display = "none";
        return;
      }

      const data = await response.json();
      currentMedicines = data.medicines || [];
      renderTable(currentMedicines);

      // Stats always reflect the FULL inventory, not the filtered search
      // results - so refresh them separately when a search is active.
      if (search) {
        const fullResponse = await apiFetch("/admin/medicines");
        if (fullResponse.ok) {
          const fullData = await fullResponse.json();
          renderStats(fullData.medicines || []);
        }
      } else {
        renderStats(currentMedicines);
      }
    }

    // --- Search ---
    searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      loadMedicines(searchInput.value.trim());
    });
    searchClearBtn.addEventListener("click", function () {
      searchInput.value = "";
      loadMedicines("");
    });

    // --- Add / Edit form ---
    function clearFormError() {
      formError.style.display = "none";
      formError.textContent = "";
    }
    function showFormError(text) {
      formError.textContent = text;
      formError.style.display = "block";
    }

    function resetImagePicker() {
      formImageInput.value = "";
      formImagePreview.src = "";
      formImagePreview.style.display = "none";
    }

    function openAddForm() {
      formTitle.textContent = "Add Medicine";
      formIdInput.value = "";
      formNameInput.value = "";
      formPriceInput.value = "";
      formStockInput.value = "";
      formCategoryInput.value = "";
      formDescriptionInput.value = "";
      resetImagePicker();
      clearFormError();
      formModal.show();
    }

    function openEditForm(med) {
      formTitle.textContent = "Edit Medicine";
      formIdInput.value = med._id;
      formNameInput.value = med.name;
      formPriceInput.value = med.price;
      formStockInput.value = med.stock;
      formCategoryInput.value = med.category || "";
      formDescriptionInput.value = med.description || "";
      resetImagePicker();
      if (med.imageUrl) {
        formImagePreview.src = resolveImageUrl(med.imageUrl);
        formImagePreview.style.display = "block";
      }
      clearFormError();
      formModal.show();
    }

    addBtn.addEventListener("click", openAddForm);

    // Live preview of a newly-chosen file, before it's uploaded.
    formImageInput.addEventListener("change", function () {
      const file = formImageInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        formImagePreview.src = e.target.result;
        formImagePreview.style.display = "block";
      };
      reader.readAsDataURL(file);
    });

    formSaveBtn.addEventListener("click", async function () {
      clearFormError();

      const name = formNameInput.value.trim();
      const price = formPriceInput.value;
      const stock = formStockInput.value;

      if (!name) {
        showFormError("Medicine name is required.");
        return;
      }
      if (price === "" || Number(price) < 0) {
        showFormError("Please enter a valid, non-negative price.");
        return;
      }
      if (stock === "" || Number(stock) < 0 || !Number.isInteger(Number(stock))) {
        showFormError("Please enter a valid, non-negative whole number for stock.");
        return;
      }

      const formData = new FormData();
      formData.append("name", name);
      formData.append("price", price);
      formData.append("stock", stock);
      formData.append("category", formCategoryInput.value.trim());
      formData.append("description", formDescriptionInput.value.trim());
      if (formImageInput.files[0]) {
        formData.append("image", formImageInput.files[0]);
      }

      const id = formIdInput.value;
      const isEdit = Boolean(id);

      formSaveBtn.disabled = true;
      formSaveBtn.textContent = "Saving...";

      try {
        const response = await apiFetch(
          isEdit ? "/admin/medicines/" + id : "/admin/medicines",
          {
            method: isEdit ? "PUT" : "POST",
            body: formData
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          showFormError(data.error || "Could not save medicine. Please try again.");
          return;
        }

        formModal.hide();
        loadMedicines(searchInput.value.trim());
      } catch (err) {
        showFormError("Could not reach the server. Please check your connection and try again.");
      } finally {
        formSaveBtn.disabled = false;
        formSaveBtn.textContent = "Save";
      }
    });

    // --- Delete ---
    function openDeleteConfirm(med) {
      pendingDeleteId = med._id;
      deleteNameEl.textContent = med.name;
      deleteModal.show();
    }

    deleteConfirmBtn.addEventListener("click", async function () {
      if (!pendingDeleteId) return;

      deleteConfirmBtn.disabled = true;
      deleteConfirmBtn.textContent = "Deleting...";

      try {
        const response = await apiFetch("/admin/medicines/" + pendingDeleteId, {
          method: "DELETE"
        });

        if (response.ok) {
          deleteModal.hide();
          loadMedicines(searchInput.value.trim());
        }
      } finally {
        pendingDeleteId = null;
        deleteConfirmBtn.disabled = false;
        deleteConfirmBtn.textContent = "Delete";
      }
    });

    // Initial load once the auth guard confirms a valid session.
    // admin-auth.js dispatches this event after GET /api/auth/me succeeds.
    document.addEventListener("admin-session-ready", function () {
      loadMedicines("");
    });
  });
})();
