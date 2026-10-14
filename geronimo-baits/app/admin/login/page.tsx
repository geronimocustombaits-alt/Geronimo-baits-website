"use client";

import { useState, type FormEvent } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();

      if (data.success) {
        window.location.href = "/admin";
        return;
      }

      setError(data.error || "Login failed");
      setPassword("");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl border border-green-500/30 bg-black/80 p-10"
      >
        <p className="text-sm font-black tracking-[0.4em] text-green-500">
          GERONIMO BAITS
        </p>

        <h1 className="mt-3 text-4xl font-black">ADMIN LOGIN</h1>

        <p className="mt-3 text-gray-400">Enter the admin password to continue.</p>

        <label htmlFor="password" className="mt-8 block text-xs font-bold tracking-[0.25em] text-gray-500">
          PASSWORD
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-white outline-none focus:border-green-500"
        />

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="mt-6 w-full rounded-xl bg-green-500 px-6 py-4 font-black text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "CHECKING..." : "LOG IN"}
        </button>

        <a href="/" className="mt-6 block text-center text-sm text-gray-500 hover:text-green-500">
          ← Back to site
        </a>
      </form>
    </main>
  );
}
