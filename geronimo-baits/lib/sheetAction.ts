// Browser helper for the back office: calls /api/admin/sheet.
// Sends you to the login page if the session has expired.

export async function sheetAction<T = Record<string, unknown>>(
  action: string,
  params: Record<string, string | number> = {}
): Promise<T & { success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/admin/sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...params }),
      cache: "no-store",
    });
    if (response.status === 401) {
      window.location.href = "/admin/login";
      return { success: false, error: "Not logged in" } as T & { success: boolean; error?: string };
    }
    return await response.json();
  } catch {
    return { success: false, error: "No connection. Try again." } as T & { success: boolean; error?: string };
  }
}

export const rand = (n: number) =>
  `R${(Number(n) || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
