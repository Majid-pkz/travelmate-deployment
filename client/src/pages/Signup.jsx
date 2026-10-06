import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { CREATE_USER } from '../utils/mutations';
import Auth from '../utils/auth';
import '../components/Forms.css';

export default function Signup() {
  const [values, setValues] = useState({ firstname: '', lastname: '', email: '', password: '' });
  const [createUser, { error, loading }] = useMutation(CREATE_USER);
  const change = event => setValues(current => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    try { const result = await createUser({ variables: values }); Auth.login(result.data.createUser.token); }
    catch { /* Apollo supplies the error below. */ }
  }
  return (
    <main className="account-page account-page--narrow">
      <div className="account-page__heading"><h1>Sign up</h1><p>Meet your travelmates and start planning together.</p></div>
      <form className="form-panel" onSubmit={submit}>
        <fieldset disabled={loading}>
          <div className="form-fields">
            <div className="form-field"><label htmlFor="firstname">First name</label><input id="firstname" name="firstname" type="text" required maxLength={50} value={values.firstname} onChange={change} /></div>
            <div className="form-field"><label htmlFor="lastname">Last name</label><input id="lastname" name="lastname" type="text" required maxLength={50} value={values.lastname} onChange={change} /></div>
            <div className="form-field form-field--wide"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={values.email} onChange={change} /></div>
            <div className="form-field form-field--wide"><label htmlFor="password">Password</label><input id="password" name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required value={values.password} onChange={change} aria-describedby="password-help" />
              <small id="password-help" className="form-helper">Use at least 8 characters.</small></div>
          </div>
          {error && <p role="alert" className="form-error">{error.message}</p>}
          <div className="form-actions"><button className="account-button" type="submit">{loading ? 'Creating account…' : 'Sign up'}</button><Link to="/login">Already have an account? Log in</Link></div>
        </fieldset>
      </form>
    </main>
  );
}
