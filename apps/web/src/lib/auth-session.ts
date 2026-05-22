import { api } from "@/lib/api";

export async function loginWithCredentials(
  username: string,
  password: string
): Promise<void> {
  const formUrlEncoded = new URLSearchParams();
  formUrlEncoded.append("username", username);
  formUrlEncoded.append("password", password);

  const data = await api.post("/api/auth/token", formUrlEncoded, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    skipAuthRedirect: true,
  });

  localStorage.setItem(
    "token",
    (data as { access_token: string }).access_token
  );
}
