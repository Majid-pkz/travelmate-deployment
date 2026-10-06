import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { UPDATE_USER } from '../utils/mutations';
import Auth from '../utils/auth';

export default function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ current: '', next: '', confirmation: '' });
  const [error, setError] = useState('');
  const [updateUser, { loading: saving }] = useMutation(UPDATE_USER);
  const navigate = useNavigate();
  function change(name, value) { setValues(current => ({ ...current, [name]: value })); setError(''); }
  function close() { setOpen(false); setError(''); setValues({ current: '', next: '', confirmation: '' }); }
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (values.next !== values.confirmation) { setError('The new passwords do not match.'); return; }
    if (new TextEncoder().encode(values.next).length > 72) { setError('Use a password with at most 72 bytes.'); return; }
    try {
      await updateUser({ variables: { id: Auth.getProfile()?.data?._id, currentPassword: values.current, password: values.next } });
      close();
      Auth.logout();
      navigate('/login', { replace: true, state: { message: 'Password changed. Log in with your new password.' } });
    } catch (failure) { setError(failure.message || 'Could not change your password. Please try again.'); }
  }
  return <section className="form-panel profile-security" aria-labelledby="account-security-heading">
    <div className="profile-section-heading"><h2 id="account-security-heading">Account security</h2>
      {!open && <button type="button" className="account-button account-button--secondary" onClick={() => setOpen(true)}>Change password</button>}</div>
    {open ? <form onSubmit={submit}><fieldset disabled={saving}>
      <div className="form-fields">
        <div className="form-field form-field--wide"><label htmlFor="security-current-password">Current password</label>
          <input id="security-current-password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={72}
            value={values.current} onChange={event => change('current', event.target.value)} /></div>
        <div className="form-field"><label htmlFor="security-new-password">New password</label>
          <input id="security-new-password" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72}
            value={values.next} onChange={event => change('next', event.target.value)} aria-describedby="security-password-help" /></div>
        <div className="form-field"><label htmlFor="security-confirm-password">Confirm new password</label>
          <input id="security-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72}
            value={values.confirmation} onChange={event => change('confirmation', event.target.value)} /></div>
      </div>
      <p id="security-password-help" className="form-helper">Use at least 8 characters. Changing your password signs you out of all sessions.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="form-actions"><button type="submit" className="account-button">{saving ? 'Updating…' : 'Update password'}</button>
        <button type="button" className="account-button account-button--secondary" onClick={close}>Cancel</button></div>
    </fieldset></form> : <p className="form-helper">Keep your account protected with a strong password.</p>}
  </section>;
}
