/* Authentication feature boundary. Keeps auth flows isolated from page bootstrap. */

export function createAuthFeature({ getAuth, saveUser, clearUser, navigate = (url) => { window.location.href = url; } }) {
  const auth = () => getAuth?.();

  async function login(email, password) {
    const instance = auth();
    if (!instance) throw new Error("Authentication is not ready");
    if (typeof window.handleLogin === "function") {
      return window.handleLogin({ preventDefault() {}, target: null, __sheAuth: { email, password } });
    }
    throw new Error("Login handler is not available");
  }

  function logout() {
    if (typeof window.logout === "function") return window.logout();
    clearUser?.();
    return auth()?.signOut?.();
  }

  return { login, logout, saveUser, clearUser, navigate };
}
