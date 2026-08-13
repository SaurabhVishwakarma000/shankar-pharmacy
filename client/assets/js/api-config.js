/**
 * api-config.js
 * -------------------------------------------------------------------------
 * Single place defining the backend API base URL for all frontend scripts
 * (medicine search, admin login, admin dashboard). No secrets live here -
 * only a plain, non-sensitive URL. Must load before any script that uses
 * window.API_BASE_URL.
 * -------------------------------------------------------------------------
 */
window.API_BASE_URL = "http://127.0.0.1:5000/api";
