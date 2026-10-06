import decode from 'jwt-decode';

class AuthService {
  getProfile() {
    const token = this.getToken();
    if (!token || this.isTokenExpired(token)) return null;
    return decode(token);
  }
  loggedIn() { return Boolean(this.getProfile()); }
  isTokenExpired(token) {
    try {
      const decoded = decode(token);
      if (!decoded?.data?._id || !Number.isFinite(decoded.exp) || decoded.exp <= Date.now() / 1000) {
        this.logout();
        return true;
      }
      return false;
    } catch {
      this.logout();
      return true;
    }
  }
  getToken() { return localStorage.getItem('id_token'); }
  login(idToken) {
    if (this.isTokenExpired(idToken)) throw new Error('Login failed. Please try again.');
    localStorage.setItem('id_token', idToken);
    window.location.assign('/');
  }
  logout() { localStorage.removeItem('id_token'); }
}
const authService = new AuthService();
export default authService;
