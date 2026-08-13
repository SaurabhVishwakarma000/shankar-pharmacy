/**
 * admin-auth.js
 * -------------------------------------------------------------------------
 * Shared script for the admin login page and the admin dashboard page.
 * Detects which elements are present on the current page and wires up
 * only what applies. Talks to /api/auth/login, /api/auth/logout,
 * /api/auth/me. The session is an httpOnly cookie set by the server -
 * this script never reads, stores, or sends a token itself; it just uses
 * `credentials: "include"` so the browser attaches the cookie automatically.
 * -------------------------------------------------------------------------
 */

(function () {
  "use strict";

  const API_BASE_URL = window.API_BASE_URL;

  document.addEventListener("DOMContentLoaded", function () {
    setupLoginForm();
    setupDashboardGuard();
  });

  // --- Login page ---
  function setupLoginForm() {
    const form = document.getElementById("admin-login-form");
    if (!form) return; // not on the login page

    const usernameInput = document.getElementById("admin-username");
    const passwordInput = document.getElementById("admin-password");
    const errorEl = document.getElementById("admin-login-error");
    const submitBtn = document.getElementById("admin-login-submit");
    const passwordToggleBtn = document.getElementById("admin-password-toggle");

    if (passwordToggleBtn) {
      passwordToggleBtn.addEventListener("click", function () {
        const isHidden = passwordInput.type === "password";
        passwordInput.type = isHidden ? "text" : "password";
        passwordToggleBtn.innerHTML = isHidden ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
        passwordToggleBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
      });
    }

    function showError(text) {
      errorEl.textContent = text;
      errorEl.style.display = "block";
    }

    function clearError() {
      errorEl.style.display = "none";
      errorEl.textContent = "";
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearError();

      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (!username || !password) {
        showError("Please enter both username and password.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Logging in...";

      try {
        const response = await fetch(API_BASE_URL + "/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, password })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          showError(data.error || "Login failed. Please try again.");
          return;
        }

        window.location.href = "dashboard.html";
      } catch (err) {
        showError("Could not reach the server. Please check your connection and try again.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Login";
      }
    });
  }

  // --- Dashboard page ---
  function setupDashboardGuard() {
    const loadingEl = document.getElementById("admin-dashboard-loading");
    const contentEl = document.getElementById("admin-dashboard-content");
    const logoutBtn = document.getElementById("admin-logout-btn");
    const usernameDisplay = document.getElementById("admin-username-display");

    if (!loadingEl || !contentEl) return; // not on the dashboard page

    fetch(API_BASE_URL + "/auth/me", { credentials: "include" })
      .then(function (response) {
        if (!response.ok) {
          window.location.href = "login.html";
          return null;
        }
        return response.json();
      })
      .then(function (data) {
        if (!data) return;
        if (usernameDisplay) {
          usernameDisplay.textContent = data.admin.username;
        }
        loadingEl.style.display = "none";
        contentEl.style.display = "block";
        document.dispatchEvent(new CustomEvent("admin-session-ready", { detail: data.admin }));
      })
      .catch(function () {
        window.location.href = "login.html";
      });

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async function () {
        try {
          await fetch(API_BASE_URL + "/auth/logout", {
            method: "POST",
            credentials: "include"
          });
        } finally {
          window.location.href = "login.html";
        }
      });
    }
  }
})();
