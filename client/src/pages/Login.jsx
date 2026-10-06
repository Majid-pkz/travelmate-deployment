import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { LOGIN_USER } from '../utils/mutations';
import Auth from '../utils/auth';
import '../components/Forms.css';

export default function Login() {
  const [values, setValues] = useState({ email: '', password: '' });
  const [login, { error, loading }] = useMutation(LOGIN_USER);
  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    try { const result = await login({ variables: values }); Auth.login(result.data.login.token); }
    catch { /* Apollo supplies the error below. */ }
  }
  return (
    <main className="account-page account-page--narrow">
      <div className="account-page__heading"><h1>Log in</h1><p>Welcome back. Your next adventure is waiting.</p></div>
      <form className="form-panel" onSubmit={submit}>
        <fieldset disabled={loading}>
          <div className="form-fields">
            <div className="form-field form-field--wide"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254}
              value={values.email} onChange={event => setValues(current => ({ ...current, email: event.target.value }))} /></div>
            <div className="form-field form-field--wide"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required
              value={values.password} onChange={event => setValues(current => ({ ...current, password: event.target.value }))} /></div>
          </div>
          {error && <p role="alert" className="form-error">{error.message}</p>}
          <div className="form-actions"><button className="account-button" type="submit">{loading ? 'Logging in…' : 'Log in'}</button><Link to="/signup">Don't have an account? Sign up</Link></div>
        </fieldset>
      </form>
    </main>
  );
}
