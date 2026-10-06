import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BsSearch } from 'react-icons/bs';
import CityInput from '../CityInput';

export default function SearchTrips() {
  const [location, setLocation] = useState('');
  const navigate = useNavigate();
  function submit(event) {
    event.preventDefault();
    navigate('/trips?search=' + encodeURIComponent(location.trim()));
  }
  return (
    <form className="trip-search" onSubmit={submit}>
      <CityInput value={location} onChange={setLocation} name="departureLocation" maxLength={120}
        placeholder="Enter departure location" aria-label="Departure location" />
      <button aria-label="Search trips" type="submit"><BsSearch aria-hidden="true" /></button>
    </form>
  );
}
