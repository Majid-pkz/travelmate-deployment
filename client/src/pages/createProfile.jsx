import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import Select from 'react-select';
import { CREATE_PROFILE } from '../utils/mutations';
import { PROFILE_EXISTS, QUERY_INTEREST } from '../utils/queries';
import Auth from '../utils/auth';
import CityInput from '../components/CityInput';
import '../components/Forms.css';

export default function Profile() {
  const navigate = useNavigate();
  const userId = Auth.getProfile()?.data?._id;
  const [values, setValues] = useState({ location: '', gender: '', age: '', bio: '' });
  const [interests, setInterests] = useState([]);
  const { data: interestData } = useQuery(QUERY_INTEREST);
  const { loading, data: existing } = useQuery(PROFILE_EXISTS, { variables: { profileUser: userId }, skip: !userId });
  const [createProfile, { error, loading: saving }] = useMutation(CREATE_PROFILE);
  const options = (interestData?.interests ?? []).filter(Boolean).map(item => ({ value: item._id, label: Array.isArray(item.label) ? item.label.join(', ') : item.label }));
  const change = (name, value) => setValues(current => ({ ...current, [name]: value }));
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    try {
      await createProfile({ variables: { ...values, profileUser: userId, age: values.age === '' ? null : Number(values.age), interests: interests.map(item => item.value) } });
      navigate('/my-profile', { replace: true });
    } catch { /* Apollo supplies the error below. */ }
  }
  if (!userId) return <Navigate to="/login" replace />;
  if (loading) return <main className="account-page"><output>Loading profile…</output></main>;
  if (existing?.profileExist) return <Navigate to="/my-profile" replace />;
  return (
    <main className="account-page account-page--narrow">
      <div className="account-page__heading"><h1>Create your profile</h1><p>Tell future travelmates a little about yourself. These details are optional.</p></div>
      <form className="form-panel" onSubmit={submit}>
        <fieldset disabled={saving}>
          <div className="form-fields">
            <div className="form-field form-field--wide"><CityInput label="Location" placeholder="Location" name="location" maxLength={120} value={values.location} onChange={value => change('location', value)} /></div>
            <div className="form-field"><label htmlFor="new-profile-gender">Gender</label><select id="new-profile-gender" name="gender" value={values.gender} onChange={event => change('gender', event.target.value)}>
              <option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select></div>
            <div className="form-field"><label htmlFor="new-profile-age">Age</label><input id="new-profile-age" name="age" type="number" placeholder="Age" min="0" max="120" step="1" value={values.age} onChange={event => change('age', event.target.value)} /></div>
            <div className="form-field form-field--wide"><label htmlFor="new-profile-bio">About me</label><textarea id="new-profile-bio" name="bio" placeholder="Bio" maxLength={2000} value={values.bio} onChange={event => change('bio', event.target.value)} /></div>
            <div className="form-field form-field--wide"><label htmlFor="new-profile-interests">Interests</label><Select inputId="new-profile-interests" name="interests" options={options} value={interests} onChange={value => setInterests(value ?? [])} isMulti /></div>
          </div>
          {error && <p className="form-error" role="alert">{error.message}</p>}
          <div className="form-actions"><button type="submit" className="account-button">{saving ? 'Saving…' : 'Create profile'}</button></div>
        </fieldset>
      </form>
    </main>
  );
}
